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

import { ApiError, listRutas, type RutaListada } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, EstadoBadgeRuta, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Pastel, Spacing } from '@/constants/theme';
import { useRefresco } from '@/hooks/use-refresco';
import { hoy } from '@/utils/fecha';
import { formatearFecha, formatearPesos } from '@/utils/money';

export default function RutasScreen() {
  const router = useRouter();
  const { esAdmin } = useSession();

  const [fecha, setFecha] = useState(hoy());
  const [rutas, setRutas] = useState<RutaListada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
      try {
        setRutas(await listRutas({ fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined }));
        setError(null);
      } catch (cause) {
        setRutas([]);
        setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar las rutas');
      } finally {
        setCargando(false);
      }
    },
    [fecha],
  );

  /**
   * El listado se queda congelado si solo carga al montarse: la pantalla sigue
   * viva cuando se vuelve desde una ruta, y entonces los montos cobrados y los
   * estados quedarian como estaban antes del cobro.
   */
  useRefresco(cargar, 300);

  const totalCobrado = rutas.reduce((suma, ruta) => suma + ruta.cobrado, 0);
  const pendientesDeCobro = rutas.reduce((suma, ruta) => suma + ruta.clientes, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.titulo}>
          <ScreenHeader
            titulo={esAdmin ? 'Rutas' : 'Mi ruta'}
            subtitulo={
              esAdmin
                ? 'Asigna a cada operador los clientes que le tocan cobrar'
                : 'Los clientes que te toca visitar hoy'
            }
          />
        </View>

        <View style={styles.filtros}>
          <View style={styles.campoFecha}>
            <FormField
              label="Fecha"
              value={fecha}
              onChangeText={setFecha}
              placeholder="2026-09-29"
              autoCapitalize="none"
            />
          </View>
          {esAdmin ? (
            <Button title="Nueva ruta" tono="azul" onPress={() => router.push('/rutas/nueva')} />
          ) : null}
        </View>

        {error ? <ErrorBox mensaje={error} /> : null}
        {cargando ? <ActivityIndicator /> : null}

        <ScrollView
          contentContainerStyle={styles.contenido}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                void cargar().then(() => setRefrescando(false));
              }}
            />
          }>
          {!cargando && rutas.length > 0 ? (
            <View style={[styles.resumen, { backgroundColor: Pastel.azul.superficie }]}>
              <View style={styles.resumenDato}>
                <ThemedText type="small" style={{ color: `${Pastel.azul.texto}C0` }}>
                  Clientes asignados
                </ThemedText>
                <ThemedText type="h2" style={{ color: Pastel.azul.texto }}>
                  {pendientesDeCobro}
                </ThemedText>
              </View>
              <View style={styles.resumenDato}>
                <ThemedText type="small" style={{ color: `${Pastel.azul.texto}C0` }}>
                  Cobrado
                </ThemedText>
                <ThemedText type="h2" style={{ color: Pastel.azul.texto }}>
                  {formatearPesos(totalCobrado)}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {!cargando && rutas.length === 0 ? (
            <Vacio
              mensaje={
                esAdmin
                  ? 'No hay rutas para esa fecha. Crea una para asignar cobros.'
                  : 'No tienes ruta asignada para esa fecha.'
              }
            />
          ) : null}

          {rutas.map((ruta) => (
            <Pressable
              key={ruta.id}
              onPress={() => router.push({ pathname: '/rutas/[id]', params: { id: ruta.id } })}
              style={({ pressed }) => [
                styles.tarjeta,
                { backgroundColor: Pastel.neutro.superficie },
                pressed && styles.press,
              ]}>
              <View style={styles.encabezado}>
                <View style={styles.titulos}>
                  <ThemedText type="smallBold">{ruta.nombre}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {esAdmin ? ruta.operador.nombre : formatearFecha(ruta.fecha)}
                  </ThemedText>
                </View>
                <EstadoBadgeRuta estado={ruta.estado} />
              </View>

              <View style={styles.pie}>
                <View style={styles.dato}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={14}
                    color={Pastel.neutro.texto}
                  />
                  <ThemedText type="small" style={{ color: Pastel.neutro.texto }}>
                    {ruta.clientes} {ruta.clientes === 1 ? 'cliente' : 'clientes'}
                  </ThemedText>
                </View>
                <View style={styles.dato}>
                  <MaterialCommunityIcons
                    name="cash-check"
                    size={14}
                    color={ruta.cobrado > 0 ? Pastel.verde.texto : Pastel.neutro.texto}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: ruta.cobrado > 0 ? Pastel.verde.texto : Pastel.neutro.texto,
                    }}>
                    {formatearPesos(ruta.cobrado)}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
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
  titulo: {
    // Solo el padding lateral: el `ScreenHeader` ya pone su propio
    // `marginTop`, y añadirlo aqui lo duplicaba y dejaba el titulo mas bajo
    // que en las demas pantallas.
    paddingHorizontal: Spacing.four,
  },
  filtros: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  campoFecha: { flex: 1 },
  contenido: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  resumen: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  resumenDato: { gap: 2 },
  tarjeta: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titulos: { flexShrink: 1, gap: 2 },
  pie: { flexDirection: 'row', gap: Spacing.three },
  dato: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  press: { opacity: 0.85 },
});
