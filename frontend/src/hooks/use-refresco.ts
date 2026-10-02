import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * Recarga los datos de una pantalla en los momentos en que quedan viejos sin
 * que la persona haya tocado nada:
 *
 * - **Al entrar y al volver desde otra pantalla.** React Navigation deja las
 *   pestañas y el stack montados, asi que un `useEffect` de montaje no vuelve a
 *   correr. Sin esto, registrar un abono y volver con el boton atras deja el
 *   saldo anterior en pantalla, que es el peor dato viejo posible en una app de
 *   cobranza.
 * - **Al cambiar cualquier filtro**, porque `cargar` ya es un `useCallback` y su
 *   identidad cambia cuando cambia el buscador, el estado o la fecha.
 * - **Al volver la app desde segundo plano**, que no desenfoca la navegacion pero
 *   si invalida lo que otra pantalla haya movido mientras tanto.
 *
 * `debounceMs` evita una peticion por tecla en los buscadores.
 *
 * El temporizador va dentro del efecto a proposito: cada corrida limpia el
 * anterior, asi hay una sola peticion por cambio en lugar de una por efecto.
 *
 * `cargar` debe ser un `useCallback`: su identidad es la senal de recarga.
 */
export function useRefresco(cargar: () => Promise<void> | void, debounceMs = 0): void {
  useFocusEffect(
    useCallback(() => {
      const espera = setTimeout(() => {
        void cargar();
      }, debounceMs);

      return () => clearTimeout(espera);
    }, [cargar, debounceMs]),
  );

  useEffect(() => {
    let vuelveDeFondo = false;

    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') {
        vuelveDeFondo = true;
        return;
      }
      // Solo al volver de verdad: al montar, el foco ya trajo los datos.
      if (vuelveDeFondo) void cargar();
      vuelveDeFondo = false;
    });

    return () => suscripcion.remove();
  }, [cargar]);
}