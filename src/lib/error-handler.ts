import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ErrorDetails {
  area: string;
  companyId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export const classifyError = (error: any) => {
  const message = error?.message || String(error);
  const code = error?.code || "";

  // Schema cache / structure errors
  if (
    message.includes("schema cache") ||
    message.includes("column does not exist") ||
    message.includes("relation does not exist") ||
    code === "PGRST204" ||
    code === "42703" ||
    code === "42P01"
  ) {
    return {
      friendlyTitle: "Sincronizando...",
      friendlyMessage: "A estrutura do sistema ainda está sincronizando. Recarregue a página e tente novamente.",
      category: "schema"
    };
  }

  // Date/time errors
  if (
    message.includes("date/time field value out of range") ||
    message.includes("invalid date") ||
    code === "22007" ||
    code === "22008"
  ) {
    return {
      friendlyTitle: "Data inválida",
      friendlyMessage: "A data informada não é válida. Use o formato dia/mês/ano, por exemplo 15/05/1990.",
      category: "validation"
    };
  }

  // Duplicate key errors
  if (message.includes("duplicate key") || code === "23505") {
    return {
      friendlyTitle: "Cadastro duplicado",
      friendlyMessage: "Já existe um cadastro com estes dados. Revise as informações e tente novamente.",
      category: "validation"
    };
  }

  // Not-null constraint errors
  if (message.includes("null value in column") || code === "23502") {
    return {
      friendlyTitle: "Campos obrigatórios",
      friendlyMessage: "Preencha todos os campos obrigatórios e tente novamente.",
      category: "validation"
    };
  }

  // Permission/RLS errors
  if (
    message.includes("row-level security policy") ||
    message.includes("permission denied") ||
    code === "42501"
  ) {
    return {
      friendlyTitle: "Acesso negado",
      friendlyMessage: "Você não tem permissão para esta ação.",
      category: "auth"
    };
  }

  // Network errors
  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("Failed to fetch")
  ) {
    return {
      friendlyTitle: "Erro de conexão",
      friendlyMessage: "Problema de conexão. Verifique sua internet e tente novamente.",
      category: "network"
    };
  }

  // Edge Function / Server errors
  if (code.startsWith("5") || message.includes("Edge Function")) {
    return {
      friendlyTitle: "Imprevisto no servidor",
      friendlyMessage: "Ocorreu um imprevisto. Nossa equipe já foi avisada. Tente novamente em alguns instantes.",
      category: "server"
    };
  }

  return {
    friendlyTitle: "Algo deu errado",
    friendlyMessage: "Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.",
    category: "unknown"
  };
};

export const reportError = async (error: any, details: ErrorDetails) => {
  const { friendlyTitle, friendlyMessage } = classifyError(error);
  
  try {
    const { error: insertError } = await supabase.from("app_error_logs").insert({
      company_id: details.companyId || null,
      user_id: details.userId || null,
      context: details.area,
      friendly_title: friendlyTitle,
      friendly_message: friendlyMessage,
      technical_message: error?.message || String(error),
      error_code: error?.code || null,
      error_name: error?.name || null,
      stack: error?.stack || null,
      metadata: details.metadata || {},
    } as any);

    if (insertError) console.error("Error reporting to logs:", insertError);
  } catch (err) {
    console.error("Critical error reporting to logs:", err);
  }
};

export const handleError = (error: any, details: ErrorDetails) => {
  console.error(`[Error in ${details.area}]:`, error);
  
  const { friendlyTitle, friendlyMessage } = classifyError(error);
  
  toast.error(friendlyTitle, {
    description: friendlyMessage,
  });

  reportError(error, details);
};

export const installGlobalErrorHandlers = () => {
  window.onerror = (message, source, lineno, colno, error) => {
    reportError(error || message, { area: "global.window.onerror" });
  };

  window.onunhandledrejection = (event) => {
    reportError(event.reason, { area: "global.unhandledrejection" });
  };
};
