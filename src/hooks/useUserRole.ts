import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useCallback } from 'react';

export const useUserRole = () => {
  const { roles, profile, loginMode, isAlsoCollaborator, isOwner, canSwitchAdminProfessional } = useAuth();

  const isProfessional = useMemo(() => roles.includes('professional'), [roles]);
  const isCollaborator = useMemo(() => roles.includes('collaborator'), [roles]);
  const isSuperAdmin = useMemo(() => roles.includes('super_admin'), [roles]);
  const isClient = useMemo(() => roles.includes('client'), [roles]);
  const profileId = profile?.id;

  // When an owner/admin who also provides services switches to professional mode,
  // treat the dashboard as the professional panel so every query/filter follows that context.
  const isProfessionalMode = useMemo(
    () => (canSwitchAdminProfessional || (isProfessional && isAlsoCollaborator)) && loginMode === 'professional',
    [canSwitchAdminProfessional, isProfessional, isAlsoCollaborator, loginMode]
  );

  const isAdmin = useMemo(
    () => (isOwner || isProfessional || isCollaborator || isSuperAdmin) && !isProfessionalMode,
    [isOwner, isProfessional, isCollaborator, isSuperAdmin, isProfessionalMode]
  );

  const hasRole = useCallback((role: string) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((checkRoles: string[]) => checkRoles.some(r => roles.includes(r)), [roles]);

  return { isProfessional, isCollaborator, isSuperAdmin, isAdmin, isClient, profileId, roles, hasRole, hasAnyRole, isProfessionalMode };
};
