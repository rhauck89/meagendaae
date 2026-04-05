import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: any | null;
  companyId: string | null;
  roles: string[];
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

  const fetchUserData = async (userId: string) => {
    console.log('[AuthContext] Fetching user data for userId:', userId);
    
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    console.log('[AuthContext] Profile response:', profileRes.data, profileRes.error);
    console.log('[AuthContext] Profile role field:', profileRes.data?.role);
    console.log('[AuthContext] user_roles response:', rolesRes.data, rolesRes.error);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setCompanyId(profileRes.data.company_id);
    }

    if (rolesRes.data) {
      const mappedRoles = rolesRes.data.map((r) => r.role);
      console.log('[AuthContext] Mapped roles from user_roles table:', mappedRoles);
      setRoles(mappedRoles);
    } else {
      console.warn('[AuthContext] No roles found in user_roles table for user:', userId);
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
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(async () => {
            if (cancelled) return;
            await fetchUserData(session.user.id);
            if (!cancelled) setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setCompanyId(null);
          setRoles([]);
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
    <AuthContext.Provider value={{ user, session, loading, profile, companyId, roles, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
