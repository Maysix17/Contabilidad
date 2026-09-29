import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType =
  | 'default'
  | 'title'
  | 'small'
  | 'smallBold'
  | 'subtitle'
  | 'valor'
  | 'h2'
  | 'eyebrow'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'valor' && styles.valor,
        type === 'h2' && styles.h2,
        type === 'eyebrow' && styles.eyebrow,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * Escala unica para toda la app. Antes `subtitle` valia 32 px y se usaba tanto
 * para el titulo de pantalla como para las cifras de las tarjetas, y eso hacia
 * que un monto como $ 12.480.000 no entrara en una tarjeta de media pantalla.
 * La jerarquia va de `valor` (cifra protagonista) a `eyebrow` (rotulo de
 * seccion), con `subtitle` como titulo de pantalla.
 */
const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  valor: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
