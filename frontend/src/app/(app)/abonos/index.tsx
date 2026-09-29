import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, listClientesPorCobrar, type ClientePorCobrar } from '@/api/client';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos } from '@/utils/money';

export default function AbonosScreen() {
  const theme = useTheme();
  const [clientes, setClientes] = useState<ClientePorCobrar[]>([]);
  const [search, setSearch] = useState('');
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (texto: string, refrescar = false) => {
    try {
      setClientes(await listClientesPorCobrar(texto || undefined));
      setError(null);
    } catch (cause) {
      setClientes([]);
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la cartera');
    } finally {
      setCargando(false);
    }

    if (refrescar) setRefrescando(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(search), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [cargar, search]);

  const total = clientes.reduce(
    (suma, item) => suma + Number(item.creditoActivo.saldo),
    0,
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          titulo="Abonos"
          subtitulo={`${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'} por cobrar`}
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cédula o nombre"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          style={[
            styles.search,
            { backgroundColor: theme.backgroundElement, color: theme.text },
          ]}
        />

        {error ? <ErrorBox mensaje={error} /> : null}
        {cargando ? <ActivityIndicator /> : null}

        {!cargando && clientes.length > 0 ? (
          <ThemedView type="backgroundElement" style={styles.resumen}>
            <ThemedText type="small" themeColor="textSecondary">
              Saldo por cobrar
            </ThemedText>
            <ThemedText type="subtitle">{formatearPesos(total)}</ThemedText>
          </ThemedView>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => void cargar(search, true)} />
          }>
          {!cargando && clientes.length === 0 ? (
            <Vacio
              mensaje={
                search
                  ? 'Ningún cliente con crédito activo coincide'
                  : 'No hay clientes con crédito activo'
              }
            />
          ) : null}

          {clientes.map((cliente) => (
            <Link
              key={cliente.id}
              href={{ pathname: '/creditos/[id]', params: { id: cliente.creditoActivo.id } }}
              asChild>
              <Pressable style={({ pressed }) => [pressed && styles.press]}>
                <ThemedView type="backgroundElement" style={styles.tarjeta}>
                  <View style={styles.encabezado}>
                    <View style={styles.identidad}>
                      <ThemedText type="smallBold">
                        {cliente.nombre} {cliente.apellido}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Doc. {cliente.documento}
                      </ThemedText>
                    </View>
                    <View style={styles.valores}>
                      <ThemedText type="smallBold">
                        {formatearPesos(cliente.creditoActivo.saldo)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        vence {formatearFecha(cliente.creditoActivo.fechaVencimiento)}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    Cuota {formatearPesos(cliente.creditoActivo.valorCuota)} ·{' '}
                    {cliente.creditoActivo.numeroPeriodos} periodos
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
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
  search: {
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginHorizontal: Spacing.four,
    fontSize: 16,
  },
  resumen: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: 2,
  },
  lista: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  tarjeta: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  identidad: { flexShrink: 1, gap: 2 },
  valores: { alignItems: 'flex-end', gap: 2 },
  press: { opacity: 0.85 },
});
