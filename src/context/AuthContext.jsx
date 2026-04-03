import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error loading user profile:', error);
          setUserProfile(null);
        } else {
          setUserProfile(data);
        }
      } else {
        setUserProfile(null);
      }
    }
    loadProfile();
  }, [user]);

  const signUp = async (email, password, name, organizationName, logoUrl, primaryColor, secondaryColor, vatRate, currencySymbol, currencyCode) => {
    // 1. Prevent duplicate emails
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existingUser) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) throw authError;

    // 3. Wait for auth user to be ready
    let userReady = false;
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: checkUser } = await supabase.auth.getUser();
      if (checkUser?.user) {
        userReady = true;
        break;
      }
    }
    if (!userReady) throw new Error('Auth user not ready after signup');

    // 4. Create organization and user record (RPC with fallback)
    let orgId = null;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_organization_and_user', {
        org_name: organizationName,
        user_id: authData.user.id,
        user_email: email,
        user_name: name,
        org_logo_url: logoUrl || null,
        org_primary_color: primaryColor || '#2e7d32',
        org_secondary_color: secondaryColor || '#ffd700',
        org_vat_rate: vatRate || 20,
        org_currency_symbol: currencySymbol || '£',
        org_currency_code: currencyCode || 'GBP',
      });
      if (rpcError) throw rpcError;
      orgId = rpcData?.organization_id;
    } catch (rpcErr) {
      console.error('RPC failed, falling back to manual creation:', rpcErr);
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: organizationName,
          logo_url: logoUrl || null,
          theme: {
            primaryColor: primaryColor || '#2e7d32',
            secondaryColor: secondaryColor || '#ffd700',
            accentColor: primaryColor === '#2e7d32' ? '#4caf50' : primaryColor,
            fontFamily: 'Inter'
          },
          vat_rate: vatRate || 20,
          currency_symbol: currencySymbol || '£',
          currency_code: currencyCode || 'GBP',
        })
        .select()
        .single();
      if (orgError) throw orgError;
      orgId = orgData.id;

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          name: name,
          organization_id: orgId,
          role: 'owner',
        });
      if (userError) throw userError;
    }

    // 5. Poll until userProfile is loaded and update state
    let profileLoaded = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      if (profile && profile.organization_id) {
        setUserProfile(profile);
        profileLoaded = true;
        break;
      }
    }
    if (!profileLoaded) {
      console.warn('User profile not found after signup');
    }

    return authData;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    userProfile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}