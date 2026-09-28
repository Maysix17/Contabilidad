import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: { valor: string; texto: string }[];
  onChange: (valor: string) => void;
  error?: string | null;
}) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.opciones}>
        {options.map((opcion) => {
          const activo = opcion.valor === value;
          return (
            <Pressable
              key={opcion.valor}
              onPress={() => onChange(opcion.valor)}
              style={({ pressed }) => [
                styles.opcion,
                {
                  backgroundColor: activo ? theme.tint : theme.backgroundElement,
                  borderColor: error ? '#DC2626' : 'transparent',
                },
                pressed && styles.press,
              ]}>
              <ThemedText
                type="small"
                style={{ color: activo ? '#fff' : theme.text }}>
                {opcion.texto}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  opciones: { gap: Spacing.two, paddingVertical: 2 },
  opcion: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  press: { opacity: 0.8 },
  error: { color: '#DC2626' },
  max: { maxWidth: MaxContentWidth },
});
