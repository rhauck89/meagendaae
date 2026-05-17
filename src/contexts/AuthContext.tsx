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
  permissions: any;
  isAlsoCollaborator: boolean;
  isServiceProvider: boolean;
  isAdmin: boolean;
  isOwner: boolean;
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
  permissions: {},
  isAlsoCollaborator: false,
  isServiceProvider: false,
  isAdmin: false,
  isOwner: false,
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
  const [permissions, setPermissions] = useState<any>({});
  const [isAlsoCollaborator, setIsAlsoCollaborator] = useState(false);
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const authLockRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef({
    userId: null as string | null,
    token: null as string | null,
    profile: null as any | null,
    companyId: null as string | null,
    roles: [] as string[],
    loginMode: null as LoginMode,
    permissions: {} as any,
    hasContext: false
  });

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

    const recoverCompanyId = async (profileId?: string | null) => {
      const { data: companiesData } = await withTimeout(
        supabase.rpc('get_user_companies' as any) as any,
        { data: [], error: null } as any,
        4500
      );

      const companyFromMembership = Array.isArray(companiesData) && companiesData.length > 0
        ? companiesData[0]?.company_id
        : null;

      if (companyFromMembership) {
        await withTimeout(
          supabase.rpc('switch_active_company' as any, { _company_id: companyFromMembership }) as any,
          { data: null, error: null } as any,
          4500
        );
        return companyFromMembership as string;
      }

      const [ownedRes, roleRes, collaboratorRes] = await Promise.all([
        withTimeout(
          supabase
            .from('companies')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle() as any,
          { data: null, error: null } as any,
          4500
        ),
        withTimeout(
          supabase
            .from('user_roles' as any)
            .select('company_id')
            .eq('user_id', userId)
            .not('company_id', 'is', null)
            .limit(1)
            .maybeSingle() as any,
          { data: null, error: null } as any,
          4500
        ),
        profileId
          ? withTimeout(
              supabase
                .from('collaborators')
                .select('company_id')
                .eq('profile_id', profileId)
                .eq('active', true)
                .limit(1)
                .maybeSingle() as any,
              { data: null, error: null } as any,
              4500
            )
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      const recoveredCompanyId =
        ownedRes.data?.id ||
        roleRes.data?.company_id ||
        collaboratorRes.data?.company_id ||
        null;

      if (recoveredCompanyId) {
        await withTimeout(
          supabase
            .from('profiles')
            .update({ company_id: recoveredCompanyId })
            .eq('user_id', userId) as any,
          { data: null, error: null } as any,
          4500
        );
      }

      return recoveredCompanyId as string | null;
    };

    try {
      console.log("[AUTH_DEBUG] Fetching context for user:", userId);

      // Rule: Use the new centralized RPC for consistent user state
      console.log("[AUTH_CONTEXT_DIAG] Fetching context for user:", userId);
      // Only set loading if not already hydrated to prevent flickering on updates
      if (!stateRef.current.hasContext) {
        setLoading(true);
      }

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
          const recoveredCompanyId = profileData.company_id || await recoverCompanyId(profileData.id);
          setProfile(profileData);
          setCompanyId(recoveredCompanyId);
          console.log("[AUTH_CONTEXT_DIAG] setCompanyId (fallback):", recoveredCompanyId);
        }
        setLoading(false);
        return;
      }

      let ctx = Array.isArray(context) ? context[0] : context;
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
          // Retry context after creation
          const { data: retryContext } = await withTimeout(
            supabase.rpc('get_current_user_context' as any) as any,
            { data: null, error: null } as any
          );
          const retryCtx = Array.isArray(retryContext) ? retryContext[0] : retryContext;
          if (retryCtx) {
            ctx = retryCtx; // Use the retried context
          } else {
            setProfile(newProfile);
            setLoading(false);
            return;
          }
        } else {
          setLoading(false);
          return;
        }
      }

      if (!ctx.company_id) {
        const recoveredCompanyId = await recoverCompanyId(ctx.profile_id);
        if (recoveredCompanyId) {
          console.log("[AUTH_CONTEXT_DIAG] company_id recovered from membership:", recoveredCompanyId);
          ctx = { ...ctx, company_id: recoveredCompanyId };
        }
      }

      console.log("[AUTH_CONTEXT_DIAG] Mapping context to state. company_id:", ctx.company_id);
      
      const mappedProfile = {
        id: ctx.profile_id,
        user_id: ctx.user_id,
        full_name: ctx.full_name,
        email: ctx.email,
        company_id: ctx.company_id,
        last_login_mode: ctx.login_mode,
        permissions: ctx.permissions || {},
        system_role: ctx.system_role
      };

      const isSuperAdmin = ctx.roles?.includes('super_admin');
      const isOwner = ctx.is_company_owner || ctx.is_owner || false;
      const isAdminPrincipal = ctx.system_role === 'admin_principal' || ctx.system_role === 'admin';
      const isServiceProvider = ctx.is_service_provider === true;
      const isStaff = ctx.roles?.some((r: string) => ['collaborator', 'admin', 'recepcionista', 'gerente', 'atendente'].includes(r));
      
      let normalizedLoginMode = ctx.login_mode;
      
      // Principal rule: Owners and main admins always stay in admin mode by default
      if (!normalizedLoginMode && (isOwner || isSuperAdmin || isAdminPrincipal)) {
        normalizedLoginMode = 'admin';
      } else if (!isServiceProvider && (isStaff || ctx.system_role)) {
        normalizedLoginMode = 'admin';
      } else if (!normalizedLoginMode && isServiceProvider) {
        normalizedLoginMode = 'professional';
      }

      // Comparison logic to prevent redundant state updates
      const profileChanged = JSON.stringify(stateRef.current.profile) !== JSON.stringify(mappedProfile);
      const companyChanged = stateRef.current.companyId !== ctx.company_id;
      const rolesChanged = JSON.stringify(stateRef.current.roles) !== JSON.stringify(ctx.roles || []);
      const loginModeChanged = stateRef.current.loginMode !== normalizedLoginMode;
      const permissionsChanged = JSON.stringify(stateRef.current.permissions) !== JSON.stringify(ctx.permissions || {});

      if (profileChanged) {
        setProfile(mappedProfile);
        stateRef.current.profile = mappedProfile;
      }
      
      if (companyChanged) {
        setCompanyId(ctx.company_id);
        stateRef.current.companyId = ctx.company_id;
      }
      
      if (rolesChanged) {
        setRoles(ctx.roles || []);
        stateRef.current.roles = ctx.roles || [];
      }
      
      if (loginModeChanged) {
        setLoginModeState(normalizedLoginMode);
        stateRef.current.loginMode = normalizedLoginMode;
      }

      if (permissionsChanged) {
        setPermissions(ctx.permissions || {});
        stateRef.current.permissions = ctx.permissions || {};
      }
      
      const isOwnerNow = ctx.is_company_owner || ctx.is_owner || false;
      setIsAlsoCollaborator(Boolean(ctx.is_collaborator && isServiceProvider));
      setIsServiceProvider(isServiceProvider);
      setIsOwner(isOwnerNow);
      stateRef.current.hasContext = true;

      console.log("[AUTH_CONTEXT_DIAG] State updated successfully. Changed:", { profileChanged, companyChanged, rolesChanged });
      setLoading(false);

    } catch (error) {
      console.error('[AUTH_CONTEXT] Critical error fetching user data:', error);
    }
  }, []);

  const updateAuthState = useCallback(async (newSession: Session | null) => {
    // Acquire sequential lock
    const currentLock = authLockRef.current;
    let resolveLock: () => void;
    authLockRef.current = new Promise((res) => { resolveLock = res; });
    await currentLock;

    try {
      const newUser = newSession?.user ?? null;
      const newToken = newSession?.access_token ?? null;
      
      const isSameUser = newUser?.id === stateRef.current.userId;
      const isSameToken = newToken === stateRef.current.token;
      const alreadyHydrated = stateRef.current.hasContext && !!stateRef.current.profile;

      if (isSameUser && isSameToken && alreadyHydrated) {
        console.log('[AUTH_CONTEXT] Redundant update skipped (already hydrated)');
        setLoading(false);
        return;
      }

      console.log('[AUTH_CONTEXT] updateAuthState processing:', { 
        userId: newUser?.id,
        isSameUser,
        isSameToken,
        alreadyHydrated
      });

      setSession(newSession);
      setUser(newUser);
      stateRef.current.userId = newUser?.id ?? null;
      stateRef.current.token = newToken;

      if (newUser) {
        await fetchUserData(newUser.id, newUser);
      } else {
        console.log('[AUTH_CONTEXT] Clearing state (signed out)');
        stateRef.current.hasContext = false;
        stateRef.current.profile = null;
        stateRef.current.companyId = null;
        stateRef.current.roles = [];
        stateRef.current.loginMode = null;
        setProfile(null);
        setCompanyId(null);
        setRoles([]);
        setLoginModeState(null);
        setPermissions({});
        setIsAlsoCollaborator(false);
        setIsServiceProvider(false);
        setIsOwner(false);
      }
    } catch (error) {
      console.error('[AUTH_CONTEXT] Error in updateAuthState:', error);
    } finally {
      setLoading(false);
      resolveLock!();
    }
  }, [fetchUserData]);


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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (cancelled) return;
      console.log(`[AUTH_CONTEXT] onAuthStateChange event: ${event}`);
      
      // Schedule the state update to avoid "lock theft" in Supabase Auth
      if (event === 'SIGNED_OUT') {
        setTimeout(() => void updateAuthState(null), 0);
      } else if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
        setTimeout(() => void updateAuthState(currentSession), 0);
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
    setIsOwner(false);
    setIsServiceProvider(false);
    
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
      isOwner,
      isServiceProvider,
      loginMode, 
      setLoginMode, 
      permissions,
      isAlsoCollaborator, 
      signOut, 
      refreshProfile,
      updateAuthState
    }}>
      {children}
    </AuthContext.Provider>
  );
};
