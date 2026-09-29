import { Pressable, StyleSheet, type PressableProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Pastel, Spacing, type NombrePastel } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primario' | 'secundario' | 'peligro';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  /** Matiz pastel. Por defecto se deduce del `variant`. */
  tono?: NombrePastel;
  loading?: boolean;
  compacto?: boolean;
  style?: PressableProps['style'];
}

const TONO_POR_VARIANTE: Record<ButtonVariant, NombrePastel> = {
  primario: 'azul',
  secundario: 'neutro',
  peligro: 'rojo',
};

export function Button({
  title,
  variant = 'primario',
  tono,
  loading,
  compacto,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();

  const color = Pastel[tono ?? TONO_POR_VARIANTE[variant]];

  const fondo = variant === 'secundario' ? theme.backgroundElement : color.solido;
  const colorTexto = variant === 'secundario' ? theme.text : color.texto;

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        compacto && styles.compacto,
        { backgroundColor: fondo },
        pressed && styles.press,
        (disabled || loading) && styles.deshabilitado,
      ]}
      {...rest}>
      <ThemedText type="smallBold" style={{ color: colorTexto }}>
        {loading ? 'Cargando…' : title}
      </ThemedText>
    </Pressable>
  );
}

export function FilaBoton({ children }: { children: React.ReactNode }) {
  return <View style={styles.fila}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compacto: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
  },
  fila: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  press: { opacity: 0.8 },
  deshabilitado: { opacity: 0.5 },
});
