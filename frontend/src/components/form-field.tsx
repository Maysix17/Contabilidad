import type { ReactNode } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  /**
   * Control pegado al borde derecho del campo, normalmente un icono pulsable
   * (mostrar contrasena, por ejemplo).
   */
  right?: ReactNode;
}

export function FormField({ label, error, right, style, ...rest }: FormFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>

      <View>
        <TextInput
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundElement,
              color: theme.text,
              borderColor: error ? '#DC2626' : 'transparent',
            },
            // Sin esto el texto se meteria debajo del icono de la derecha.
            right ? styles.conDerecho : null,
            style,
          ]}
          {...rest}
        />
        {right ? <View style={styles.derecha}>{right}</View> : null}
      </View>

      {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  conDerecho: {
    paddingRight: Spacing.five,
  },
  derecha: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  error: {
    color: '#DC2626',
  },
});