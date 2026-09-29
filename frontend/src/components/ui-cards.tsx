import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText, type ThemedTextType } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Pastel, Spacing, type NombrePastel } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NombreIcono = keyof typeof MaterialCommunityIcons.glyphMap;

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
  tono?: NombrePastel;
}) {
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.tarjeta, tono ? { backgroundColor: Pastel[tono].superficie } : null, style]}>
      {children}
    </ThemedView>
  );
}

/** Rotulo de seccion. Mayuscula y espaciada, nunca compite con las cifras. */
export function SectionHeader({
  titulo,
  icono,
  accion,
}: {
  titulo: string;
  icono?: NombreIcono;
  accion?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitulo}>
        {icono ? (
          <MaterialCommunityIcons name={icono} size={14} color={theme.textSecondary} />
        ) : null}
        <ThemedText type="eyebrow" themeColor="textSecondary">
          {titulo}
        </ThemedText>
      </View>
      {accion}
    </View>
  );
}

export function StatCard({
  titulo,
  valor,
  detalle,
  icono,
  tono,
  valorType = 'h2',
  style,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  icono?: NombreIcono;
  tono?: NombrePastel;
  valorType?: ThemedTextType;
  style?: object;
}) {
  const matiz = tono ? Pastel[tono] : null;

  return (
    <Tarjeta style={[styles.card, style]} tono={tono}>
      {tono && icono ? (
        <View style={[styles.botonIcono, { backgroundColor: matiz?.solido }]}>
          <MaterialCommunityIcons name={icono} size={16} color={matiz?.texto} />
        </View>
      ) : null}
      <ThemedText
        type="eyebrow"
        themeColor={matiz ? undefined : 'textSecondary'}
        style={matiz ? { color: `${matiz.texto}C0` } : undefined}>
        {titulo}
      </ThemedText>
      <ThemedText type={valorType} style={matiz ? { color: matiz.texto } : undefined}>
        {valor}
      </ThemedText>
      {detalle ? (
        <ThemedText
          type="small"
          themeColor={matiz ? undefined : 'textSecondary'}
          style={matiz ? { color: `${matiz.texto}C0` } : undefined}>
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
  const tono: NombrePastel =
    estado === 'activo' ? 'verde' : estado === 'finalizado' ? 'azul' : 'neutro';
  const matiz = Pastel[tono];

  return (
    <View style={[styles.badge, { backgroundColor: matiz.superficie }]}>
      <ThemedText type="smallBold" style={{ color: matiz.texto }}>
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
  tono = 'ambar',
}: {
  mensaje: string;
  accion?: string;
  onPress?: () => void;
  tono?: NombrePastel;
}) {
  const matiz = Pastel[tono];

  return (
    <Tarjeta tono={tono} style={styles.avisoTarjeta}>
      <Pressable onPress={onPress} style={styles.aviso}>
        <MaterialCommunityIcons name="alert-outline" size={18} color={matiz.texto} />
        <ThemedText type="smallBold" style={{ color: matiz.texto, flexShrink: 1 }}>
          {mensaje}
        </ThemedText>
        {accion ? (
          <MaterialCommunityIcons name="chevron-right" size={18} color={matiz.texto} />
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
  sectionTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  card: {
    gap: Spacing.one,
  },
  botonIcono: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  avisoTarjeta: {
    padding: Spacing.three,
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
