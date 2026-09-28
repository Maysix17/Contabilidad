import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, getIndicadores, type Indicadores, type ProximoVencimiento, type TopDeudor } from '@/api/client';
import { useSession } from '@/auth/session';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, FilaDato, StatCard, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos } from '@/utils/money';

export default function PanelScreen() {
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
    } catch (cause) {
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          titulo="Panel"
          subtitulo={`Hola, ${user?.nombre ?? ''}`}
          derecha={
            <Pressable
              onPress={() => router.push('/perfil')}
              style={[
                styles.perfil,
                { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary },
              ]}>
              <ThemedText type="smallBold">{user?.cedula ?? '—'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {esAdmin ? 'Administrador' : 'Operador'}
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
              <View style={styles.grid}>
                <StatCard
                  titulo="Saldo por cobrar"
                  valor={formatearPesos(ind.saldoPorCobrar)}
                  detalle={`${ind.creditosActivos} créditos activos`}
                />
                <StatCard
                  titulo="Abonos del mes"
                  valor={formatearPesos(ind.abonosDelMes)}
                  detalle={`${ind.creditosFinalizados} créditos finalizados`}
                />
                <StatCard
                  titulo="Clientes"
                  valor={String(ind.clientesActivos)}
                  detalle={`${ind.creditosCerrados} créditos cerrados`}
                />
                <StatCard
                  titulo="Vencidos"
                  valor={String(ind.clientesEnMora)}
                  detalle={`${ind.cuotasAtrasadas} cuotas · ${formatearPesos(ind.saldoVencido)}`}
                  color={ind.clientesEnMora > 0 ? '#DC2626' : undefined}
                />
              </View>

              {ind.cuotasAtrasadas > 0 ? (
                <ThemedView type="backgroundElement" style={styles.aviso}>
                  <ThemedText type="smallBold" style={{ color: '#B45309' }}>
                    {ind.cuotasAtrasadas}{' '}
                    {ind.cuotasAtrasadas === 1 ? 'cuota vencida' : 'cuotas vencidas'} en{' '}
                    {ind.clientesEnMora}{' '}
                    {ind.clientesEnMora === 1 ? 'crédito' : 'créditos'}
                  </ThemedText>
                </ThemedView>
              ) : null}

              <View style={styles.bloque}>
                <ThemedText type="smallBold">Mayor saldo pendiente</ThemedText>
                {datos.topDeudores.length === 0 ? (
                  <Vacio mensaje="No hay créditos activos" />
                ) : (
                  datos.topDeudores.map((deudor) => (
                    <Pressable
                      key={deudor.creditoId}
                      onPress={() => router.push(`/creditos/${deudor.creditoId}`)}
                      style={styles.fila}>
                      <View style={styles.filaTexto}>
                        <ThemedText type="smallBold">
                          {deudor.nombre} {deudor.apellido}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Doc. {deudor.documento}
                        </ThemedText>
                      </View>
                      <View style={styles.filaValores}>
                        <ThemedText type="smallBold">
                          {formatearPesos(deudor.saldo)}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: deudor.cuotasAtrasadas > 0 ? '#DC2626' : undefined,
                          }}>
                          {deudor.cuotasAtrasadas > 0
                            ? `${deudor.cuotasAtrasadas} vencidas`
                            : `Cuota ${formatearPesos(deudor.valorCuota)}`}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>

              <View style={styles.bloque}>
                <ThemedText type="smallBold">Próximos vencimientos</ThemedText>
                {datos.proximosVencimientos.length === 0 ? (
                  <Vacio mensaje="Sin vencimientos programados" />
                ) : (
                  datos.proximosVencimientos.map((item) => (
                    <Pressable
                      key={item.creditoId}
                      onPress={() => router.push(`/creditos/${item.creditoId}`)}
                      style={styles.vencimiento}>
                      <FilaDato
                        etiqueta={`${item.cliente} · cuota`}
                        valor={formatearPesos(item.valorCuota)}
                      />
                      <FilaDato
                        etiqueta="Vence"
                        valor={formatearFecha(item.fechaVencimiento)}
                      />
                      <FilaDato
                        etiqueta="Saldo"
                        valor={formatearPesos(item.saldo)}
                      />
                    </Pressable>
                  ))
                )}
              </View>

              {esAdmin ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Tienes permisos de administrador: puedes cerrar y eliminar registros.
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Operador: puedes registrar clientes, créditos y abonos, pero no cerrar ni
                  eliminar.
                </ThemedText>
              )}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  perfil: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
  aviso: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  bloque: {
    gap: Spacing.two,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  filaTexto: { flexShrink: 1, gap: 2 },
  filaValores: { alignItems: 'flex-end', gap: 2 },
  vencimiento: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8888',
    paddingBottom: Spacing.two,
  },
});
