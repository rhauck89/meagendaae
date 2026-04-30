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
    const withTimeout = async <T,>(promise: Promise<T>, fallback: T, ms = 6000): Promise<T> => {
      try {
        return await Promise.race([
          promise,
          new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
        ]);
      } catch (error) {
        console.error('[AUTH_CONTEXT] Timed query failed:', error);
        return fallback;
      }
    };

    try {
      console.log("[AUTH_DEBUG] Fetching context for user:", userId);

      // Rule: Use the new centralized RPC for consistent user state
      console.log("[AUTH_CONTEXT_DIAG] Fetching context for user:", userId);
      setLoading(true);

      const { data: context, error: contextError } = await withTimeout(
        supabase.rpc('get_current_user_context' as any) as any,
        { data: null, error: { message: 'get_current_user_context timeout' } } as any
      );

      console.log("[AUTH_CONTEXT_DIAG] rpc data:", context);
      console.log("[AUTH_CONTEXT_DIAG] rpc error:", contextError);

      if (contextError) {
        console.error("[AUTH_DEBUG] RPC error fetching user context:", contextError);
        // Fallback to minimal profile if RPC fails
        const { data: profileData } = await withTimeout(
          supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle() as any,
          { data: null, error: { message: 'profile fallback timeout' } } as any
        );
        if (profileData) {
          setProfile(profileData);
          setCompanyId(profileData.company_id);
          console.log("[AUTH_CONTEXT_DIAG] setCompanyId (fallback):", profileData.company_id);
        }
        setLoading(false);
        return;
      }

      const ctx = Array.isArray(context) ? context[0] : context;
      console.log("[AUTH_CONTEXT_DIAG] ctx calculated:", ctx);

      if (!ctx) {
        console.warn("[AUTH_DEBUG] RPC returned empty context for user:", userId);
        
        // Auto-create profile if missing
        const { data: newProfile, error: createError } = await withTimeout(
          supabase
            .from('profiles')
            .insert({ 
              user_id: userId,
              full_name: authUser?.user_metadata?.full_name || null 
            })
            .select()
            .maybeSingle() as any,
          { data: null, error: { message: 'profile creation timeout' } } as any
        );

        if (newProfile) {
          setProfile(newProfile);
          // Retry context after creation
          const { data: retryContext } = await withTimeout(
            supabase.rpc('get_current_user_context' as any) as any,
            { data: null, error: null } as any
          );
          const retryCtx = Array.isArray(retryContext) ? retryContext[0] : retryContext;
          if (retryCtx) {
            console.log("[AUTH_CONTEXT_DIAG] retry ctx:", retryCtx);
            setProfile(prev => ({ ...prev, ...retryCtx }));
            setCompanyId(retryCtx.company_id);
            setRoles(retryCtx.roles || []);
            setIsAlsoCollaborator(retryCtx.is_collaborator || false);
            setLoginModeState(retryCtx.login_mode as LoginMode || (retryCtx.is_collaborator ? null : 'admin'));
            console.log("[AUTH_CONTEXT_DIAG] setCompanyId (retry):", retryCtx.company_id);
          }
        }
        setLoading(false);
        return;
      }

      console.log("[AUTH_CONTEXT_DIAG] Mapping context to state. company_id:", ctx.company_id);
      
      // Rule 1: Manual mapping of flat RPC fields to profile object
      setProfile({
        id: ctx.profile_id,
        user_id: ctx.user_id,
        full_name: ctx.full_name,
        email: ctx.email,
        company_id: ctx.company_id,
        last_login_mode: ctx.login_mode
      });
      
      setCompanyId(ctx.company_id);
      setRoles(ctx.roles || []);
      setLoginModeState(ctx.login_mode || null);
      setIsAlsoCollaborator(ctx.is_collaborator || false);
      
      console.log("[AUTH_CONTEXT_DIAG] State updated:", {
        companyId: ctx.company_id,
        roles: ctx.roles,
        loginMode: ctx.login_mode
      });

      setLoading(false);

    } catch (error) {
      console.error('[AUTH_CONTEXT] Critical error fetching user data:', error);
    }
  }, []);

  const updateAuthState = useCallback(async (newSession: Session | null) => {
    const newUser = newSession?.user ?? null;
    
    // Rule 2: Only skip if user is same AND context is already hydrated
    const contextHydrated = !!profile || !!companyId || roles.length > 0;
    const isSameUser = newUser?.id === user?.id && !!newUser === !!user;
    const isSameToken = session?.access_token === newSession?.access_token;

    if (isSameUser && isSameToken && contextHydrated) {
      console.log('[AUTH_CONTEXT] Skipping redundant updateAuthState (already hydrated)');
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
        // Rule 2: Fetch if ID changed OR context is missing
        const contextHydrated = !!profile || !!companyId || roles.length > 0;
        if (lastLoadedUserId.current !== newUser.id || !contextHydrated) {
          console.log('[AUTH_CONTEXT] Fetching user data (id change or missing hydration)');
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
