import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Load user profile whenever the user changes
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
    // Step 1: Try to sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      // If user already exists, attempt to sign in
      if (authError.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw new Error('This email is already registered, but the password is incorrect. Please sign in.');
        }

        // Sign in succeeded – check if profile exists
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', signInData.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }

        if (!profile) {
          // Create organization and user record for this existing auth user
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
              currency_code: currencyCode || 'GBP'
            })
            .select()
            .single();
          if (orgError) throw orgError;

          const { error: userError } = await supabase
            .from('users')
            .insert({
              id: signInData.user.id,
              email: email,
              name: name,
              organization_id: orgData.id,
              role: 'owner',
            });
          if (userError) throw userError;
        }

        return signInData;
      }

      // Other errors
      throw authError;
    }

    // Step 2: New user – wait for auth user to be ready
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

    // Step 3: Call the database function to create organization and user record with customization
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