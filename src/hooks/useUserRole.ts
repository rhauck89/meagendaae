import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useCallback } from 'react';

export const useUserRole = () => {
  const { roles, profile, loginMode, isAlsoCollaborator } = useAuth();

  const isProfessional = useMemo(() => roles.includes('professional'), [roles]);
  const isCollaborator = useMemo(() => roles.includes('collaborator'), [roles]);
  const isSuperAdmin = useMemo(() => roles.includes('super_admin'), [roles]);
  const isClient = useMemo(() => roles.includes('client'), [roles]);
  const profileId = profile?.id;

  // When an admin+collaborator switches to professional mode, treat as non-admin
  const isProfessionalMode = useMemo(
    () => isProfessional && isAlsoCollaborator && loginMode === 'professional',
    [isProfessional, isAlsoCollaborator, loginMode]
  );

  const isAdmin = useMemo(
    () => (isProfessional || isSuperAdmin) && !isProfessionalMode,
    [isProfessional, isSuperAdmin, isProfessionalMode]
  );

  const hasRole = useCallback((role: string) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((checkRoles: string[]) => checkRoles.some(r => roles.includes(r)), [roles]);

  return { isProfessional, isCollaborator, isSuperAdmin, isAdmin, isClient, profileId, roles, hasRole, hasAnyRole, isProfessionalMode };
};
