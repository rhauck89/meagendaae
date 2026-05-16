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
  const { isOwner, permissions, loading: authLoading, loginMode, roles } = useAuth();

  const isSuperAdmin = roles.includes('super_admin');

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

  // Helper to check permission flexibly
  const canAccess = (module: string) => {
    if (isOwner || isSuperAdmin) return true;
    if (!permissions) return false;

    // Check direct boolean or nested view permission
    const perm = permissions[module];
    if (perm === true) return true;
    if (perm && typeof perm === 'object' && perm.view === true) return true;

    // Aliases
    const aliases: Record<string, string> = {
      'schedule': 'agenda',
      'servicos': 'services',
      'equipe': 'team',
      'clientes': 'clients',
      'assinaturas': 'subscriptions',
      'promocoes': 'promotions',
      'solicitacoes': 'requests',
      'financeiro': 'finance',
      'configuracoes': 'settings',
      'relatorios': 'reports'
    };

    const aliasedModule = aliases[module];
    if (aliasedModule) {
      const aliasedPerm = permissions[aliasedModule];
      if (aliasedPerm === true) return true;
      if (aliasedPerm && typeof aliasedPerm === 'object' && aliasedPerm.view === true) return true;
    }

    return false;
  };

  if (loginMode === 'professional') {
    return fullProfessionalPanel;
  }

  return {
    agenda: canAccess('agenda'),
    services: canAccess('services'),
    team: canAccess('team'),
    clients: canAccess('clients'),
    whatsapp: canAccess('whatsapp'),
    subscriptions: canAccess('subscriptions'),
    events: canAccess('events'),
    promotions: canAccess('promotions'),
    loyalty: canAccess('loyalty'),
    requests: canAccess('requests'),
    finance: canAccess('finance'),
    settings: canAccess('settings'),
    reports: canAccess('reports'),
    loading: authLoading
  };
};
