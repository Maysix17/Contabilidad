import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText, type ThemedTextType } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Contenedor base de las tarjetas de la app. Reemplaza al patron repetido de
 * `ThemedView type="backgroundElement"` con estilos sueltos en cada pantalla,
 * para que el radio, el relleno y el fondo sean siempre los mismos.
 */
export function Tarjeta({
  children,
  style,
  tono,
}: {
  children: ReactNode;
  style?: object;
  tono?: 'normal' | 'tint';
}) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.tarjeta,
        tono === 'tint' ? { backgroundColor: `${theme.tint}14` } : null,
        style,
      ]}>
      {children}
    </ThemedView>
  );
}

/** Rotulo de seccion. Mayuscula y espaciada, nunca compite con las cifras. */
export function SectionHeader({ titulo, accion }: { titulo: string; accion?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {titulo}
      </ThemedText>
      {accion}
    </View>
  );
}

export function StatCard({
  titulo,
  valor,
  detalle,
  color,
  valorType = 'h2',
  destacado = false,
  style,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  color?: string;
  valorType?: ThemedTextType;
  destacado?: boolean;
  style?: object;
}) {
  return (
    <Tarjeta
      style={[styles.card, style]}
      tono={destacado ? 'tint' : 'normal'}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {titulo}
      </ThemedText>
      <ThemedText type={valorType} style={color ? { color } : undefined}>
        {valor}
      </ThemedText>
      {detalle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {detalle}
        </ThemedText>
      ) : null}
    </Tarjeta>
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
      <ThemedText type="smallBold" style={{ color: colores[estado] ?? theme.textSecondary }}>
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

/**
 * Fila de las listas del panel: identidad a la izquierda, cifras a la derecha.
 * Compartida por "Mayor saldo pendiente" y "Proximos vencimientos" para que las
 * dos listas se vean como la misma cosa.
 */
export function FilaLista({
  titulo,
  subtitulo,
  valor,
  nota,
  valorColor,
  onPress,
  separador = true,
}: {
  titulo: string;
  subtitulo?: string;
  valor: string;
  nota?: string;
  valorColor?: string;
  onPress?: () => void;
  separador?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filaLista,
        separador && styles.filaListaSeparador,
        pressed && onPress ? styles.filaListaPulsada : null,
      ]}>
      <View style={styles.filaListaTexto}>
        <ThemedText type="smallBold">{titulo}</ThemedText>
        {subtitulo ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitulo}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.filaListaValores}>
        <ThemedText type="smallBold" style={valorColor ? { color: valorColor } : undefined}>
          {valor}
        </ThemedText>
        {nota ? (
          <ThemedText
            type="small"
            style={valorColor ? { color: valorColor } : undefined}>
            {nota}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Aviso destacado con accion opcional. */
export function Aviso({
  mensaje,
  accion,
  onPress,
  color = '#B45309',
}: {
  mensaje: string;
  accion?: string;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Tarjeta>
      <Pressable onPress={onPress} style={styles.aviso}>
        <ThemedText type="smallBold" style={{ color, flexShrink: 1 }}>
          {mensaje}
        </ThemedText>
        {accion ? (
          <ThemedText type="smallBold" style={{ color }}>
            {accion} →
          </ThemedText>
        ) : null}
      </Pressable>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.one,
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
  filaLista: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  filaListaSeparador: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8888',
  },
  filaListaPulsada: { opacity: 0.6 },
  filaListaTexto: { flexShrink: 1, gap: 2 },
  filaListaValores: { alignItems: 'flex-end', gap: 2 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
