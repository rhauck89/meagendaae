/**
 * Financial calculation engine for different professional types.
 *
 * Partner:       professional gets 100%, company gets 0%
 * Independent:   professional gets 100%, company gets 0%
 * Own Revenue:   professional gets 100%, company gets 0% (not counted as company income)
 * Commissioned:  professional gets commission (% or fixed), company gets remainder
 */

export interface FinancialBreakdown {
  professionalValue: number;
  companyValue: number;
}

export const calculateFinancials = (
  revenue: number,
  serviceCount: number,
  collaboratorType: string,
  commissionType: string,
  commissionValue: number
): FinancialBreakdown => {
  // Own revenue: professional keeps everything, company gets nothing
  if (commissionType === 'own_revenue') {
    return { professionalValue: revenue, companyValue: 0 };
  }

  // Partner & Independent: professional keeps everything
  if (collaboratorType === 'partner' || collaboratorType === 'independent') {
    return { professionalValue: revenue, companyValue: 0 };
  }

  // Commissioned
  let professionalValue = 0;
  if (commissionType === 'percentage') {
    professionalValue = (revenue * commissionValue) / 100;
  } else if (commissionType === 'fixed') {
    professionalValue = commissionValue * serviceCount;
  }

  return {
    professionalValue,
    companyValue: revenue - professionalValue,
  };
};

export const collaboratorTypeLabel = (type: string): string => {
  switch (type) {
    case 'partner': return 'Sócio';
    case 'commissioned': return 'Comissionado';
    case 'independent': return 'Independente';
    default: return type;
  }
};

export const commissionLabel = (type: string, value: number): string => {
  if (type === 'own_revenue') return 'Receita própria';
  if (type === 'percentage') return `${value}%`;
  if (type === 'fixed') return `R$ ${value.toFixed(2)}/serviço`;
  return 'Sem comissão';
};
