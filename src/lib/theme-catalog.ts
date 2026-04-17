export type ThemeStyleKey =
  | 'masculino'
  | 'feminino'
  | 'neutro'
  | 'elegante'
  | 'delicado'
  | 'profissional';

export interface ThemeVariation {
  id: string; // ex: "feminino_elegante_1"
  name: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
}

export interface ThemeStyle {
  key: ThemeStyleKey;
  label: string;
  emoji: string;
  description: string;
  variations: ThemeVariation[];
}

export const THEME_STYLES: ThemeStyle[] = [
  {
    key: 'masculino',
    label: 'Masculino',
    emoji: '💈',
    description: 'Visual forte, urbano e contemporâneo',
    variations: [
      {
        id: 'masculino_moderno_1',
        name: 'Moderno',
        description: 'Preto + roxo dark',
        primary_color: '#7C3AED',
        secondary_color: '#A78BFA',
        background_color: '#0B0B14',
      },
      {
        id: 'masculino_classico_1',
        name: 'Clássico',
        description: 'Preto + dourado',
        primary_color: '#D4AF37',
        secondary_color: '#B8860B',
        background_color: '#0F0F0F',
      },
      {
        id: 'masculino_urbano_1',
        name: 'Urbano',
        description: 'Cinza + azul',
        primary_color: '#3B82F6',
        secondary_color: '#1E40AF',
        background_color: '#1F2937',
      },
    ],
  },
  {
    key: 'feminino',
    label: 'Feminino',
    emoji: '🌸',
    description: 'Sofisticado, acolhedor e marcante',
    variations: [
      {
        id: 'feminino_elegante_1',
        name: 'Elegante',
        description: 'Rosa claro + dourado',
        primary_color: '#D4A574',
        secondary_color: '#E8B4C9',
        background_color: '#FDF2F8',
      },
      {
        id: 'feminino_delicado_1',
        name: 'Delicado',
        description: 'Lavanda + branco',
        primary_color: '#A78BFA',
        secondary_color: '#C4B5FD',
        background_color: '#FAF5FF',
      },
      {
        id: 'feminino_premium_1',
        name: 'Premium',
        description: 'Nude + champagne',
        primary_color: '#C9A789',
        secondary_color: '#E0C9A6',
        background_color: '#FAF7F2',
      },
    ],
  },
  {
    key: 'neutro',
    label: 'Neutro',
    emoji: '⚪',
    description: 'Atende a todos os públicos',
    variations: [
      {
        id: 'neutro_minimalista_1',
        name: 'Minimalista',
        description: 'Cinza + branco',
        primary_color: '#374151',
        secondary_color: '#6B7280',
        background_color: '#FFFFFF',
      },
      {
        id: 'neutro_profissional_1',
        name: 'Profissional',
        description: 'Azul + branco',
        primary_color: '#2563EB',
        secondary_color: '#3B82F6',
        background_color: '#F8FAFC',
      },
      {
        id: 'neutro_clean_1',
        name: 'Clean',
        description: 'Bege + off-white',
        primary_color: '#8B7355',
        secondary_color: '#A89078',
        background_color: '#FAF8F3',
      },
    ],
  },
  {
    key: 'elegante',
    label: 'Elegante',
    emoji: '✨',
    description: 'Premium, refinado e exclusivo',
    variations: [
      {
        id: 'elegante_preto_dourado_1',
        name: 'Preto & Dourado',
        description: 'Luxuoso',
        primary_color: '#D4AF37',
        secondary_color: '#FFD700',
        background_color: '#0A0A0A',
      },
      {
        id: 'elegante_branco_dourado_1',
        name: 'Branco & Dourado',
        description: 'Sofisticado',
        primary_color: '#B8860B',
        secondary_color: '#D4AF37',
        background_color: '#FFFEF7',
      },
      {
        id: 'elegante_azul_prata_1',
        name: 'Azul & Prata',
        description: 'Imponente',
        primary_color: '#94A3B8',
        secondary_color: '#CBD5E1',
        background_color: '#0F172A',
      },
    ],
  },
  {
    key: 'delicado',
    label: 'Delicado',
    emoji: '🌷',
    description: 'Suave, leve e acolhedor',
    variations: [
      {
        id: 'delicado_rosa_1',
        name: 'Rosa Pastel',
        description: 'Suave e romântico',
        primary_color: '#F9A8D4',
        secondary_color: '#FBCFE8',
        background_color: '#FFF1F5',
      },
      {
        id: 'delicado_lavanda_1',
        name: 'Lavanda',
        description: 'Tranquilo',
        primary_color: '#C4B5FD',
        secondary_color: '#DDD6FE',
        background_color: '#F5F3FF',
      },
      {
        id: 'delicado_pessego_1',
        name: 'Pêssego',
        description: 'Quente e gentil',
        primary_color: '#FDBA74',
        secondary_color: '#FED7AA',
        background_color: '#FFF7ED',
      },
    ],
  },
  {
    key: 'profissional',
    label: 'Profissional',
    emoji: '💼',
    description: 'Sério, confiável e corporativo',
    variations: [
      {
        id: 'profissional_azul_1',
        name: 'Azul Corporativo',
        description: 'Confiança',
        primary_color: '#1E40AF',
        secondary_color: '#3B82F6',
        background_color: '#F1F5F9',
      },
      {
        id: 'profissional_verde_1',
        name: 'Verde Corporativo',
        description: 'Crescimento',
        primary_color: '#047857',
        secondary_color: '#10B981',
        background_color: '#F0FDF4',
      },
      {
        id: 'profissional_cinza_1',
        name: 'Cinza Corporativo',
        description: 'Sobriedade',
        primary_color: '#475569',
        secondary_color: '#64748B',
        background_color: '#F8FAFC',
      },
    ],
  },
];

export function findVariationById(id: string | null | undefined): ThemeVariation | null {
  if (!id) return null;
  for (const style of THEME_STYLES) {
    const v = style.variations.find((x) => x.id === id);
    if (v) return v;
  }
  return null;
}
