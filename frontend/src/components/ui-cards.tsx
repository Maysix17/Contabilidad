import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StatCard({
  titulo,
  valor,
  detalle,
  color,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  color?: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {titulo}
      </ThemedText>
      <ThemedText type="subtitle" style={color ? { color } : undefined}>
        {valor}
      </ThemedText>
      {detalle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {detalle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  activo: 'Activo',
  finalizado: 'Finalizado',
  cerrado: 'Cerrado',
};

export function EstadoBadge({ estado }: { estado: string }) {
  const theme = useTheme();

  const colores: Record<string, string> = {
    activo: '#208AEF',
    finalizado: '#16A34A',
    cerrado: theme.textSecondary,
  };

  return (
    <View style={[styles.badge, { backgroundColor: `${colores[estado] ?? theme.textSecondary}22` }]}>
      <ThemedText type="small" style={{ color: colores[estado] ?? theme.textSecondary }}>
        {ETIQUETAS_ESTADO[estado] ?? estado}
      </ThemedText>
    </View>
  );
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <View style={styles.vacio}>
      <ThemedText type="small" themeColor="textSecondary">
        {mensaje}
      </ThemedText>
    </View>
  );
}

export function ErrorBox({ mensaje }: { mensaje: string }) {
  return (
    <View style={styles.errorBox}>
      <ThemedText type="small" style={{ color: '#DC2626' }}>
        {mensaje}
      </ThemedText>
    </View>
  );
}

export function FilaDato({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: string;
  color?: string;
}) {
  return (
    <View style={styles.filaDato}>
      <ThemedText type="small" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>
      <ThemedText type="smallBold" style={color ? { color } : undefined}>
        {valor}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    flexGrow: 1,
    flexBasis: '47%',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  vacio: { paddingVertical: Spacing.five, alignItems: 'center' },
  errorBox: { paddingVertical: Spacing.two },
  filaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
