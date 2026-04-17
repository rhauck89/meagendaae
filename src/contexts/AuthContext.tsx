import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type LoginMode = 'admin' | 'professional' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: any | null;
  companyId: string | null;
  roles: string[];
  loginMode: LoginMode;
  setLoginMode: (mode: LoginMode) => void;
  isAlsoCollaborator: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  companyId: null,
  roles: [],
  loginMode: null,
  setLoginMode: () => {},
  isAlsoCollaborator: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loginMode, setLoginModeState] = useState<LoginMode>(null);
  const [isAlsoCollaborator, setIsAlsoCollaborator] = useState(false);

  const setLoginMode = async (mode: LoginMode) => {
    setLoginModeState(mode);
    if (mode && user) {
      // Save preference to profile
      await supabase.from('profiles').update({ last_login_mode: mode }).eq('user_id', user.id);
    }
  };

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    let savedMode: LoginMode = null;
    if (profileRes.data) {
      setProfile(profileRes.data);
      setCompanyId(profileRes.data.company_id);
      savedMode = profileRes.data.last_login_mode as LoginMode;
    }

    if (rolesRes.data) {
      const mappedRoles = rolesRes.data.map((r) => r.role);
      setRoles(mappedRoles);

      // Check if admin user also has a collaborator record
      const isAdminRole = mappedRoles.includes('professional');
      if (isAdminRole && profileRes.data?.id) {
        const { data: collabData } = await supabase
          .from('collaborators')
          .select('id')
          .eq('profile_id', profileRes.data.id)
          .eq('active', true)
          .limit(1);
        const hasCollabRecord = !!(collabData && collabData.length > 0);
        setIsAlsoCollaborator(hasCollabRecord);

        // Only restore saved mode if user actually has dual roles
        if (hasCollabRecord && savedMode) {
          setLoginModeState(savedMode);
        } else if (!hasCollabRecord) {
          // Single role admin — force admin mode
          setLoginModeState('admin');
        }
        // If hasCollabRecord && !savedMode → leave null so dialog shows
      } else if (mappedRoles.includes('collaborator')) {
        // Pure collaborator — force professional mode
        setIsAlsoCollaborator(false);
        setLoginModeState('professional');
      } else {
        setIsAlsoCollaborator(false);
        if (isAdminRole) {
          setLoginModeState('admin');
        }
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            if (cancelled) return;
            await fetchUserData(session.user.id);
            if (!cancelled) setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setCompanyId(null);
          setRoles([]);
          setLoginModeState(null);
          setIsAlsoCollaborator(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && !session) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, companyId, roles, loginMode, setLoginMode, isAlsoCollaborator, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
