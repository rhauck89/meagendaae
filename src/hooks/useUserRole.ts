import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export const useUserRole = () => {
  const { roles, profile } = useAuth();

  const isProfessional = useMemo(() => roles.includes('professional'), [roles]);
  const isCollaborator = useMemo(() => roles.includes('collaborator'), [roles]);
  const isSuperAdmin = useMemo(() => roles.includes('super_admin'), [roles]);
  const isAdmin = useMemo(() => isProfessional || isSuperAdmin, [isProfessional, isSuperAdmin]);
  const profileId = profile?.id;

  return { isProfessional, isCollaborator, isSuperAdmin, isAdmin, profileId, roles };
};
