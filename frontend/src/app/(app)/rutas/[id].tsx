import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ApiError, cambiarEstadoRuta, getRuta, type EstadoRuta, type RutaDetalle } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, FilaBoton } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, EstadoBadgeRuta, FilaLista, StatCard, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Pastel, Spacing } from '@/constants/theme';
import { useRefresco } from '@/hooks/use-refresco';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos } from '@/utils/money';

/**
 * Que estado sigue a cual. El operador solo avanza: empezar la ruta y cerrarla.
 * No puede devolverla a pendiente ni reabrirla, porque eso permitiria cobrar dos
 * veces la misma visita. Volver atras es cosa del administrador.
 */
const SIGUIENTE: Partial<Record<EstadoRuta, { estado: EstadoRuta; titulo: string }>> = {
  pendiente: { estado: 'abierta', titulo: 'Empezar ruta' },
  abierta: { estado: 'en_proceso', titulo: 'Seguir cobrando' },
  en_proceso: { estado: 'cerrada', titulo: 'Cerrar ruta' },
};

export default function RutaDetalleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { esAdmin } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ruta, setRuta] = useState<RutaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
      try {
        setRuta(await getRuta(id));
        setError(null);
      } catch (cause) {
        setRuta(null);
        setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la ruta');
      } finally {
        setCargando(false);
      }
    },
    [id],
  );

  /**
   * El operador cobra saliendo a la pantalla de credito y vuelve con el boton
   * atras. Como la pantalla sigue montada, los totales y los clientes que ya
   * aparecen en verde solo se actualizan al recuperar el foco.
   */
  useRefresco(cargar);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function avanzar() {
    if (!ruta || !SIGUIENTE[ruta.estado] || cambiando) return;
    setCambiando(true);
    try {
      await cambiarEstadoRuta(ruta.id, SIGUIENTE[ruta.estado]!.estado);
      await cargar();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cambiar el estado');
    } finally {
      setCambiando(false);
    }
  }

  const totalPorCobrar = (ruta?.clientes ?? []).reduce(
    (suma, item) => suma + Math.max(item.saldo - item.cobrado, 0),
    0,
  );
  const cobrado = (ruta?.clientes ?? []).reduce((suma, item) => suma + item.cobrado, 0);
  const siguiente = ruta ? SIGUIENTE[ruta.estado] : undefined;
  const cerrada = ruta?.estado === 'cerrada';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          titulo={ruta?.nombre ?? 'Ruta'}
          subtitulo={ruta ? `Operador: ${ruta.operador.nombre}` : 'Cargando'}
          derecha={ruta ? <EstadoBadgeRuta estado={ruta.estado} /> : null}
        />

        {error ? <ErrorBox mensaje={error} /> : null}
        {cargando ? <ActivityIndicator /> : null}

        {ruta ? (
          <ScrollView
            contentContainerStyle={styles.contenido}
            refreshControl={
              <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
            }>
            <ThemedText type="small" themeColor="textSecondary">
              Fecha de cobro: {formatearFecha(ruta.fecha)}
            </ThemedText>

            <View style={styles.rejilla}>
              <StatCard
                titulo="Por cobrar"
                valor={formatearPesos(totalPorCobrar)}
                detalle={`${ruta.clientes.length} ${
                  ruta.clientes.length === 1 ? 'cliente' : 'clientes'
                }`}
                icono="wallet-outline"
                tono={totalPorCobrar > 0 ? 'ambar' : 'verde'}
                style={styles.celda}
              />
              <StatCard
                titulo="Cobrado"
                valor={formatearPesos(cobrado)}
                detalle={cerrada ? 'ruta cerrada' : 'en la ruta'}
                icono="check-circle-outline"
                tono="verde"
                style={styles.celda}
              />
            </View>

            {!cerrada && siguiente ? (
              <FilaBoton>
                <Button
                  title={siguiente.titulo}
                  tono={siguiente.estado === 'cerrada' ? 'verde' : 'azul'}
                  loading={cambiando}
                  onPress={() => void avanzar()}
                  style={styles.botonPrincipal}
                />
              </FilaBoton>
            ) : null}

            {cerrada && ruta.cerradaEn ? (
              <ThemedText type="small" themeColor="textSecondary">
                Cerrada el {new Date(ruta.cerradaEn).toLocaleString('es-CO')}.
              </ThemedText>
            ) : null}

            {ruta.clientes.length === 0 ? (
              <Vacio mensaje="Esta ruta no tiene clientes asignados" />
            ) : (
              <ThemedView type="backgroundElement" style={styles.lista}>
                {ruta.clientes.map((item, indice) => {
                  const pendiente = Math.max(item.saldo - item.cobrado, 0);
                  return (
                    <FilaLista
                      key={item.cliente.id}
                      titulo={`${indice + 1}. ${item.cliente.nombre} ${item.cliente.apellido}`}
                      subtitulo={`Doc. ${item.cliente.documento} · ${item.cliente.direccion}`}
                      valor={formatearPesos(pendiente > 0 ? pendiente : item.cobrado)}
                      nota={pendiente > 0 ? 'pendiente' : 'cobrado'}
                      valorColor={pendiente > 0 ? Pastel.ambar.texto : Pastel.verde.texto}
                      onPress={
                        item.creditoId && pendiente > 0
                          ? () =>
                              router.push({
                                pathname: '/creditos/[id]',
                                params: { id: item.creditoId!, ruta: ruta.id },
                              })
                          : undefined
                      }
                      separador={indice < ruta.clientes.length - 1}
                    />
                  );
                })}
              </ThemedView>
            )}

            {ruta.observaciones ? (
              <View style={[styles.notas, { backgroundColor: Pastel.azul.superficie }]}>
                <MaterialCommunityIcons name="information-outline" size={16} color={Pastel.azul.texto} />
                <ThemedText type="small" style={{ color: Pastel.azul.texto, flexShrink: 1 }}>
                  {ruta.observaciones}
                </ThemedText>
              </View>
            ) : null}

            {esAdmin && ruta.estado === 'pendiente' ? (
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.volver, pressed && styles.press]}>
                <MaterialCommunityIcons name="arrow-left" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Volver a la lista
                </ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  contenido: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  rejilla: { flexDirection: 'row', gap: Spacing.two },
  celda: { flex: 1 },
  botonPrincipal: { flex: 1 },
  lista: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  notas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
  press: { opacity: 0.6 },
});
