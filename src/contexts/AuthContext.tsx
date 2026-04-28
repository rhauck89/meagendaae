import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  updateAuthState: (session: Session | null) => Promise<void>;
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
  setUser: () => {},
  setSession: () => {},
  updateAuthState: async () => {},
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
      await supabase.from('profiles').update({ last_login_mode: mode }).eq('user_id', user.id);
    }
  };

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      let savedMode: LoginMode = null;
      if (profileRes.data) {
        setProfile(profileRes.data);
        setCompanyId(profileRes.data.company_id);
        savedMode = profileRes.data.last_login_mode as LoginMode;

        // CLIENT_GLOBAL_SYNC: If user is a client, ensure we have their global data synced
        if (profileRes.data.role === 'client') {
          const { data: globalClient } = await supabase
            .from('clients_global')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (globalClient) {
            console.log('[AUTH_CONTEXT] Synced with clients_global:', globalClient.id);
          }
        }
      }

      if (rolesRes.data) {
        const mappedRoles = rolesRes.data.map((r) => r.role);
        setRoles(mappedRoles);

        const isAdminRole = mappedRoles.includes('professional') || mappedRoles.includes('admin');
        if (isAdminRole && profileRes.data?.id) {
          const { data: collabData } = await supabase
            .from('collaborators')
            .select('id')
            .eq('profile_id', profileRes.data.id)
            .eq('active', true)
            .limit(1);
          const hasCollabRecord = !!(collabData && collabData.length > 0);
          setIsAlsoCollaborator(hasCollabRecord);

          if (hasCollabRecord && savedMode) {
            setLoginModeState(savedMode);
          } else if (!hasCollabRecord) {
            setLoginModeState('admin');
          }
        } else if (mappedRoles.includes('collaborator')) {
          setIsAlsoCollaborator(false);
          setLoginModeState('professional');
        } else {
          setIsAlsoCollaborator(false);
          if (isAdminRole) {
            setLoginModeState('admin');
          }
        }
      }
    } catch (error) {
      console.error('[AUTH_CONTEXT] Error fetching user data:', error);
    }
  }, []);

  const updateAuthState = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    const newUser = newSession?.user ?? null;
    setUser(newUser);

    if (newUser) {
      await fetchUserData(newUser.id);
    } else {
      setProfile(null);
      setCompanyId(null);
      setRoles([]);
      setLoginModeState(null);
      setIsAlsoCollaborator(false);
    }
    setLoading(false);
  }, [fetchUserData]);

  useEffect(() => {
    let cancelled = false;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (cancelled) return;
      updateAuthState(initialSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (cancelled) return;
        console.log(`[AUTH_CONTEXT] onAuthStateChange: ${event}`);
        
        // We still use this as a backup, but manual updates are preferred after login
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          updateAuthState(currentSession);
        } else if (event === 'SIGNED_OUT') {
          updateAuthState(null);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [updateAuthState]);

  const signOut = async () => {
    const sensitiveKeys = [
      'selectedClient', 'clientId', 'guestClient', 'cachedAppointments', 
      'clientPhone', 'clientProfile', 'client_portal_'
    ];
    
    Object.keys(localStorage).forEach(key => {
      if (sensitiveKeys.some(sk => key.startsWith(sk))) {
        localStorage.removeItem(key);
      }
    });

    await supabase.auth.signOut();
    window.location.replace('/');
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      profile, 
      companyId, 
      roles, 
      loginMode, 
      setLoginMode, 
      isAlsoCollaborator, 
      signOut, 
      refreshProfile,
      setUser,
      setSession,
      updateAuthState
    }}>
      {children}
    </AuthContext.Provider>
  );
};
