import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  getIndicadores,
  type Indicadores,
  type ProximoVencimiento,
  type TopDeudor,
} from '@/api/client';
import { useSession } from '@/auth/session';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Aviso,
  ErrorBox,
  FilaLista,
  SectionHeader,
  StatCard,
  Tarjeta,
  Vacio,
} from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos } from '@/utils/money';

export default function InicioScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, esAdmin } = useSession();
  const [datos, setDatos] = useState<{
    indicadores: Indicadores;
    topDeudores: TopDeudor[];
    proximosVencimientos: ProximoVencimiento[];
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (refrescar = false) => {
    try {
      setDatos(await getIndicadores());
      setError(null);
    } catch (cause) {
      setDatos(null);
      setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los indicadores');
    } finally {
      setCargando(false);
    }

    if (refrescar) setRefrescando(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  async function refrescar() {
    setRefrescando(true);
    await cargar(true);
  }

  const ind = datos?.indicadores;
  const iniciales = (user?.nombre ?? '?').trim().charAt(0).toUpperCase();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          titulo={`Hola, ${user?.nombre ?? ''}`.trim()}
          subtitulo={fechaLarga()}
          derecha={
            <Pressable
              onPress={() => router.push('/perfil')}
              style={[
                styles.perfil,
                { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary },
              ]}>
              <ThemedText type="smallBold">{iniciales}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {esAdmin ? 'Admin' : 'Operador'}
              </ThemedText>
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
          }>
          {cargando ? <ActivityIndicator /> : null}
          {error ? <ErrorBox mensaje={error} /> : null}

          {ind ? (
            <>
              {/*
                Una sola cifra protagonista a ancho completo. Antes las cuatro
                tarjetas tenian el mismo peso y no habia forma de saber cual
                mirar primero; ademas el monto se pintaba a 32 px y no cabia en
                media pantalla.
              */}
              <StatCard
                titulo="Saldo por cobrar"
                valor={formatearPesos(ind.saldoPorCobrar)}
                detalle={`${ind.creditosActivos} ${
                  ind.creditosActivos === 1 ? 'crédito activo' : 'créditos activos'
                }`}
                valorType="valor"
                destacado
              />

              <View style={styles.grid}>
                <StatCard
                  titulo="Clientes en mora"
                  valor={String(ind.clientesEnMora)}
                  detalle={`${formatearPesos(ind.saldoVencido)} vencidos`}
                  color={ind.clientesEnMora > 0 ? '#DC2626' : undefined}
                  style={styles.celda}
                />
                <StatCard
                  titulo="Abonos del mes"
                  valor={formatearPesos(ind.abonosDelMes)}
                  detalle={`${ind.creditosFinalizados} ${
                    ind.creditosFinalizados === 1 ? 'finalizado' : 'finalizados'
                  }`}
                  style={styles.celda}
                />
                <StatCard
                  titulo="Clientes"
                  valor={String(ind.clientesActivos)}
                  detalle={`${ind.creditosCerrados} ${
                    ind.creditosCerrados === 1 ? 'cerrado' : 'cerrados'
                  }`}
                  style={styles.celda}
                />
              </View>

              {ind.cuotasAtrasadas > 0 ? (
                <Aviso
                  mensaje={`${ind.cuotasAtrasadas} ${
                    ind.cuotasAtrasadas === 1 ? 'cuota vencida' : 'cuotas vencidas'
                  } en ${ind.clientesEnMora} ${
                    ind.clientesEnMora === 1 ? 'crédito' : 'créditos'
                  }`}
                  accion="Ver abonos"
                  onPress={() => router.push('/abonos')}
                />
              ) : null}

              <View style={styles.bloque}>
                <SectionHeader titulo="Mayor saldo pendiente" />

                {datos.topDeudores.length === 0 ? (
                  <Tarjeta>
                    <Vacio mensaje="No hay créditos activos" />
                  </Tarjeta>
                ) : (
                  <Tarjeta style={styles.lista}>
                    {datos.topDeudores.map((deudor, indice) => (
                      <FilaLista
                        key={deudor.creditoId}
                        titulo={`${deudor.nombre} ${deudor.apellido}`}
                        subtitulo={`Doc. ${deudor.documento}`}
                        valor={formatearPesos(deudor.saldo)}
                        nota={
                          deudor.cuotasAtrasadas > 0
                            ? `${deudor.cuotasAtrasadas} vencidas`
                            : `Cuota ${formatearPesos(deudor.valorCuota)}`
                        }
                        valorColor={deudor.cuotasAtrasadas > 0 ? '#DC2626' : undefined}
                        onPress={() => router.push(`/creditos/${deudor.creditoId}`)}
                        separador={indice < datos.topDeudores.length - 1}
                      />
                    ))}
                  </Tarjeta>
                )}
              </View>

              <View style={styles.bloque}>
                <SectionHeader titulo="Próximos vencimientos" />

                {datos.proximosVencimientos.length === 0 ? (
                  <Tarjeta>
                    <Vacio mensaje="Sin vencimientos programados" />
                  </Tarjeta>
                ) : (
                  <Tarjeta style={styles.lista}>
                    {datos.proximosVencimientos.map((item, indice) => (
                      <FilaLista
                        key={item.creditoId}
                        titulo={item.cliente}
                        subtitulo={`Cuota ${formatearPesos(item.valorCuota)} · vence ${formatearFecha(
                          item.fechaVencimiento,
                        )}`}
                        valor={formatearPesos(item.saldo)}
                        onPress={() => router.push(`/creditos/${item.creditoId}`)}
                        separador={indice < datos.proximosVencimientos.length - 1}
                      />
                    ))}
                  </Tarjeta>
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Fecha en espanol, construida con las partes locales para no correr de dia. */
function fechaLarga(): string {
  const ahora = new Date();

  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(ahora);
}

const styles = StyleSheet.create({
  perfil: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 44,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  celda: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  bloque: {
    gap: Spacing.two,
  },
  lista: {
    paddingVertical: Spacing.one,
  },
});
