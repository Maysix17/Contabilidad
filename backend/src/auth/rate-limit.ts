/**
 * Limite de intentos fallidos de inicio de sesion.
 *
 * Sin esto, con la API en internet, las cedulas colombianas (9 y 10 digitos)
 * se pueden recorrer por fuerza bruta: no hay ni usuario ni bloqueo, solo la
 * comparacion contra el hash. Es un ataque trivial de ejecutar y pondria en
 * riesgo los saldos de cobranza de los clientes.
 *
 * El contador vive en memoria del proceso, que es lo que alcanza para una
 * instancia. Si la API se replica horizontalmente habria que moverlo a la base
 * o a Redis, porque hoy cada proceso contaria por separado.
 */

import type { Context } from 'hono';

const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

interface Registro {
  intentos: number;
  reiniciaEn: number;
}

const registros = new Map<string, Registro>();

/**
 * Descarta las ventanas vencidas a medida que se consultan. Sin esto el mapa
 * guardaria una entrada por cada direccion IP vista para siempre.
 */
function purgar(): void {
  const ahora = Date.now();
  for (const [clave, registro] of registros) {
    if (registro.reiniciaEn <= ahora) registros.delete(clave);
  }
}

/**
 * Direccion del cliente. Detras de un proxy (Railway, un balanceador) llega en
 * `x-forwarded-for`; si no hay ninguna, todos caen en el mismo bucket. Es
 * deliberado: preferimos que un atacante sin cabecera bloquee a los demas antes
 * que abrir la fuerza bruta sin limite.
 */
function claveDe(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';
}

export function registrarIntento(c: Context): void {
  const clave = claveDe(c);
  const ahora = Date.now();
  const registro = registros.get(clave);

  if (!registro || registro.reiniciaEn <= ahora) {
    registros.set(clave, { intentos: 1, reiniciaEn: ahora + VENTANA_MS });
    return;
  }

  registro.intentos += 1;
}

/** Se llama cuando el login fue exitoso, para no castigar al usuario real. */
export function limpiarIntentos(c: Context): void {
  registros.delete(claveDe(c));
}

/**
 * Indica si esta clave ya agoto sus intentos. No lanza: el mensaje exacto lo
 * pone la ruta, para no filtrar por que se bloquea.
 *
 * La purga corre aca porque esta es la unica funcion que consulta el mapa en el
 * camino de un login, y sin ella guardaria una entrada por cada direccion vista
 * para siempre.
 */
export function exceeded(c: Context): boolean {
  purgar();

  const registro = registros.get(claveDe(c));
  return registro ? registro.intentos >= MAX_INTENTOS : false;
}