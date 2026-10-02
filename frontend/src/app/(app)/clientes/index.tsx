import { Link, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, listClientes, type Cliente } from '@/api/client';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useRefresco } from '@/hooks/use-refresco';
import { useTheme } from '@/hooks/use-theme';

export default function ClientesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (buscar: string, incluirInactivos: boolean) => {
      try {
        setClientes(
          await listClientes({
            search: buscar || undefined,
            includeInactive: incluirInactivos,
          }),
        );
        setError(null);
      } catch (cause) {
        // Sin vaciar la lista, un fallo dejaba los clientes de antes
        // debajo del aviso, como si siguieran vigentes.
        setClientes([]);
        setError(
          cause instanceof ApiError ? cause.message : 'No se pudieron cargar los clientes',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Crear, editar, desactivar y eliminar clientes se hace en otras
   * pantallas. Sin recargar al volver, el cliente nuevo no aparecia,
   * el desactivado seguia viendose como activo y el eliminado
   * permanecia en el listado hasta recargar a mano.
   */
  useRefresco(
    useCallback(() => void load(search, verInactivos), [load, search, verInactivos]),
    search ? 400 : 0,
  );

  async function refrescar() {
    setRefrescando(true);
    await load(search, verInactivos);
    setRefrescando(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          titulo="Clientes"
          subtitulo={`${clientes.length} registros`}
          derecha={
            <Link href="/clientes/nuevo" asChild>
              <Button title="Nuevo" compacto />
            </Link>
          }
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o documento"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.search,
            { backgroundColor: theme.backgroundElement, color: theme.text },
          ]}
        />

        <Pressable
          onPress={() => setVerInactivos((valor) => !valor)}
          style={styles.filtro}>
          <ThemedText type="small" themeColor={verInactivos ? 'text' : 'textSecondary'}>
            {verInactivos ? '✓ ' : ''}Mostrar clientes inactivos
          </ThemedText>
        </Pressable>

        {loading ? <ActivityIndicator /> : null}
        {error ? <ErrorBox mensaje={error} /> : null}

        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
          }>
          {!loading && clientes.length === 0 ? (
            <Vacio mensaje="Todavía no hay clientes registrados." />
          ) : null}

          {clientes.map((cliente) => (
            <Pressable
              key={cliente.id}
              onPress={() => router.push(`/clientes/${cliente.id}`)}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedView
                type="backgroundElement"
                style={[styles.card, !cliente.activo && styles.cardInactivo]}>
                <ThemedText type="smallBold">
                  {cliente.nombre} {cliente.apellido}
                  {cliente.activo ? '' : '  ·  Inactivo'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Doc. {cliente.documento}
                </ThemedText>
                <ThemedText type="small">{cliente.celular}</ThemedText>
                {cliente.ciudad ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {cliente.ciudad}
                  </ThemedText>
                ) : null}
              </ThemedView>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  search: {
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardInactivo: {
    opacity: 0.55,
  },
  filtro: {
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
