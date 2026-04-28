import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type LoginMode = 'admin' | 'professional' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  profile: any | null;
  companyId: string | null;
  roles: string[];
  loginMode: LoginMode;
  setLoginMode: (mode: LoginMode) => void;
  isAlsoCollaborator: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateAuthState: (session: Session | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: true,
  profile: null,
  companyId: null,
  roles: [],
  loginMode: null,
  setLoginMode: () => {},
  isAlsoCollaborator: false,
  signOut: async () => {},
  refreshProfile: async () => {},
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

  const isAuthenticated = useMemo(() => !!session, [session]);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setCompanyId(profileRes.data.company_id);
        
        // Sync with global client data if applicable
        if (profileRes.data.role === 'client') {
          await supabase.from('clients_global').select('*').eq('user_id', userId).single();
        }
      }

      if (rolesRes.data) {
        const mappedRoles = rolesRes.data.map((r) => r.role);
        setRoles(mappedRoles);

        const isAdminRole = mappedRoles.includes('professional') || mappedRoles.includes('super_admin');
        if (isAdminRole && profileRes.data?.id) {
          const { data: collabData } = await supabase
            .from('collaborators')
            .select('id')
            .eq('profile_id', profileRes.data.id)
            .eq('active', true)
            .limit(1);
          
          const hasCollabRecord = !!(collabData && collabData.length > 0);
          setIsAlsoCollaborator(hasCollabRecord);

          if (!hasCollabRecord) {
            setLoginModeState('admin');
          } else if (profileRes.data.last_login_mode) {
            setLoginModeState(profileRes.data.last_login_mode as LoginMode);
          }
        } else if (mappedRoles.includes('collaborator')) {
          setIsAlsoCollaborator(false);
          setLoginModeState('professional');
        }
      }
    } catch (error) {
      console.error('[AUTH_CONTEXT] Error fetching user data:', error);
    }
  }, []);

  const updateAuthState = useCallback(async (newSession: Session | null) => {
    console.log('[AUTH_CONTEXT] Manual updateAuthState triggered');
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

    // Rule 6: Initial session fetch
    const initSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!cancelled) {
        await updateAuthState(initialSession);
      }
    };

    initSession();

    // Rule 4: Use onAuthStateChange ONLY for backup initialization (e.g. tab switches)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (cancelled) return;
      console.log(`[AUTH_CONTEXT] onAuthStateChange (Backup): ${event}`);
      
      if (event === 'SIGNED_OUT') {
        await updateAuthState(null);
      } else if (event === 'TOKEN_REFRESHED') {
        await updateAuthState(currentSession);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [updateAuthState]);

  const setLoginMode = async (mode: LoginMode) => {
    setLoginModeState(mode);
    if (mode && user) {
      await supabase.from('profiles').update({ last_login_mode: mode }).eq('user_id', user.id);
    }
  };

  const signOut = async () => {
    console.log('[AUTH_CONTEXT] SignOut triggered');
    const sensitiveKeys = [
      'selectedClient', 'clientId', 'guestClient', 'cachedAppointments', 
      'clientPhone', 'clientProfile', 'client_portal_'
    ];
    
    Object.keys(localStorage).forEach(key => {
      if (sensitiveKeys.some(sk => key.startsWith(sk))) {
        localStorage.removeItem(key);
      }
    });

    // Rule 5: Explicit cleanup
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setCompanyId(null);
    setRoles([]);
    
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
      isAuthenticated,
      loading, 
      profile, 
      companyId, 
      roles, 
      loginMode, 
      setLoginMode, 
      isAlsoCollaborator, 
      signOut, 
      refreshProfile,
      updateAuthState
    }}>
      {children}
    </AuthContext.Provider>
  );
};