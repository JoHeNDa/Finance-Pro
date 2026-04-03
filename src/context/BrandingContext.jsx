import { createContext, useContext, useEffect, useState } from 'react';
import { useOrganization } from './OrganizationContext';

const BrandingContext = createContext();

export function BrandingProvider({ children }) {
  const { organization } = useOrganization();
  const [branding, setBranding] = useState({
    logo: null,
    favicon: null,
    secondaryColor: '#ffd700',
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: 16,
    },
    tagline: '',
  });

  useEffect(() => {
    if (organization) {
      setBranding({
        logo: organization.logo_url || null,
        favicon: organization.favicon_url || null,
        secondaryColor: organization.theme?.secondaryColor || '#ffd700',
        typography: organization.theme?.typography || {
          headingFont: 'Inter',
          bodyFont: 'Inter',
          baseSize: 16,
        },
        tagline: organization.tagline || '',
      });
      
      // Apply CSS variables dynamically (only secondary color)
      const root = document.documentElement;
      root.style.setProperty('--secondary', branding.secondaryColor);
      root.style.setProperty('--font-heading', branding.typography.headingFont);
      root.style.setProperty('--font-body', branding.typography.bodyFont);
      root.style.setProperty('--base-size', `${branding.typography.baseSize}px`);
      
      // Update favicon if provided
      if (organization.favicon_url) {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = organization.favicon_url;
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    }
  }, [organization]);

  return (
    <BrandingContext.Provider value={{ branding, organization }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}