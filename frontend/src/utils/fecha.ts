/**
 * Fechas de trabajo del negocio en hora Colombia.
 *
 * `toISOString().slice(0, 10)` devuelve el dia en UTC, y no en la zona donde
 * opera el negocio: entre las 19:00 y las 23:59 de Bogota, UTC ya va al dia
 * siguiente. Una cuota que vence hoy se registraria con la fecha de manana, y
 * un pago hecho a las 10 de la noche caeria en el dia equivocado. Todo lo que
 * sea "hoy" pasa por aqui.
 */
export const ZONA_OPERACION = 'America/Bogota';

export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_OPERACION,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}