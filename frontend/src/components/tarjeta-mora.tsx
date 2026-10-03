import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { calcularMora, tonoMora } from '@/utils/mora';

/**
 * Tarjeta marcada con la mora: una franja de color en el borde izquierdo y un
 * tinte muy suave de fondo.
 *
 * Se prefirió una franja a pintar toda la tarjeta porque en las listas de
 * cobranza hay muchas filas, y una superficie saturada en todas a la vez deja el
 * texto difícil de leer. La franja se percibe al recorrer la lista con el
 * rabillo del ojo y deja el centro libre para los datos.
 *
 * Sin mora devuelve la tarjeta normal. Ojo con la distincion: `null` de
 * `calcularMora` ya no significa "al dia" sino "no hay dato" (backend sin el
 * campo, o peticion que fallo), que es el unico caso en que conviene no pintar
 * nada, porque ahi no se puede afirmar que el cliente este al dia. El cliente al
 * dia si va marcado, en verde, porque es un estado mas de la escala y no la
 * ausencia de estado.
 */
export function TarjetaMora({
  vencidaMasAntigua,
  children,
  style,
}: {
  vencidaMasAntigua: string | null | undefined;
  children: ReactNode;
  style?: object;
}) {
  const mora = calcularMora(vencidaMasAntigua);

  if (!mora) {
    return (
      <ThemedView type="backgroundElement" style={style}>
        {children}
      </ThemedView>
    );
  }

  const tono = tonoMora(mora);

  return (
    <ThemedView
      style={[styles.tarjeta, style, { backgroundColor: tono.superficie, borderLeftColor: tono.solido }]}>
      {children}
    </ThemedView>
  );
}

/**
 * Etiqueta con los dias de mora. Opcional a proposito: en las listas el color
 * ya basta y el texto compite por el espacio. Sirve donde el numero de dias es
 * el dato que interesa.
 */
export function EtiquetaMora({
  vencidaMasAntigua,
}: {
  vencidaMasAntigua: string | null | undefined;
}) {
  const mora = calcularMora(vencidaMasAntigua);
  if (!mora) return null;

  const tono = tonoMora(mora);

  return (
    <View style={[styles.etiqueta, { backgroundColor: tono.superficie }]}>
      <ThemedText type="smallBold" style={{ color: tono.texto }}>
        {mora.etiqueta}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    borderLeftWidth: 5,
  },
  etiqueta: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    marginTop: Spacing.one,
  },
});