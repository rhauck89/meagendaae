/**
 * Centralized signup/auth error diagnosis.
 * Maps Supabase Auth (gotrue) errors to friendly Portuguese messages.
 *
 * Common 422 causes:
 *  - Email already registered (when "Prevent user enumeration" is on, gotrue
 *    returns a generic 422 instead of "user already exists")
 *  - Password rejected by HIBP (Have I Been Pwned) — leaked password
 *  - Password shorter than the minimum length configured
 *  - Signups disabled in Auth settings
 *  - Invalid email format
 */

export interface AuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
}

export function diagnoseAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return 'Erro desconhecido';

  const msg = (error.message || '').toLowerCase();
  const status = error.status;
  const code = (error.code || '').toLowerCase();

  // Always log the full error for debugging
  // eslint-disable-next-line no-console
  console.error('[AUTH ERROR]', {
    message: error.message,
    status,
    code,
    name: error.name,
  });

  // Already registered
  if (
    /already registered|already exists|user.*exists|email.*taken/i.test(msg) ||
    code === 'user_already_exists'
  ) {
    return 'Já existe uma conta com este email. Tente fazer login ou recupere sua senha.';
  }

  // Leaked password (HIBP)
  if (/pwned|leaked|compromised|hibp|known to be weak|easy to guess/i.test(msg) || code === 'weak_password') {
    return 'Essa senha é muito comum e não é segura. Escolha uma senha mais forte para proteger sua conta.';
  }

  // Password too short / weak
  if (/password.*short|password.*length|password.*weak|min.*character/i.test(msg)) {
    return 'Senha muito curta. Use no mínimo 6 caracteres (preferencialmente 8+).';
  }

  // Signups disabled
  if (/signup.*disabled|signups not allowed/i.test(msg)) {
    return 'Cadastros estão desativados temporariamente. Tente novamente mais tarde.';
  }

  // Invalid email
  if (/invalid.*email|email.*invalid/i.test(msg)) {
    return 'Email inválido. Verifique o endereço digitado.';
  }

  // Rate limit
  if (/rate limit|too many|email rate/i.test(msg) || status === 429) {
    return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  }

  // Invalid credentials (login)
  if (/invalid login|invalid credentials|invalid grant/i.test(msg)) {
    return 'Email ou senha incorretos.';
  }

  // 422 generic — most likely email already registered or password rejected
  if (status === 422) {
    return 'Não foi possível criar a conta. Verifique se o email já está cadastrado ou tente uma senha diferente.';
  }

  // Network
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }

  // Fallback
  return error.message || 'Erro ao processar autenticação.';
}
