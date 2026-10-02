import { useRouter } from 'expo-router';
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

import {
  ApiError,
  getIndicadores,
  type Indicadores,
  type ProximoVencimiento,
  type TopDeudor,
} from '@/api/client';
import { useSession } from '@/auth/session';
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
import { MaxContentWidth, Pastel, Spacing } from '@/constants/theme';
import { useRefresco } from '@/hooks/use-refresco';
import { ZONA_OPERACION } from '@/utils/fecha';
import { formatearFecha, formatearPesos } from '@/utils/money';

export default function InicioScreen() {
  const router = useRouter();
  const { user, esAdmin } = useSession();
  const [datos, setDatos] = useState<{
    indicadores: Indicadores;
    topDeudores: TopDeudor[];
    proximosVencimientos: ProximoVencimiento[];
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await getIndicadores());
      setError(null);
    } catch (cause) {
      setDatos(null);
      setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los indicadores');
    } finally {
      setCargando(false);
    }
  }, []);

  /**
   * Todas las cifras de esta pantalla dependen de movimientos que se hacen en
   * otras: un abono, un credito nuevo o un cliente desactivado. Sin recargar al
   * recuperar el foco, el saldo por cobrar y los abonos del mes seguian
   * mostrando las cifras de antes de cobrar.
   */
  useRefresco(cargar);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const ind = datos?.indicadores;
  const tonoRol = esAdmin ? 'violeta' : 'teal';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.saludo}>
          <ThemedText type="subtitle">Hola, {user?.nombre ?? ''}</ThemedText>
          <Pressable
            onPress={() => router.push('/perfil')}
            style={({ pressed }) => [
              styles.rol,
              { backgroundColor: Pastel[tonoRol].superficie },
              pressed && styles.rolPulsado,
            ]}>
            <ThemedText type="smallBold" style={{ color: Pastel[tonoRol].texto }}>
              {esAdmin ? 'Admin' : 'Operador'}
            </ThemedText>
            <MaterialCommunityIcons name="chevron-right" size={14} color={Pastel[tonoRol].texto} />
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {fechaLarga()}
        </ThemedText>

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
                icono="wallet-outline"
                tono="azul"
                valorType="valor"
              />

              <View style={styles.grid}>
                <StatCard
                  titulo="Clientes en mora"
                  valor={String(ind.clientesEnMora)}
                  detalle={`${formatearPesos(ind.saldoVencido)} vencidos`}
                  icono="account-alert-outline"
                  tono={ind.clientesEnMora > 0 ? 'rojo' : 'neutro'}
                  style={styles.celda}
                />
                <StatCard
                  titulo="Abonos del mes"
                  valor={formatearPesos(ind.abonosDelMes)}
                  detalle={`${ind.creditosFinalizados} ${
                    ind.creditosFinalizados === 1 ? 'finalizado' : 'finalizados'
                  }`}
                  icono="trending-up"
                  tono="verde"
                  style={styles.celda}
                />
                <StatCard
                  titulo="Clientes"
                  valor={String(ind.clientesActivos)}
                  detalle={`${ind.creditosCerrados} ${
                    ind.creditosCerrados === 1 ? 'cerrado' : 'cerrados'
                  }`}
                  icono="account-group-outline"
                  tono="violeta"
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
                <SectionHeader titulo="Mayor saldo pendiente" icono="account-star-outline" />

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
                <SectionHeader titulo="Próximos vencimientos" icono="calendar-alert" />

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

/**
 * Fecha en espanol. Se formatea con la zona del negocio y no con la del
 * dispositivo: un celular en otra hora marcaria un dia distinto al que el
 * backend considera hoy.
 */
function fechaLarga(): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA_OPERACION,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

const styles = StyleSheet.create({
  saludo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  rol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.two,
  },
  rolPulsado: { opacity: 0.6 },
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
