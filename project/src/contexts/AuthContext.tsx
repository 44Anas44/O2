import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState } from
'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { profileFromRow } from '../lib/mappers';
import { can as canDo, type Permission } from '../lib/permissions';
import type { Profile, Role } from '../types';

/**
 * - loading  : session ou profil en cours de chargement
 * - ready    : profil actif, l'application peut s'afficher
 * - missing  : connecté mais aucun profil (e-mail non invité)
 * - inactive : compte désactivé par un administrateur
 */
export type AccessStatus = 'loading' | 'ready' | 'missing' | 'inactive';

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  role: Role | null;
  /** id du propriétaire du centre : porte toutes les données. */
  ownerId: string | null;
  /** Nom affiché (nom complet, sinon e-mail). */
  displayName: string;
  access: AccessStatus;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<{error: string | null;}>;
  signUp: (email: string, password: string) => Promise<{error: string | null;}>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const { data } = await supabase.
    from('profiles').
    select('*').
    eq('id', userId).
    maybeSingle();
    setProfile(data ? profileFromRow(data) : null);
    setProfileLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    loadProfile();
  }, [userId, loadProfile]);

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthValue['signUp'] = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const access: AccessStatus = useMemo(() => {
    if (loading || profileLoading) return 'loading';
    if (!session) return 'loading';
    if (!profile) return 'missing';
    if (!profile.active) return 'inactive';
    return 'ready';
  }, [loading, profileLoading, session, profile]);

  const role = access === 'ready' ? profile?.role ?? null : null;

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      profile,
      role,
      ownerId: access === 'ready' ? profile?.ownerId ?? null : null,
      displayName: profile?.fullName || profile?.email || session?.user.email || '',
      access,
      can: (permission) => canDo(role, permission),
      signIn,
      signUp,
      signOut,
      refreshProfile: loadProfile
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, loading, profile, role, access, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l’intérieur de AuthProvider');
  }
  return context;
}
