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

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ApiError, MENSAJE_SIN_CONEXION } from '@/api/client';
import { useSession } from '@/auth/session';
import { FormField } from '@/components/form-field';
import { Logo } from '@/components/logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Pastel, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { entrar, user, cargando } = useSession();

  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tocados, setTocados] = useState({ cedula: false, contrasena: false });

  /**
   * Un error de conexion es pasadero: el backend puede estar reiniciando o el
   * telefono puede haber cambiado de red. Por eso el aviso de fallo ofrece
   * reintentar en el sitio, en vez de obligar a recargar la app y volver a
   * escribir las credenciales.
   */
  const falloDeRed =
    error !== null &&
    (error === MENSAJE_SIN_CONEXION ||
      error === 'No se pudo conectar con el servidor' ||
      error === 'El servidor no respondió a tiempo.');

  // Solo se validan los campos que la persona ya tocó, para no marcar en rojo
  // un formulario que todavía no ha llenado nadie.
  const faltaCedula = tocados.cedula && cedula.replace(/\D/g, '').length === 0;
  const faltaContrasena = tocados.contrasena && contrasena.length === 0;
  const faltanDatos = cedula.replace(/\D/g, '').length === 0 || contrasena.length === 0;

  async function manejarEnvio() {
    if (enviando) return;

    setTocados({ cedula: true, contrasena: true });
    if (faltanDatos) return;

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
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <View style={styles.tarjeta}>
              <View style={styles.marca}>
                <Logo imagen={require('@/assets/images/logo-Recortado.png')} size={150} />
              </View>

              <View style={styles.titulos}>
                <ThemedText type="subtitle">PayTrack</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Ingresa con tu cédula para gestionar la cobranza
                </ThemedText>
              </View>

              <FormField
                label="Cédula"
                value={cedula}
                onChangeText={(texto) => setCedula(texto.replace(/\D/g, ''))}
                onBlur={() => setTocados((actual) => ({ ...actual, cedula: true }))}
                placeholder="123456789"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={10}
                returnKeyType="next"
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
                error={faltaCedula ? 'Escribe tu cédula' : null}
              />

              <FormField
                label="Contraseña"
                value={contrasena}
                onChangeText={setContrasena}
                onBlur={() => setTocados((actual) => ({ ...actual, contrasena: true }))}
                placeholder="••••••••"
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void manejarEnvio()}
                error={faltaContrasena ? 'Escribe tu contraseña' : null}
                right={
                  <Pressable
                    onPress={() => setVerContrasena((valor) => !valor)}
                    // Un area tactil de 44 px es el minimo comodo en movil; el
                    // icono solo mide 20, asi que sin esto seria dificil de
                    // acertar con el dedo.
                    hitSlop={12}
                    accessibilityLabel={
                      verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }>
                    <MaterialCommunityIcons
                      name={verContrasena ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                }
              />

              {error ? (
                <View style={[styles.aviso, { backgroundColor: Pastel.rojo.superficie }]}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={16}
                    color={Pastel.rojo.texto}
                  />
                  <ThemedText type="small" style={{ color: Pastel.rojo.texto, flex: 1 }}>
                    {error}
                  </ThemedText>
                </View>
              ) : null}

              {falloDeRed ? (
                <Pressable
                  onPress={() => void manejarEnvio()}
                  disabled={enviando}
                  style={({ pressed }) => [styles.reintentar, pressed && styles.press]}>
                  <MaterialCommunityIcons
                    name="refresh"
                    size={16}
                    color={theme.textSecondary}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    Reintentar ahora
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => void manejarEnvio()}
                disabled={enviando}
                style={({ pressed }) => [
                  styles.boton,
                  // El morado del logo, no el azul por defecto del tema: el
                  // boton de entrar es lo primero que se ve y es el que fija
                  // de que color es la app.
                  { backgroundColor: Pastel.violeta.texto },
                  pressed && styles.botonPulsado,
                  (enviando || faltanDatos) && styles.deshabilitado,
                ]}>
                {enviando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText type="smallBold" style={styles.botonTexto}>
                    Entrar
                  </ThemedText>
                )}
              </Pressable>
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
              Acceso exclusivo para personal autorizado
            </ThemedText>
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
    // `flexGrow: 1` mas `justifyContent: 'center'` deja el bloque centrado.
    // El padding de abajo es bastante mayor que el de arriba a proposito: eso
    // sube el conjunto, y con el logo grande el centro caia en el logo en vez
    // de caer en el formulario.
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: 96,
  },
  tarjeta: {
    gap: Spacing.three,
  },
  marca: {
    // Centrado real: el logo mide mas que el titulo, asi que sin esto
    // quedaria pegado al borde izquierdo en vez de centrado.
    // Sin `marginBottom` a proposito: el `gap` de `tarjeta` ya pone los 16px
    // de separacion, y antes se sumaban dos (32px) dejando el nombre
    // despegado del logo.
    alignItems: 'center',
  },
  titulos: {
    gap: Spacing.half,
    marginBottom: Spacing.one,
    alignItems: 'center',
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boton: {
    minHeight: 50,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  botonTexto: {
    color: '#fff',
  },
  botonPulsado: {
    // Un tono MAS oscuro, no uno mas claro: el texto del boton es blanco y
    // sobre la superficie pastel se perderia.
    backgroundColor: '#42326F',
  },
  press: { opacity: 0.8 },
  deshabilitado: { opacity: 0.5 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  reintentar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
  },
  nota: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
});
