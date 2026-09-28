import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { entrar, user, cargando } = useSession();

  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarEnvio() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await entrar(cedula.replace(/\D/g, ''), contrasena);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'No se pudo conectar con el servidor',
      );
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centrado}>
          <ActivityIndicator color={theme.tint} />
        </View>
      </ThemedView>
    );
  }

  if (user) {
    return <Redirect href="/(app)" />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <ThemedText type="subtitle">Contabilidad</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Inicia sesion para continuar
              </ThemedText>
            </View>

            <FormField
              label="Cedula"
              value={cedula}
              onChangeText={(texto) => setCedula(texto.replace(/\D/g, ''))}
              placeholder="123456789"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
              returnKeyType="next"
            />

            <FormField
              label="Contrasena"
              value={contrasena}
              onChangeText={setContrasena}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void manejarEnvio()}
            />

            {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}

            <Pressable
              onPress={() => void manejarEnvio()}
              disabled={enviando}
              style={({ pressed }) => [
                styles.boton,
                { backgroundColor: theme.tint },
                pressed && styles.press,
                enviando && styles.deshabilitado,
              ]}>
              {enviando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText type="smallBold" style={styles.botonTexto}>
                  Entrar
                </ThemedText>
              )}
            </Pressable>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boton: {
    minHeight: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: {
    color: '#fff',
  },
  press: { opacity: 0.8 },
  deshabilitado: { opacity: 0.6 },
  error: { color: '#DC2626' },
});
