import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  isAdmin: boolean;
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
  isAdmin: false,
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
  const lastLoadedUserId = useRef<string | null>(null);

  const isAuthenticated = useMemo(() => !!session, [session]);

  const fetchUserData = useCallback(async (userId: string, authUser?: User | null) => {
    try {
      console.log("[AUTH_DEBUG] Fetching data for user:", userId);

      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      let profileData = profileRes.data;
      const profileError = profileRes.error;

      if (!profileData && !profileError) {
        console.log("[AUTH_DEBUG] Profile not found, creating for:", userId);
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({ 
            user_id: userId,
            full_name: authUser?.user_metadata?.full_name || null 
          })
          .select()
          .maybeSingle();

        if (createError) {
          console.error("[AUTH_DEBUG] Error creating profile:", createError);
        } else {
          profileData = newProfile;
          console.log("[AUTH_DEBUG] Profile created successfully:", profileData);
        }
      } else if (profileError) {
        console.error("[AUTH_DEBUG] Error fetching profile:", profileError);
      }

      if (profileData) {
        setProfile(profileData);
        setCompanyId(profileData.company_id);
        
        if (profileData.role === 'client') {
          // No need to await or block for global client data
          supabase.from('clients_global').select('*').eq('user_id', userId).single().then(({ error }) => {
            if (error) console.warn("[AUTH_DEBUG] Error fetching global client data (non-blocking):", error);
          });
        }
      }

      if (rolesRes.data) {
        const mappedRoles = rolesRes.data.map((r) => r.role);
        setRoles(mappedRoles);

        const isAdminRole = mappedRoles.some(r => ['super_admin', 'professional', 'collaborator'].includes(r));
        if (isAdminRole && profileData?.id) {
          const { data: collabData } = await supabase
            .from('collaborators')
            .select('id')
            .eq('profile_id', profileData.id)
            .eq('active', true)
            .limit(1);
          
          const hasCollabRecord = !!(collabData && collabData.length > 0);
          setIsAlsoCollaborator(hasCollabRecord);

          if (!hasCollabRecord) {
            setLoginModeState('admin');
          } else if (profileData.last_login_mode) {
            setLoginModeState(profileData.last_login_mode as LoginMode);
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
    const newUser = newSession?.user ?? null;
    
    // Avoid redundant updates if user is the same
    if (newUser?.id === user?.id && !!newUser === !!user && session?.access_token === newSession?.access_token) {
      console.log('[AUTH_CONTEXT] Skipping redundant updateAuthState');
      setLoading(false);
      return;
    }

    console.log('[AUTH_CONTEXT] updateAuthState triggered', { 
      event: 'manual/hook', 
      hasUser: !!newUser,
      userId: newUser?.id 
    });

    try {
      setSession(newSession);
      setUser(newUser);

      if (newUser) {
        if (lastLoadedUserId.current !== newUser.id) {
          lastLoadedUserId.current = newUser.id;
          await fetchUserData(newUser.id, newUser);
        }
      } else {
        lastLoadedUserId.current = null;
        setProfile(null);
        setCompanyId(null);
        setRoles([]);
        setLoginModeState(null);
        setIsAlsoCollaborator(false);
      }
    } catch (error) {
      console.error('[AUTH_CONTEXT] Critical error in updateAuthState:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, session?.access_token, fetchUserData]);


  useEffect(() => {
    let cancelled = false;

    // Rule 6: Initial session fetch
    const initSession = async () => {
      // Safety timeout to never leave the app stuck in loading if getSession hangs
      const timeoutId = setTimeout(() => {
        if (loading) {
          console.warn('[AUTH_CONTEXT] getSession timeout, forcing loading=false');
          setLoading(false);
        }
      }, 8000);

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!cancelled) {
          await updateAuthState(initialSession);
        }
      } catch (err) {
        console.error('[AUTH_CONTEXT] Error in initSession:', err);
        if (!cancelled) setLoading(false);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    initSession();

    // Rule 4: Use onAuthStateChange ONLY for backup initialization (e.g. tab switches)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (cancelled) return;
      console.log(`[AUTH_CONTEXT] onAuthStateChange: ${event}`);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await updateAuthState(currentSession);
      } else if (event === 'SIGNED_OUT') {
        await updateAuthState(null);
      } else if (event === 'INITIAL_SESSION') {
        if (currentSession) {
          await updateAuthState(currentSession);
        } else {
          // If no session but we were loading, stop loading
          setLoading(false);
        }
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

  const isAdmin = useMemo(() => {
    return roles.some(r => ['super_admin', 'professional', 'collaborator'].includes(r));
  }, [roles]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isAuthenticated,
      loading, 
      profile, 
      companyId, 
      roles, 
      isAdmin,
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
