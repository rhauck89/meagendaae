import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EVOLUTION_API_URL = "https://apiwpp.meagendae.com.br";
const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 20_000;
const DEFAULT_BATCH_SIZE = 3;
const MAX_BATCH_SIZE = 5;

type Campaign = {
  id: string;
  company_id: string;
  promotion_id: string | null;
  title: string | null;
  message_body: string | null;
  status: string | null;
  total_clients: number | null;
};

type CampaignLog = {
  id: string;
  client_id: string | null;
  whatsapp: string | null;
};

type ClientRecord = {
  id: string;
  name: string | null;
  whatsapp: string | null;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizePhone = (value: string | null | undefined) => {
  let digits = String(value || "").replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");

  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

const phoneKeys = (value: string | null | undefined) => {
  const normalized = normalizePhone(value);
  const withoutCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  return new Set([normalized, withoutCountry].filter(Boolean));
};

const randomDelay = () =>
  MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));

const hashIndex = (seed: string, length: number) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
};

const resolvePublicOrigin = (origin?: string) => {
  const fallback = "https://www.meagendae.com.br";
  if (!origin) return fallback;

  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com")
    ) {
      return `${url.protocol}//${url.host}`;
    }
    if (host === "meagendae.com.br" || host === "www.meagendae.com.br") {
      return `${url.protocol}//${url.host}`;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const buildMessage = (
  campaign: Campaign,
  client: ClientRecord | undefined,
  phone: string,
  logId: string,
  origin: string,
) => {
  const firstName = (client?.name || "tudo bem").trim().split(/\s+/)[0];
  const greetings = ["Olá", "Oi", "Tudo bem"];
  const intros = [
    "Passando para avisar",
    "Tenho uma novidade para você",
    "Separei uma condição especial para você",
  ];
  const greeting = greetings[hashIndex(logId, greetings.length)];
  const intro = intros[hashIndex(`${logId}:intro`, intros.length)];
  const optOutLink = `${origin}/promocoes/descadastrar?c=${encodeURIComponent(
    campaign.company_id,
  )}&w=${encodeURIComponent(phone)}`;

  const core = (campaign.message_body || campaign.title || "Temos uma promoção especial para você.").trim();

  return `${greeting}, ${firstName}! ${intro}.

${core}

Não deseja mais receber promoções deste estabelecimento?
${optOutLink}`;
};

const callEvolution = async (instanceName: string, endpoint: string, body?: unknown) => {
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${endpoint}/${instanceName}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text.trim().startsWith("{") ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, text, data };
};

const assertUserCanAccessCompany = async (serviceClient: any, userId: string, companyId: string) => {
  const { data: company } = await serviceClient
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (company) return true;

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.company_id === companyId) return true;

  const { data: role } = await serviceClient
    .from("user_roles")
    .select("id, role, company_id")
    .eq("user_id", userId)
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .limit(1)
    .maybeSingle();
  if (role) return true;

  if (profile?.id) {
    const { data: collaborator } = await serviceClient
      .from("collaborators")
      .select("id")
      .eq("company_id", companyId)
      .eq("profile_id", profile.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (collaborator) return true;
  }

  return false;
};

const getConnectedInstance = async (serviceClient: any, companyId: string) => {
  const fallbackInstance = `company_${companyId}`;
  const { data: instance } = await serviceClient
    .from("whatsapp_instances")
    .select("instance_name, status")
    .eq("company_id", companyId)
    .maybeSingle();

  const instanceName = instance?.instance_name || fallbackInstance;
  const status = await callEvolution(instanceName, "/instance/connectionState");
  const state = (status.data as any)?.instance?.state || (status.data as any)?.state;
  const apiConnected = ["open", "connected"].includes(String(state || "").toLowerCase());
  const dbConnected = ["connected", "open"].includes(String(instance?.status || "").toLowerCase());

  if (apiConnected && instance?.status !== "connected") {
    await serviceClient
      .from("whatsapp_instances")
      .update({ status: "connected", connected_at: new Date().toISOString() })
      .eq("company_id", companyId);
  }

  if (!apiConnected && !dbConnected) {
    throw new Error("WhatsApp da empresa não está conectado.");
  }

  return instanceName;
};

const updateCampaignCounters = async (serviceClient: any, campaignId: string) => {
  const { data: logs, error } = await serviceClient
    .from("promotion_campaign_logs")
    .select("status")
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const statuses = (logs || []).map((log: { status: string | null }) => log.status || "pending");
  const pending = statuses.filter((status: string) => status === "pending").length;
  const success = statuses.filter((status: string) => status === "sent").length;
  const errors = statuses.filter((status: string) => status === "error").length;
  const optOut = statuses.filter((status: string) => status === "opt_out" || status === "skipped").length;
  const completed = pending === 0;

  const status = completed ? (errors > 0 ? "completed_with_errors" : "completed") : "sending";
  const updatePayload: Record<string, unknown> = {
    status,
    total_clients: statuses.length,
    success_count: success,
    error_count: errors,
    opt_out_count: optOut,
    skipped_count: optOut,
    updated_at: new Date().toISOString(),
  };

  if (completed) {
    updatePayload.completed_at = new Date().toISOString();
  }

  await serviceClient.from("promotion_campaigns").update(updatePayload).eq("id", campaignId);

  return { pending, success, errors, optOut, status };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ success: false, error: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json();
    const campaignId = body?.campaign_id;
    const origin = resolvePublicOrigin(body?.origin);
    const batchSize = Math.min(Number(body?.batch_size || DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE);

    if (!campaignId) {
      return json({ success: false, error: "campaign_id é obrigatório" }, 400);
    }

    const { data: campaign, error: campaignError } = await serviceClient
      .from("promotion_campaigns")
      .select("id, company_id, promotion_id, title, message_body, status, total_clients")
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignError || !campaign) {
      return json({ success: false, error: "Campanha não encontrada" }, 404);
    }

    const canAccess = await assertUserCanAccessCompany(
      serviceClient,
      userData.user.id,
      campaign.company_id,
    );
    if (!canAccess) {
      return json({ success: false, error: "Acesso negado à campanha" }, 403);
    }

    await serviceClient
      .from("promotion_campaigns")
      .update({
        status: "sending",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    const instanceName = await getConnectedInstance(serviceClient, campaign.company_id);

    const { data: logs, error: logsError } = await serviceClient
      .from("promotion_campaign_logs")
      .select("id, client_id, whatsapp")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (logsError) throw logsError;

    const pendingLogs = (logs || []) as CampaignLog[];
    if (pendingLogs.length === 0) {
      const counters = await updateCampaignCounters(serviceClient, campaignId);
      return json({ success: true, processed: 0, ...counters });
    }

    const clientIds = pendingLogs.map((log) => log.client_id).filter(Boolean);
    const { data: clientsData } = clientIds.length
      ? await serviceClient.from("clients").select("id, name, whatsapp").in("id", clientIds)
      : { data: [] };
    const clientsById = new Map<string, ClientRecord>(
      ((clientsData || []) as ClientRecord[]).map((client) => [client.id, client]),
    );

    const { data: optOutRows } = await serviceClient
      .from("promotional_opt_outs")
      .select("whatsapp")
      .eq("company_id", campaign.company_id);
    const optOutKeys = new Set<string>();
    (optOutRows || []).forEach((row: { whatsapp: string | null }) => {
      phoneKeys(row.whatsapp).forEach((key) => optOutKeys.add(key));
    });

    let processed = 0;

    for (let index = 0; index < pendingLogs.length; index += 1) {
      const log = pendingLogs[index];
      const client = log.client_id ? clientsById.get(log.client_id) : undefined;
      const phone = normalizePhone(client?.whatsapp || log.whatsapp);
      const keys = phoneKeys(phone);
      const isOptOut = Array.from(keys).some((key) => optOutKeys.has(key));

      if (!phone || phone.length < 12) {
        await serviceClient
          .from("promotion_campaign_logs")
          .update({
            status: "error",
            error_message: "WhatsApp inválido",
            processed_at: new Date().toISOString(),
          })
          .eq("id", log.id);
        processed += 1;
        continue;
      }

      if (isOptOut) {
        await serviceClient
          .from("promotion_campaign_logs")
          .update({
            status: "opt_out",
            error_message: "Cliente descadastrado de mensagens promocionais",
            processed_at: new Date().toISOString(),
          })
          .eq("id", log.id);
        processed += 1;
        continue;
      }

      const message = buildMessage(campaign as Campaign, client, phone, log.id, origin);

      try {
        const result = await callEvolution(instanceName, "/message/sendText", {
          number: phone,
          text: message,
        });

        if (!result.ok) {
          throw new Error(result.text || `Evolution API HTTP ${result.status}`);
        }

        await serviceClient
          .from("promotion_campaign_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            message_body: message,
            error_message: null,
          })
          .eq("id", log.id);
      } catch (error) {
        await serviceClient
          .from("promotion_campaign_logs")
          .update({
            status: "error",
            error_message: error instanceof Error ? error.message : String(error),
            processed_at: new Date().toISOString(),
          })
          .eq("id", log.id);
      }

      processed += 1;

      if (index < pendingLogs.length - 1) {
        await delay(randomDelay());
      }
    }

    const counters = await updateCampaignCounters(serviceClient, campaignId);
    return json({ success: true, processed, ...counters });
  } catch (error) {
    console.error("[process-promotion-campaign]", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao processar campanha",
      },
      400,
    );
  }
});
