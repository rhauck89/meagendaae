import { useAuth } from '@/contexts/AuthContext';

export interface ProfessionalPermissions {
  agenda: boolean;
  services: boolean;
  team: boolean;
  clients: boolean;
  whatsapp: boolean;
  subscriptions: boolean;
  events: boolean;
  promotions: boolean;
  loyalty: boolean;
  requests: boolean;
  finance: boolean;
  settings: boolean;
  reports: boolean;
  loading: boolean;
}

export const useProfessionalPermissions = (): ProfessionalPermissions => {
  const { companyId, isOwner, permissions, loading: authLoading } = useAuth();

  // If owner, has all permissions
  if (isOwner) {
    return {
      agenda: true,
      services: true,
      team: true,
      clients: true,
      whatsapp: true,
      subscriptions: true,
      events: true,
      promotions: true,
      loyalty: true,
      requests: true,
      finance: true,
      settings: true,
      reports: true,
      loading: authLoading
    };
  }

  // Map backend permissions to frontend keys
  return {
    agenda: permissions?.agenda?.view ?? true,
    services: permissions?.services?.view ?? true,
    team: permissions?.team?.view ?? true,
    clients: permissions?.clients?.view ?? true,
    whatsapp: permissions?.whatsapp?.view ?? true,
    subscriptions: permissions?.subscriptions?.view ?? true,
    events: permissions?.events?.view ?? true,
    promotions: permissions?.promotions?.view ?? true,
    loyalty: permissions?.loyalty?.view ?? true,
    requests: permissions?.requests?.view ?? true,
    finance: permissions?.finance?.view ?? false,
    settings: permissions?.settings?.view ?? false,
    reports: permissions?.reports?.view ?? false,
    loading: authLoading
  };
};
