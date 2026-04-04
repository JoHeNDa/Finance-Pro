import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Original auth listener (unchanged)
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

  // Enhanced profile loading with avatar_url (safe)
  useEffect(() => {
    async function loadProfile() {
      if (user) {
        // Load base user data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (userError) {
          console.error('Error loading user profile:', userError);
          setUserProfile(null);
          return;
        }
        
        // Load avatar_url from user_profiles (if exists)
        let avatar_url = null;
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .maybeSingle();
          if (!profileError && profileData) {
            avatar_url = profileData.avatar_url;
          }
        } catch (err) {
          // Silently ignore
        }
        
        setUserProfile({ ...userData, avatar_url });
      } else {
        setUserProfile(null);
      }
    }
    loadProfile();
  }, [user]);

  // Refresh function (call after any profile update)
  const refreshProfile = async () => {
    if (!user?.id) return;
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    if (userError) return;
    let avatar_url = null;
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (profileData) avatar_url = profileData.avatar_url;
    } catch (err) {}
    setUserProfile({ ...userData, avatar_url });
  };

  // ========== YOUR ORIGINAL signUp, signIn, signOut GO HERE ==========
  // (copy them exactly from your working original – no changes needed)
  const signUp = async (email, password, name, organizationName, logoUrl, primaryColor, secondaryColor, vatRate, currencySymbol, currencyCode) => {
    // ... your original signUp code ...
  };

  const signIn = async (email, password) => {
    // ... your original signIn code ...
  };

  const signOut = async () => {
    // ... your original signOut code ...
  };
  // ========== END ORIGINAL FUNCTIONS ==========

  const value = {
    user,
    userProfile,
    session,
    loading,
    refreshProfile,
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