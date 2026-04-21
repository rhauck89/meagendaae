/**
 * Business model unification layer.
 *
 * Maps the new 6-type taxonomy ("Modelo Comercial") to the legacy
 * `collaborator_type` + `commission_type` fields so the existing financial
 * engine keeps working without changes.
 *
 * NEW MODELS:
 * - employee              → Funcionário (salário externo OR comissão %/fixa)
 * - partner_commission    → Parceiro com comissão (% profissional / % empresa)
 * - chair_rental          → Aluguel de cadeira (receita 100% do profissional)
 * - investor_partner      → Sócio Investidor (não atende clientes)
 * - operating_partner     → Sócio Operacional (atende clientes)
 *     - revenue mode: individual | shared | percent_to_company
 * - external              → Externo (sem impacto financeiro)
 */

export type BusinessModel =
  | 'employee'
  | 'partner_commission'
  | 'chair_rental'
  | 'investor_partner'
  | 'operating_partner'
  | 'external';

export type RentCycle = 'daily' | 'weekly' | 'monthly';
export type PartnerRevenueMode = 'individual' | 'shared' | 'percent_to_company';
export type LegacyCollaboratorType = 'partner' | 'commissioned' | 'independent';
export type LegacyCommissionType = 'percentage' | 'fixed' | 'none' | 'own_revenue';

export interface BusinessModelForm {
  business_model: BusinessModel;
  // employee / partner_commission
  commission_type: LegacyCommissionType; // percentage | fixed | none
  commission_value: number;
  // operating_partner
  partner_revenue_mode: PartnerRevenueMode | null;
  partner_equity_percent: number;
  // chair_rental
  rent_amount: number;
  rent_cycle: RentCycle | null;
}

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  employee: 'Funcionário',
  partner_commission: 'Parceiro com comissão',
  chair_rental: 'Aluguel de cadeira',
  investor_partner: 'Sócio Investidor',
  operating_partner: 'Sócio Operacional',
  external: 'Externo',
};

export const BUSINESS_MODEL_DESCRIPTIONS: Record<BusinessModel, string> = {
  employee:
    'Profissional vinculado à empresa. Receita entra na empresa e o repasse é calculado conforme a regra abaixo.',
  partner_commission:
    'Parceiro recebe um percentual de cada atendimento. A divisão é automática.',
  chair_rental:
    'O profissional usa o espaço pagando um valor recorrente. A receita dos serviços fica com ele.',
  investor_partner:
    'Participa apenas da sociedade/lucro. Não atende clientes.',
  operating_partner:
    'É sócio da empresa e também atende clientes. Recomendado para casos com mais de um dono que atende.',
  external:
    'Usa a agenda/sistema sem impacto financeiro. Nenhum valor é registrado para este profissional.',
};

export const RENT_CYCLE_LABELS: Record<RentCycle, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export const PARTNER_REVENUE_MODE_LABELS: Record<PartnerRevenueMode, string> = {
  individual: 'Individual — cada sócio fica com o que produzir',
  shared: 'Compartilhada — receita entra na empresa e divide depois',
  percent_to_company: 'Percentual para a empresa — parte vai para a empresa',
};

/**
 * Derive legacy fields from the new business model so the existing
 * financial-engine and reports continue working unchanged.
 */
export function deriveLegacyFields(form: BusinessModelForm): {
  collaborator_type: LegacyCollaboratorType;
  commission_type: LegacyCommissionType;
  commission_value: number;
} {
  switch (form.business_model) {
    case 'employee': {
      // Salário externo = none; senão usa o tipo escolhido
      const ctype: LegacyCommissionType =
        form.commission_type === 'percentage' || form.commission_type === 'fixed'
          ? form.commission_type
          : 'none';
      return {
        collaborator_type: 'commissioned',
        commission_type: ctype,
        commission_value: ctype === 'none' ? 0 : Number(form.commission_value) || 0,
      };
    }
    case 'partner_commission': {
      return {
        collaborator_type: 'commissioned',
        commission_type: 'percentage',
        commission_value: Number(form.commission_value) || 0,
      };
    }
    case 'chair_rental': {
      return {
        collaborator_type: 'independent',
        commission_type: 'own_revenue',
        commission_value: 0,
      };
    }
    case 'operating_partner': {
      if (form.partner_revenue_mode === 'individual') {
        return {
          collaborator_type: 'partner',
          commission_type: 'own_revenue',
          commission_value: 0,
        };
      }
      if (form.partner_revenue_mode === 'percent_to_company') {
        // % do sócio = 100 - % empresa. Aqui commission_value representa o % do profissional.
        return {
          collaborator_type: 'partner',
          commission_type: 'percentage',
          commission_value: Number(form.commission_value) || 0,
        };
      }
      // shared
      return {
        collaborator_type: 'partner',
        commission_type: 'none',
        commission_value: 0,
      };
    }
    case 'investor_partner':
    case 'external':
    default:
      return {
        collaborator_type: 'commissioned',
        commission_type: 'none',
        commission_value: 0,
      };
  }
}

/** Build a default form when opening the dialog for an existing collaborator. */
export function formFromCollaborator(c: any): BusinessModelForm {
  const bm: BusinessModel = (c?.business_model as BusinessModel) || inferBusinessModel(c);
  return {
    business_model: bm,
    commission_type: (c?.commission_type as LegacyCommissionType) || 'percentage',
    commission_value: Number(c?.commission_value) || 0,
    partner_revenue_mode: (c?.partner_revenue_mode as PartnerRevenueMode) || null,
    partner_equity_percent: Number(c?.partner_equity_percent) || 0,
    rent_amount: Number(c?.rent_amount) || 0,
    rent_cycle: (c?.rent_cycle as RentCycle) || 'monthly',
  };
}

/** Fallback inference for legacy rows without business_model set. */
function inferBusinessModel(c: any): BusinessModel {
  if (!c) return 'employee';
  if (c.collaborator_type === 'independent') return 'chair_rental';
  if (c.collaborator_type === 'partner') return 'operating_partner';
  if (c.commission_type === 'percentage' || c.commission_type === 'fixed')
    return 'partner_commission';
  return 'employee';
}

/** Short badge label that summarises the model + financial config. */
export function modelBadgeLabel(c: any): string {
  const bm = (c?.business_model as BusinessModel) || inferBusinessModel(c);
  if (bm === 'partner_commission' && c?.commission_value)
    return `Parceiro ${c.commission_value}%`;
  if (bm === 'chair_rental' && c?.rent_amount)
    return `Aluguel R$ ${Number(c.rent_amount).toFixed(2)}`;
  if (bm === 'operating_partner' && c?.partner_revenue_mode === 'percent_to_company' && c?.commission_value)
    return `Sócio Op. ${c.commission_value}%`;
  return BUSINESS_MODEL_LABELS[bm];
}
