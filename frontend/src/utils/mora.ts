import { Pastel, type NombrePastel } from '@/constants/theme';
import { ZONA_OPERACION } from '@/utils/fecha';

/**
 * Color de mora de un cliente, en cinco tramos. La regla la fijo el negocio:
 *
 * - Al dia (sin ninguna cuota vencida): verde.
 * - 1 a 2 dias vencida: amarillo.
 * - 3 a 4 dias: naranja.
 * - 5 dias o mas: rojo.
 *
 * Los dias se cuentan contra la cuota pendiente **mas vieja**, no contra el
 * vencimiento final del credito: ese ultimo es la fecha en que termina de
 * pagar y por lo general esta meses adelante, asi que nunca se veria en rojo.
 */
export type NivelMora = 'al_dia' | 'amarillo' | 'naranja' | 'rojo';

interface Tramo {
  nivel: NivelMora;
  /** Segundos desde epoch de la fecha de vencimiento mas vieja. */
  hastaDias: number;
  color: NombrePastel;
}

const TRAMOS: Tramo[] = [
  { nivel: 'al_dia', hastaDias: 0, color: 'verde' },
  { nivel: 'amarillo', hastaDias: 2, color: 'ambar' },
  { nivel: 'naranja', hastaDias: 4, color: 'naranja' },
  { nivel: 'rojo', hastaDias: Number.POSITIVE_INFINITY, color: 'rojo' },
];

export interface EstadoMora {
  /** Dias completos de mora. `0` cuando el cliente esta al dia. */
  dias: number;
  nivel: NivelMora;
  color: NombrePastel;
  /** Texto corto para la etiqueta: "3 dias de mora". */
  etiqueta: string;
}

/**
 * Las fechas llegan como `YYYY-MM-DD`. Se convierte a una fecha a medianoche
 * **local** y no con `new Date(texto)`, porque eso se interpreta como UTC: en
 * Colombia (UTC-5) un vencimiento del dia 10 marcaria la diferencia como si
 * fuera del dia 9, y un cliente con dos dias de mora aparecia con uno.
 */
function aFechaLocal(iso: string): number {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia).getTime();
}

/**
 * Dias de mora a partir de la fecha de la cuota vencida mas antigua.
 *
 * Distingue tres casos, y la diferencia importa:
 *
 * - Una fecha: hay cuotas vencidas y se cuentan los dias.
 * - `null`: el backend respondio y **no hay ninguna cuota vencida**, o sea el
 *   cliente esta al dia. Se devuelve el tramo verde, no `null`: al dia tambien
 *   es un estado que hay que mostrar, y es el que mas se repite en la cartera.
 * - `undefined`: el backend no mando el campo (version vieja todavia en
 *   ejecucion, o una peticion que fallo). Aqui si se devuelve `null`, porque sin
 *   dato no se puede afirmar que el cliente este al dia y conviene no pintar
 *   verde algo que no se sabe.
 */
export function calcularMora(vencidaMasAntigua: string | null | undefined): EstadoMora | null {
  if (vencidaMasAntigua === undefined) return null;

  const dias = vencidaMasAntigua
    ? diasDeMora(vencidaMasAntigua)
    : 0;

  const tramo = TRAMOS.find((item) => dias <= item.hastaDias) ?? TRAMOS[TRAMOS.length - 1];

  return {
    dias,
    nivel: tramo.nivel,
    color: tramo.color,
    etiqueta:
      dias === 0
        ? 'Al día'
        : dias === 1
          ? '1 día de mora'
          : `${dias} días de mora`,
  };
}

/** Dias completos de mora contra la cuota vencida mas antigua. */
function diasDeMora(vencidaIso: string): number {
  const vencida = aFechaLocal(vencidaIso);

  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_OPERACION,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // `Math.ceil` porque un dia de mora empieza al vencer, no al dia siguiente:
  // lo que vence hoy todavia no cuenta como atraso.
  return Math.max(0, Math.ceil((aFechaLocal(hoy) - vencida) / 86_400_000));
}

/** Tono completo (superficie y texto) del nivel, ya listo para pintar. */
export function tonoMora(mora: EstadoMora) {
  return Pastel[mora.color];
}