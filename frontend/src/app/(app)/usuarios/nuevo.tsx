import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, createUsuario, type RolUsuario } from '@/api/client';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const ROLES: { valor: RolUsuario; texto: string }[] = [
  { valor: 'operador', texto: 'Operador' },
  { valor: 'administrador', texto: 'Administrador' },
];

export default function NuevoUsuarioScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [rol, setRol] = useState<RolUsuario>('operador');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (enviando) return;
    setError(null);

    const cedulaLimpia = cedula.replace(/\D/g, '');

    if (!nombre.trim() || cedulaLimpia.length < 6 || contrasena.length < 8) {
      setError('Completa el nombre, la cedula y una contraseña de al menos 8 caracteres');
      return;
    }

    setEnviando(true);
    try {
      await createUsuario({
        nombre: nombre.trim(),
        cedula: cedulaLimpia,
        contrasena,
        rol,
      });
      router.back();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo crear el usuario');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
            <ScreenHeader titulo="Nuevo usuario" />

            <FormField
              label="Nombre"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre completo"
            />
            <FormField
              label="Cedula"
              value={cedula}
              onChangeText={(texto) => setCedula(texto.replace(/\D/g, ''))}
              placeholder="123456789"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
            />
            <FormField
              label="Contraseña"
              value={contrasena}
              onChangeText={setContrasena}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
              autoCapitalize="none"
            />

            <SelectField
              label="Rol"
              value={rol}
              options={ROLES}
              onChange={(valor) => setRol(valor as RolUsuario)}
            />

            {error ? <ErrorBox mensaje={error} /> : null}

            <Button title="Crear usuario" loading={enviando} onPress={() => void guardar()} />
            <Button title="Cancelar" variant="secundario" onPress={() => router.back()} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
});
