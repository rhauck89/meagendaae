import { useEffect, useMemo } from 'react';

export interface CompanyBranding {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
}

const DEFAULT_DARK: CompanyBranding = {
  primaryColor: '#F59E0B',
  secondaryColor: '#D97706',
  backgroundColor: '#0B132B',
};

const DEFAULT_LIGHT: CompanyBranding = {
  primaryColor: '#D97706',
  secondaryColor: '#B45309',
  backgroundColor: '#FFF7ED',
};

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function getCompanyBranding(
  settings: { primary_color?: string; secondary_color?: string; background_color?: string } | null,
  isDark: boolean
): CompanyBranding {
  const defaults = isDark ? DEFAULT_DARK : DEFAULT_LIGHT;
  if (!settings) return defaults;

  return {
    primaryColor: isValidHex(settings.primary_color || '') ? settings.primary_color! : defaults.primaryColor,
    secondaryColor: isValidHex(settings.secondary_color || '') ? settings.secondary_color! : defaults.secondaryColor,
    backgroundColor: isValidHex(settings.background_color || '') ? settings.background_color! : defaults.backgroundColor,
  };
}

export function buildThemeFromBranding(branding: CompanyBranding, isDark: boolean) {
  const { primaryColor, secondaryColor, backgroundColor } = branding;
  
  // Derive card/border/text colors from background
  const card = isDark ? lighten(backgroundColor, 15) : '#FFFFFF';
  const border = isDark ? lighten(backgroundColor, 25) : '#E5E7EB';
  const text = isDark ? '#FFFFFF' : '#1F2937';
  const textSec = isDark ? '#9CA3AF' : '#6B7280';

  return {
    bg: backgroundColor,
    card,
    accent: primaryColor,
    accentHover: secondaryColor,
    text,
    textSec,
    border,
  };
}

export function useApplyBranding(branding: CompanyBranding | null) {
  useEffect(() => {
    if (!branding) return;
    const root = document.documentElement;
    if (isValidHex(branding.primaryColor)) {
      root.style.setProperty('--brand-primary', branding.primaryColor);
      root.style.setProperty('--brand-primary-hsl', hexToHsl(branding.primaryColor));
    }
    if (isValidHex(branding.secondaryColor)) {
      root.style.setProperty('--brand-secondary', branding.secondaryColor);
    }
    if (isValidHex(branding.backgroundColor)) {
      root.style.setProperty('--brand-bg', branding.backgroundColor);
    }
    return () => {
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-primary-hsl');
      root.style.removeProperty('--brand-secondary');
      root.style.removeProperty('--brand-bg');
    };
  }, [branding]);
}
