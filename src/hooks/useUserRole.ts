import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useCallback } from 'react';

export const useUserRole = () => {
  const { roles, profile } = useAuth();

  const isProfessional = useMemo(() => roles.includes('professional'), [roles]);
  const isCollaborator = useMemo(() => roles.includes('collaborator'), [roles]);
  const isSuperAdmin = useMemo(() => roles.includes('super_admin'), [roles]);
  const isAdmin = useMemo(() => isProfessional || isSuperAdmin, [isProfessional, isSuperAdmin]);
  const isClient = useMemo(() => roles.includes('client'), [roles]);
  const profileId = profile?.id;

  const hasRole = useCallback((role: string) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((checkRoles: string[]) => checkRoles.some(r => roles.includes(r)), [roles]);

  return { isProfessional, isCollaborator, isSuperAdmin, isAdmin, isClient, profileId, roles, hasRole, hasAnyRole };
};
