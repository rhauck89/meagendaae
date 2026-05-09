/**
 * Financial calculation engine for different professional types.
 *
 * Independent:  professional gets 100%, company gets 0%
 * Own Revenue:  professional gets 100%, company gets 0% (not counted as company income)
 * Partner:      follows commission type; without a split, professional gets 100%
 * Commissioned: professional gets commission (% or fixed), company gets remainder
 */

export interface FinancialBreakdown {
  professionalValue: number;
  companyValue: number;
}

export const getAppointmentRevenue = (appointment: {
  final_price?: number | string | null;
  total_price?: number | string | null;
}): number => {
  return Number(appointment.final_price ?? appointment.total_price ?? 0);
};

export const calculateFinancials = (
  revenue: number,
  serviceCount: number,
  collaboratorType: string,
  commissionType: string,
  commissionValue: number
): FinancialBreakdown => {
  if (commissionType === 'own_revenue') {
    return { professionalValue: revenue, companyValue: 0 };
  }

  if (collaboratorType === 'independent') {
    return { professionalValue: revenue, companyValue: 0 };
  }

  if (collaboratorType === 'partner' && commissionType === 'none') {
    return { professionalValue: revenue, companyValue: 0 };
  }

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
  if (type === 'none') return 'Receita própria';
  if (type === 'percentage') return `${value}%`;
  if (type === 'fixed') return `R$ ${value.toFixed(2)}/serviço`;
  return 'Receita própria';
};

export const remunerationLabel = (
  collaboratorType: string,
  commissionType: string,
  commissionValue: number
): string => {
  if (commissionType === 'own_revenue') return 'Receita própria';
  if (collaboratorType === 'independent') return 'Receita própria';
  if (collaboratorType === 'partner' && commissionType === 'none') return 'Receita própria';
  return commissionLabel(commissionType, commissionValue);
};
