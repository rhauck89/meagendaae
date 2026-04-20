/**
 * Global Error Handler
 * ----------------------------------------------------
 * - Maps technical errors (Supabase / HTTP / RPC / Network) to friendly PT-BR messages.
 * - Logs the full technical detail to internal console (dev only) / future monitoring.
 * - Never exposes raw SQL / stack traces to end users.
 *
 * Usage:
 *   import { friendlyError, reportError, handleError } from '@/lib/error-handler';
 *
 *   try { ... } catch (e) {
 *     handleError(e, { area: 'booking.create', userId, companyId });
 *   }
 */

import { toast } from 'sonner';

const isDev = import.meta.env.DEV;

export type ErrorKind =
  | 'duplicate'
  | 'foreign_key'
  | 'not_null'
  | 'network'
  | 'auth'
  | 'permission'
  | 'conflict'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'validation'
  | 'unknown';

export interface FriendlyError {
  kind: ErrorKind;
  title: string;
  message: string;
  /** Technical detail kept for logs only — never displayed */
  technical: string;
  retryable: boolean;
}

interface ReportContext {
  area?: string;
  endpoint?: string;
  userId?: string;
  companyId?: string;
  payload?: Record<string, unknown>;
}

/* --------------------------- Mapping --------------------------- */

export function classifyError(raw: unknown): FriendlyError {
  const err: any = raw ?? {};
  const message = String(err?.message ?? err?.error_description ?? err ?? '');
  const code = String(err?.code ?? err?.status ?? '').toLowerCase();
  const lower = message.toLowerCase();
  const technical = `${code} ${message}`.trim();

  // Network / fetch
  if (
    /failed to fetch|network ?error|timeout|networkrequestfailed|err_internet|load failed/i.test(message) ||
    err?.name === 'TypeError' && /fetch/i.test(message)
  ) {
    return {
      kind: 'network',
      title: 'Sem conexão',
      message: 'Problema de conexão. Verifique sua internet e tente novamente.',
      technical,
      retryable: true,
    };
  }

  // Auth — session expired / unauthorized
  if (
    /jwt expired|invalid jwt|unauthorized|not authenticated|auth_required|session.*expired/i.test(message) ||
    code === '401' || code === '28000'
  ) {
    return {
      kind: 'auth',
      title: 'Sessão expirada',
      message: 'Sua sessão expirou. Faça login novamente para continuar.',
      technical,
      retryable: false,
    };
  }

  // Permission
  if (/permission denied|forbidden|rls|new row violates row-level security/i.test(message) || code === '403' || code === '42501') {
    return {
      kind: 'permission',
      title: 'Acesso não permitido',
      message: 'Você não tem permissão para esta ação.',
      technical,
      retryable: false,
    };
  }

  // Slot conflict (booking specific)
  if (/time slot already booked|slot.*conflict|no_overlapping_appointments|already booked/i.test(message)) {
    return {
      kind: 'conflict',
      title: 'Horário indisponível',
      message: 'Esse horário acabou de ser reservado. Escolha outro disponível.',
      technical,
      retryable: false,
    };
  }

  // Duplicate / unique violation
  if (/duplicate key|unique constraint|already exists|23505/i.test(message) || code === '23505') {
    // Specific case for clients index
    if (/idx_clients_user_company|clients.*user.*company/i.test(message)) {
      return {
        kind: 'duplicate',
        title: 'Cadastro já existe',
        message: 'Já encontramos seu cadastro. Continuando...',
        technical,
        retryable: true,
      };
    }
    return {
      kind: 'duplicate',
      title: 'Registro já existe',
      message: 'Já encontramos esse cadastro. Tente novamente em instantes.',
      technical,
      retryable: true,
    };
  }

  // Foreign key
  if (/foreign key|violates foreign key|23503/i.test(message) || code === '23503') {
    return {
      kind: 'foreign_key',
      title: 'Operação inválida',
      message: 'Não foi possível concluir: o item está vinculado a outro registro.',
      technical,
      retryable: false,
    };
  }

  // Not null
  if (/null value in column|not-null|23502/i.test(message) || code === '23502') {
    return {
      kind: 'not_null',
      title: 'Dados incompletos',
      message: 'Preencha todos os campos obrigatórios e tente novamente.',
      technical,
      retryable: false,
    };
  }

  // Not found
  if (/not found|pgrst116|no rows/i.test(message) || code === '404') {
    return {
      kind: 'not_found',
      title: 'Não encontrado',
      message: 'Não encontramos o que você procurava. Atualize a página e tente novamente.',
      technical,
      retryable: true,
    };
  }

  // Rate limit
  if (/rate limit|too many requests|429/i.test(message) || code === '429') {
    return {
      kind: 'rate_limit',
      title: 'Muitas tentativas',
      message: 'Aguarde alguns instantes antes de tentar novamente.',
      technical,
      retryable: true,
    };
  }

  // Server / 5xx
  if (/internal server error|5\d\d|edge function.*error/i.test(message) || /^5/.test(code)) {
    return {
      kind: 'server',
      title: 'Imprevisto no servidor',
      message: 'Ocorreu um imprevisto. Nossa equipe já foi avisada. Tente novamente em alguns instantes.',
      technical,
      retryable: true,
    };
  }

  // Validation (PT messages from RPCs that are already friendly)
  if (
    message &&
    !/^[\[\]A-Z_0-9 ]+$/.test(message) &&
    !/select|insert|update|delete|column|relation|constraint|pg_/i.test(lower) &&
    message.length < 160
  ) {
    return {
      kind: 'validation',
      title: 'Atenção',
      message,
      technical,
      retryable: false,
    };
  }

  return {
    kind: 'unknown',
    title: 'Não foi possível concluir',
    message: 'Não foi possível concluir agora. Tente novamente.',
    technical,
    retryable: true,
  };
}

/* --------------------------- Logging --------------------------- */

export function reportError(raw: unknown, ctx: ReportContext = {}): FriendlyError {
  const friendly = classifyError(raw);
  const entry = {
    timestamp: new Date().toISOString(),
    kind: friendly.kind,
    area: ctx.area,
    endpoint: ctx.endpoint,
    userId: ctx.userId,
    companyId: ctx.companyId,
    technical: friendly.technical,
    stack: (raw as any)?.stack,
    payload: ctx.payload,
  };

  if (isDev) {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[ERROR:${friendly.kind}] ${ctx.area ?? 'app'}`, 'color:#ef4444');
    // eslint-disable-next-line no-console
    console.error(raw);
    // eslint-disable-next-line no-console
    console.table(entry);
    // eslint-disable-next-line no-console
    console.groupEnd();
  } else {
    // In production, keep silent on raw error; only record sanitized entry
    // (Can be wired to Sentry/PostHog/etc later)
    try {
      const buf = (window as any).__errorBuffer || ((window as any).__errorBuffer = []);
      buf.push(entry);
      if (buf.length > 50) buf.shift();
    } catch { /* noop */ }
  }

  return friendly;
}

/* --------------------------- UI Helpers --------------------------- */

interface HandleOptions extends ReportContext {
  /** Show toast? default true */
  toast?: boolean;
  /** Optional onRetry callback — adds a "Tentar novamente" action to the toast */
  onRetry?: () => void;
}

export function handleError(raw: unknown, options: HandleOptions = {}): FriendlyError {
  const friendly = reportError(raw, options);

  if (options.toast !== false) {
    toast.error(friendly.title, {
      description: friendly.message,
      action: friendly.retryable && options.onRetry
        ? { label: 'Tentar novamente', onClick: options.onRetry }
        : undefined,
    });
  }

  return friendly;
}

/** Convenience: just get the friendly text without showing toast */
export function friendlyError(raw: unknown): string {
  return classifyError(raw).message;
}

/* --------------------------- Global capture --------------------------- */

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    // Ignore ResizeObserver loop / script-loading noise
    const msg = String(event.message || '');
    if (/ResizeObserver|Script error\.?$|Loading chunk \d+ failed/i.test(msg)) return;
    reportError(event.error || event.message, { area: 'window.error' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { area: 'unhandledrejection' });
  });

  // In production, dampen raw console.error spam from third-party libs
  if (!isDev) {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      try {
        const buf = (window as any).__consoleErrorBuffer || ((window as any).__consoleErrorBuffer = []);
        buf.push({ t: Date.now(), args: args.map(a => String(a).slice(0, 500)) });
        if (buf.length > 100) buf.shift();
      } catch { /* noop */ }
      // Still forward, but you can comment this out to fully silence:
      origError.apply(console, args);
    };
  }
}
