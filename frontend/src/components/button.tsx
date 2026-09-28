import { Pressable, StyleSheet, type PressableProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primario' | 'secundario' | 'peligro';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  compacto?: boolean;
  style?: PressableProps['style'];
}

export function Button({
  title,
  variant = 'primario',
  loading,
  compacto,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();

  const fondo =
    variant === 'primario'
      ? theme.tint
      : variant === 'peligro'
        ? '#DC2626'
        : theme.backgroundElement;

  const color = variant === 'secundario' ? theme.text : '#fff';

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
      <ThemedText type="smallBold" style={{ color }}>
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
