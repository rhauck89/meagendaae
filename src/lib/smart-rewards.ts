/**
 * Smart Rewards Engine
 *
 * Analisa o histórico do cliente (serviços passados, gasto, frequência)
 * e sugere a "próxima recompensa ideal" — aquela que ele está mais perto
 * de conquistar e que melhor combina com seu perfil de consumo.
 *
 * Heurística:
 *  1) Identificar o "serviço favorito" (mais frequente nos últimos 12 meses).
 *  2) Calcular o ticket médio do cliente.
 *  3) Filtrar recompensas ativas + com estoque + dentro de 2x do saldo atual.
 *  4) Ranquear por:
 *      - mesma categoria/nome do serviço favorito (peso alto)
 *      - menor gap (saldo atual ÷ pontos necessários)
 *      - maior valor real (recompensa "vale mais")
 *  5) Retornar a melhor opção + o gap (quantos pontos faltam).
 */

export interface SmartRewardInput {
  currentBalance: number;
  appointmentHistory: Array<{
    service_name?: string | null;
    total_price?: number | null;
    created_at?: string | null;
  }>;
  rewards: Array<{
    id: string;
    name: string;
    description?: string | null;
    item_type: string;
    points_required: number;
    real_value: number;
    image_url?: string | null;
    stock_available?: number | null;
  }>;
}

export interface SmartRewardSuggestion {
  reward: SmartRewardInput['rewards'][number];
  pointsMissing: number;
  progressPct: number; // 0–100
  reason: string; // human-friendly explanation in pt-BR
  isAffordable: boolean;
}

export function suggestSmartReward(
  input: SmartRewardInput,
): SmartRewardSuggestion | null {
  const { currentBalance, appointmentHistory, rewards } = input;

  if (!rewards || rewards.length === 0) return null;

  // 1) Top service in last 12 months
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const serviceFreq: Record<string, number> = {};
  let totalSpent = 0;
  let visitCount = 0;
  for (const apt of appointmentHistory) {
    const ts = apt.created_at ? new Date(apt.created_at).getTime() : 0;
    if (ts < cutoff) continue;
    visitCount += 1;
    totalSpent += Number(apt.total_price ?? 0);
    const name = (apt.service_name || '').trim().toLowerCase();
    if (name) serviceFreq[name] = (serviceFreq[name] || 0) + 1;
  }
  const favoriteService = Object.entries(serviceFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // 2) Eligible rewards: active stock + within 3x of current balance
  const eligible = rewards.filter((r) => {
    if (r.stock_available !== undefined && r.stock_available !== null && r.stock_available <= 0) return false;
    if (r.points_required <= 0) return false;
    return r.points_required <= Math.max(currentBalance * 3, 50);
  });
  if (eligible.length === 0) return null;

  // 3) Score
  const scored = eligible.map((r) => {
    const matchesFavorite =
      favoriteService && r.name.toLowerCase().includes(favoriteService);
    const progress = Math.min(100, (currentBalance / r.points_required) * 100);
    const valueScore = Math.log10(Math.max(1, Number(r.real_value) || 1));
    const score =
      progress * 1.0 + // closer to redeem
      (matchesFavorite ? 30 : 0) + // bonus for favorite service match
      valueScore * 5; // slight bonus for higher-value rewards
    return { r, progress, score, matchesFavorite: !!matchesFavorite };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) return null;

  const pointsMissing = Math.max(0, top.r.points_required - currentBalance);
  const isAffordable = pointsMissing === 0;

  let reason = '';
  if (isAffordable) {
    reason = top.matchesFavorite
      ? `Você já pode resgatar! Combina com seu serviço favorito.`
      : `Você já tem pontos suficientes para resgatar agora.`;
  } else if (top.matchesFavorite) {
    reason = `Faltam ${pointsMissing} pts — combina com seu serviço favorito.`;
  } else if (visitCount >= 3) {
    reason = `Faltam ${pointsMissing} pts — recompensa mais próxima do seu saldo.`;
  } else {
    reason = `Faltam ${pointsMissing} pts para sua primeira recompensa.`;
  }

  return {
    reward: top.r,
    pointsMissing,
    progressPct: Math.round(top.progress),
    reason,
    isAffordable,
  };
}
