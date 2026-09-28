import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function ScreenHeader({
  titulo,
  subtitulo,
  derecha,
}: {
  titulo: string;
  subtitulo?: string;
  derecha?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.texto}>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        {subtitulo ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitulo}
          </ThemedText>
        ) : null}
      </View>
      {derecha}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  texto: {
    gap: 2,
    flexShrink: 1,
  },
});
