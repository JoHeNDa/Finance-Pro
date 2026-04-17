import { createContext, useContext, useEffect, useState, createElement } from 'react';
import { useOrganization } from './OrganizationContext';

const ThemeContext = createContext();

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '46, 125, 50';
};

const themes = {
  light: {
    '--bg-primary': '#f6f8fb',
    '--bg-secondary': '#ffffff',
    '--card-bg': '#ffffff',
    '--text-primary': '#1f2937',
    '--text-secondary': '#4b5563',
    '--text-muted': '#9ca3af',
    '--border-color': '#e5e7eb',
    '--input-bg': '#ffffff',
    '--hover-bg': '#f1f5f9',
    '--sidebar-bg': '#336d36',
    '--sidebar-text': '#ffffff',
    '--sidebar-text-secondary': 'rgba(255,255,255,0.85)',
    '--sidebar-hover-bg': 'rgba(255, 255, 255, 0.1)',
    '--sidebar-active-bg': 'rgba(255,255,255,0.2)',
    '--sidebar-border': 'rgba(255,255,255,0.1)',
    '--sidebar-footer-bg': 'rgba(0,0,0,0.2)',
    '--sidebar-icon-color': '#ffd700',
    '--button-text': '#ffd700',
    '--button-bg': '#2e7d32',
    '--button-bg-hover': '#2e7d32',
    '--button-bg-hover-rgb': '46, 125, 50',
    '--action-btn-color': '#313131',

    '--topbar-icon-color': '#2e7d32',
    '--primary': '#2e7d32',
    '--primary-dark': '#1b5e20',
    '--primary-rgb': '46, 125, 50',
  },
  dark: {
    '--bg-primary': '#0f0f1a',
    '--bg-secondary': '#171729',
    '--card-bg': '#1a1a2e',
    '--text-primary': '#e9ecef',
    '--text-secondary': '#ced4da',
    '--text-muted': '#adb5bd',
    '--border-color': '#2d2d3a',
    '--input-bg': '#2d2d3a',
    '--hover-bg': '#2d2d3a',
    '--sidebar-bg': '#0f0f1a',
    '--sidebar-text': 'rgba(255,255,255,0.9)',
    '--sidebar-text-secondary': 'rgba(255,255,255,0.7)',
    '--sidebar-hover-bg': 'rgba(255,255,255,0.08)',
    '--sidebar-active-bg': 'rgba(255,255,255,0.12)',
    '--sidebar-border': 'rgba(255,255,255,0.08)',
    '--sidebar-footer-bg': 'rgba(0,0,0,0.3)',
    '--sidebar-icon-color': '#ffd700',
    '--topbar-icon-color': '#ffd700',
    '--button-text': '#ffd700',
    '--button-bg': '#2a312a',
    '--button-bg-hover': '#221c1c4d',
    '--action-btn-color': '#dfdfdf',
    
    '--primary': '#4caf50',
    '--primary-dark': '#388e3c',
    '--primary-rgb': '76, 175, 80',
  },
  green: {
    '--bg-primary': '#f6f8fb',
    '--bg-secondary': '#ffffff',
    '--card-bg': '#ffffff',
    '--text-primary': '#1f2937',
    '--text-secondary': '#4b5563',
    '--text-muted': '#9ca3af',
    '--border-color': '#e5e7eb',
    '--input-bg': '#ffffff',
    '--hover-bg': '#f1f5f9',
    '--sidebar-bg': '#2e7d32',
    '--sidebar-text': '#ffffff',
    '--sidebar-text-secondary': 'rgba(255,255,255,0.85)',
    '--sidebar-hover-bg': 'rgba(255,255,255,0.1)',
    '--sidebar-active-bg': 'rgba(255,255,255,0.2)',
    '--sidebar-border': 'rgba(255,255,255,0.1)',
    '--sidebar-footer-bg': 'rgba(0,0,0,0.2)',
    '--sidebar-icon-color': '#ffd700',
    '--primary': '#2e7d32',
    '--primary-dark': '#1b5e20',
    '--primary-rgb': '46, 125, 50',
  },
};

export function ThemeProvider({ children }) {
  const { organization } = useOrganization();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app-theme');
    // ✅ DEFAULT IS NOW 'dark'
    return saved && themes[saved] ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;

    const themeVars = themes[theme];
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    document.body.setAttribute('data-theme', theme);

    if (organization && organization.theme) {
      const secondary = organization.theme.secondaryColor || '#ffd700';
      root.style.setProperty('--secondary', secondary);
      root.style.setProperty('--secondary-rgb', hexToRgb(secondary));
    } else {
      root.style.setProperty('--secondary', '#ffd700');
      root.style.setProperty('--secondary-rgb', '255, 215, 0');
    }

    root.style.setProperty('--danger-rgb', '198,40,40');
    root.style.setProperty('--gray-700-rgb', '73,80,87');

    localStorage.setItem('app-theme', theme);
  }, [theme, organization]);

  const changeTheme = (newTheme) => {
    if (themes[newTheme]) setTheme(newTheme);
  };

  return createElement(
    ThemeContext.Provider,
    { value: { theme, changeTheme, themes: Object.keys(themes) } },
    children
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}