/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    tint: '#208AEF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tint: '#208AEF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Paleta pastel usada en botones y tarjetas. Cada color trae una superficie
 * clara (para tarjetas), un tono solido (para botones pulsables) y un texto
 * oscuro del mismo matiz, que mantiene el contraste por encima de 7:1 sobre
 * cualquiera de los dos fondos.
 */
export const Pastel = {
  azul: { superficie: '#EAF2FE', solido: '#CFE0FA', texto: '#1D4E89' },
  verde: { superficie: '#E6F5EC', solido: '#C9E7D5', texto: '#1B6B45' },
  ambar: { superficie: '#FDF2E3', solido: '#F8E3C4', texto: '#8A5514' },
  rojo: { superficie: '#FDEBEB', solido: '#F8D5D5', texto: '#992E2E' },
  violeta: { superficie: '#F1ECFB', solido: '#DFD5F6', texto: '#553C9A' },
  teal: { superficie: '#E4F4F3', solido: '#C9E7E5', texto: '#146B67' },
  rosa: { superficie: '#FDEDF4', solido: '#F8D8E6', texto: '#9B2F5C' },
  neutro: { superficie: '#F1F1F4', solido: '#E4E4EA', texto: '#3C4048' },
} as const;

export type NombrePastel = keyof typeof Pastel;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
