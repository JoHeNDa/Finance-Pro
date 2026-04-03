import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const OrganizationContext = createContext();

export function OrganizationProvider({ children }) {
  const { user, userProfile } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const darkenColor = (hex, percent = 20) => {
    if (!hex || hex === '#') return '#1b5e20';
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, r * (1 - percent / 100));
    g = Math.max(0, g * (1 - percent / 100));
    b = Math.max(0, b * (1 - percent / 100));
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '46, 125, 50';
  };

  useEffect(() => {
    const root = document.documentElement;
    if (organization) {
      const primary = organization.theme?.primaryColor || '#2e7d32';
      const secondary = organization.theme?.secondaryColor || '#ffd700';
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--primary-dark', darkenColor(primary, 20));
      root.style.setProperty('--secondary', secondary);
      root.style.setProperty('--primary-rgb', hexToRgb(primary));
      root.style.setProperty('--secondary-rgb', hexToRgb(secondary));
    } else {
      root.style.setProperty('--primary', '#2e7d32');
      root.style.setProperty('--primary-dark', '#1b5e20');
      root.style.setProperty('--secondary', '#ffd700');
      root.style.setProperty('--primary-rgb', '46, 125, 50');
      root.style.setProperty('--secondary-rgb', '255, 215, 0');
    }
  }, [organization]);

  // Load organization whenever user or userProfile changes (especially when organization_id appears)
  useEffect(() => {
    async function loadOrganization() {
      if (!user) {
        setOrganization(null);
        setLoading(false);
        return;
      }

      let orgId = userProfile?.organization_id;
      if (!orgId) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        if (userError) {
          console.error('Error fetching user organization_id:', userError);
          setOrganization(null);
          setLoading(false);
          return;
        }
        orgId = userData?.organization_id;
      }

      if (!orgId) {
        setOrganization(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      if (orgError) {
        console.error('Error fetching organization:', orgError);
        setError(orgError.message);
        setOrganization(null);
      } else {
        setOrganization(orgData);
      }
      setLoading(false);
    }

    loadOrganization();
  }, [user, userProfile]); // Re-run when userProfile changes (important for signup)

  const updateOrganization = async (updates) => {
    if (!organization?.id) throw new Error('No organization found');
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
      if (updateError) throw updateError;
      const { data: freshData, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organization.id)
        .single();
      if (fetchError) throw fetchError;
      setOrganization(freshData);
      return freshData;
    } catch (err) {
      console.error('Update error:', err);
      throw err;
    }
  };

  const refresh = async () => {
    if (userProfile?.organization_id) {
      const { data: orgData, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userProfile.organization_id)
        .single();
      if (!error) setOrganization(orgData);
    }
  };

  return (
    <OrganizationContext.Provider value={{ organization, loading, error, updateOrganization, refresh }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
}