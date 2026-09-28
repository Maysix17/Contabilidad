import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FilaDato } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function PerfilScreen() {
  const router = useRouter();
  const { user, esAdmin, salir } = useSession();

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          void salir().then(() => router.replace('/login'));
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader titulo="Perfil" />

        <ThemedView type="backgroundElement" style={styles.tarjeta}>
          <FilaDato etiqueta="Nombre" valor={user?.nombre ?? '—'} />
          <FilaDato etiqueta="Cedula" valor={user?.cedula ?? '—'} />
          <FilaDato
            etiqueta="Rol"
            valor={esAdmin ? 'Administrador' : 'Operador'}
          />
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary">
          {esAdmin
            ? 'Como administrador puedes cerrar y eliminar créditos, clientes y usuarios.'
            : 'Como operador puedes crear clientes, créditos y abonos, pero no cerrarlos ni eliminarlos.'}
        </ThemedText>

        <View style={styles.acciones}>
          <Button title="Cerrar sesión" variant="peligro" onPress={confirmarSalida} />
        </View>
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
  tarjeta: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  acciones: { marginTop: Spacing.three },
});
