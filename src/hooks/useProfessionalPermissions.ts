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
  const { isOwner, permissions, loading: authLoading, loginMode } = useAuth();

  const fullProfessionalPanel = {
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

  // If owner, has all permissions. Professional mode is only for service providers.
  if (isOwner || loginMode === 'professional') {
    return fullProfessionalPanel;
  }

  // Map backend permissions to frontend keys
  return {
    agenda: permissions?.agenda?.view ?? false,
    services: permissions?.services?.view ?? false,
    team: permissions?.team?.view ?? false,
    clients: permissions?.clients?.view ?? false,
    whatsapp: permissions?.whatsapp?.view ?? false,
    subscriptions: permissions?.subscriptions?.view ?? false,
    events: permissions?.events?.view ?? false,
    promotions: permissions?.promotions?.view ?? false,
    loyalty: permissions?.loyalty?.view ?? false,
    requests: permissions?.requests?.view ?? false,
    finance: permissions?.finance?.view ?? false,
    settings: permissions?.settings?.view ?? false,
    reports: permissions?.reports?.view ?? false,
    loading: authLoading
  };
};
