import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Pastel } from '@/constants/theme';

/**
 * Marca de la app.
 *
 * Hay dos caminos:
 *
 * 1. Sin `imagen`: dibuja una version vectorial con Views. No necesita archivo,
 *    se ve nitida en cualquier resolucion y sirve de identidad provisional.
 * 2. Con `imagen`: usa el archivo que le pases, util cuando tengas el logo
 *    real del cliente.
 *
 * Para usar un logo propio, deja el archivo en `frontend/assets/images/logo.png`
 * y en la pantalla llama `<Logo imagen={require('@/assets/images/logo.png')} />`.
 */
export function Logo({ size = 56, imagen }: { size?: number; imagen?: ImageSource }) {
  if (imagen) {
    return (
      <Image
        source={imagen}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size * 0.26 },
      ]}
      accessibilityRole="image"
      accessibilityLabel="Circuit">
      {/* Tres renglones: el mas corto abajo, para que se lea como una lista de
          registros y no como un menu de tres rayas. */}
      <View
        style={[
          styles.renglon,
          {
            top: size * 0.28,
            left: size * 0.2,
            width: size * 0.46,
            height: size * 0.085,
            borderRadius: size * 0.05,
          },
        ]}
      />
      <View
        style={[
          styles.renglon,
          {
            top: size * 0.45,
            left: size * 0.2,
            width: size * 0.46,
            height: size * 0.085,
            borderRadius: size * 0.05,
          },
        ]}
      />
      <View
        style={[
          styles.renglon,
          {
            top: size * 0.62,
            left: size * 0.2,
            width: size * 0.26,
            height: size * 0.085,
            borderRadius: size * 0.05,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Pastel.azul.texto,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  renglon: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});