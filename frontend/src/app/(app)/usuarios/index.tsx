import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  deleteUsuario,
  listUsuarios,
  type Usuario,
} from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, FilaBoton } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function UsuariosScreen() {
  const theme = useTheme();
  const { user: actual } = useSession();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [search, setSearch] = useState('');
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (texto: string, refrescar = false) => {
    try {
      setUsuarios(await listUsuarios(texto || undefined));
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los usuarios');
    } finally {
      setCargando(false);
    }

    if (refrescar) setRefrescando(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(search), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [cargar, search]);

  async function refrescar() {
    setRefrescando(true);
    await cargar(search, true);
  }

  function confirmarEliminar(usuario: Usuario) {
    Alert.alert('Eliminar usuario', `Se eliminará a ${usuario.nombre} de forma permanente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void deleteUsuario(usuario.id)
            .then(() => cargar(search))
            .catch((cause) =>
              setError(cause instanceof ApiError ? cause.message : 'No se pudo eliminar'),
            );
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          titulo="Usuarios"
          subtitulo={`${usuarios.length} cuentas`}
          derecha={
            <Link href="/usuarios/nuevo" asChild>
              <Button title="Nuevo" compacto />
            </Link>
          }
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o cedula"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.search,
            { backgroundColor: theme.backgroundElement, color: theme.text },
          ]}
        />

        {cargando ? <ActivityIndicator /> : null}
        {error ? <ErrorBox mensaje={error} /> : null}

        <ScrollView
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
          }>
          {!cargando && usuarios.length === 0 ? <Vacio mensaje="Sin usuarios" /> : null}

          {usuarios.map((usuario) => {
            const soyYo = usuario.id === actual?.id;
            return (
              <ThemedView key={usuario.id} type="backgroundElement" style={styles.tarjeta}>
                <View style={styles.encabezado}>
                  <View style={styles.identidad}>
                    <ThemedText type="smallBold">{usuario.nombre}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {usuario.cedula}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.rol,
                      {
                        backgroundColor:
                          usuario.rol === 'administrador' ? '#208AEF22' : '#16A34A22',
                      },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{
                        color: usuario.rol === 'administrador' ? '#208AEF' : '#16A34A',
                      }}>
                      {usuario.rol === 'administrador' ? 'Admin' : 'Operador'}
                    </ThemedText>
                  </View>
                </View>

                {!usuario.activo ? (
                  <ThemedText type="small" style={styles.inactivo}>
                    Cuenta desactivada
                  </ThemedText>
                ) : null}

                {!soyYo ? (
                  <FilaBoton>
                    <Button
                      title={usuario.rol === 'administrador' ? 'Degradar' : 'Ascender'}
                      variant="secundario"
                      compacto
                      onPress={() => {
                        const nuevo = usuario.rol === 'administrador' ? 'operador' : 'administrador';
                        void cambiarRolUsuario(usuario.id, nuevo)
                          .then(() => cargar(search))
                          .catch((cause) =>
                            setError(
                              cause instanceof ApiError ? cause.message : 'No se pudo cambiar el rol',
                            ),
                          );
                      }}
                    />
                    <Button
                      title={usuario.activo ? 'Desactivar' : 'Reactivar'}
                      variant="secundario"
                      compacto
                      onPress={() => {
                        void cambiarEstadoUsuario(usuario.id, !usuario.activo)
                          .then(() => cargar(search))
                          .catch((cause) =>
                            setError(
                              cause instanceof ApiError ? cause.message : 'No se pudo cambiar el estado',
                            ),
                          );
                      }}
                    />
                    <Button
                      title="Eliminar"
                      variant="peligro"
                      compacto
                      onPress={() => confirmarEliminar(usuario)}
                    />
                  </FilaBoton>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Esta es tu cuenta
                  </ThemedText>
                )}
              </ThemedView>
            );
          })}
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  search: {
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  lista: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  tarjeta: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  identidad: { flexShrink: 1, gap: 2 },
  rol: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  inactivo: { color: '#DC2626' },
});
