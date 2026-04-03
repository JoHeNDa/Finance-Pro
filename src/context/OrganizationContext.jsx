import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const OrganizationContext = createContext();

export function OrganizationProvider({ children }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setOrganization(null);
      return;
    }
    loadOrganization();
  }, [user]);

  const loadOrganization = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user:', userError);
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!userData?.organization_id) {
        console.log('No organization ID found for user');
        setLoading(false);
        return;
      }

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userData.organization_id)
        .single();

      if (orgError) {
        console.error('Error fetching organization:', orgError);
        setError(orgError.message);
        setLoading(false);
        return;
      }

      console.log('Organization loaded:', orgData);
      setOrganization(orgData);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async (updates) => {
    if (!organization?.id) {
      throw new Error('No organization found');
    }

    console.log('Updating organization:', organization.id);
    console.log('Updates:', updates);

    try {
      const updateData = {
        name: updates.name,
        logo_url: updates.logo_url || null,
        theme: updates.theme,
        vat_rate: updates.vat_rate,
        currency_symbol: updates.currency_symbol,
        currency_code: updates.currency_code,
        settings: updates.settings,
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });

      const { error: updateError } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', organization.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      console.log('Update successful, fetching fresh data...');

      const { data: freshData, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organization.id)
        .single();

      if (fetchError) {
        console.error('Error fetching updated organization:', fetchError);
        throw fetchError;
      }

      console.log('Fresh organization data:', freshData);
      setOrganization(freshData);

      return freshData;
    } catch (err) {
      console.error('Update error details:', err);
      throw err;
    }
  };

  const refresh = async () => {
    await loadOrganization();
  };

  return (
    <OrganizationContext.Provider value={{
      organization,
      loading,
      error,
      updateOrganization,
      refresh,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}