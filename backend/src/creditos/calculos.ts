import type { PeriodoPago } from '@/db/schema';

const MS_POR_DIA = 86_400_000;

/** Domingo = 0 en getUTCDay(). Los dias de cobro normales son lunes a sabado. */
export const DIAS_COBRO = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'] as const;

const DIAS_POR_PERIODO: Record<PeriodoPago, number> = {
  diario: 1,
  semanal: 7,
  quincenal: 15,
  mensual: 0,
};

export const PERIODOS_PAGO: PeriodoPago[] = ['diario', 'semanal', 'quincenal', 'mensual'];

export const ETIQUETA_PERIODO: Record<PeriodoPago, string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
};

export function esPeriodoValido(valor: string): valor is PeriodoPago {
  return PERIODOS_PAGO.includes(valor as PeriodoPago);
}

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number): string {
  const fecha = aFecha(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aIso(fecha);
}

/**
 * Suma meses sin desbordar el final de mes.
 *
 * `setUTCMonth` con el dia original produce fechas que no existen: el 31 de
 * enero + 1 mes pide el 31 de febrero, que JavaScript no resuelve a "fin de
 * febrero" sino que se desborda al 3 de marzo, y el calendario de pagos queda
 * corrido un mes entero. Primero se ancla en el dia 1 para sumar meses sin
 * arrastre, y despues se vuelve al dia original, recortado al ultimo dia del
 * mes destino cuando ese dia no existe.
 */
export function sumarMeses(iso: string, meses: number): string {
  const fecha = aFecha(iso);
  const dia = fecha.getUTCDate();

  fecha.setUTCDate(1);
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);

  const ultimoDiaDelMes = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0),
  ).getUTCDate();

  fecha.setUTCDate(Math.min(dia, ultimoDiaDelMes));

  return aIso(fecha);
}

export function diferenciaEnDias(desde: string, hasta: string): number {
  return Math.floor((aFecha(hasta).getTime() - aFecha(desde).getTime()) / MS_POR_DIA);
}

/** Dia de la semana: 1 = lunes ... 6 = sabado, 7 = domingo. */
export function diaSemana(iso: string): number {
  const dia = aFecha(iso).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function esDomingo(iso: string): boolean {
  return aFecha(iso).getUTCDay() === 0;
}

/**
 * Regla 7 y 8: el domingo no es dia normal de cobro. Si una cuota cae en
 * domingo se adelanta al sabado anterior para que el cobro siga siendo posible.
 */
export function ajustarDiaDeCobro(iso: string): string {
  return esDomingo(iso) ? sumarDias(iso, -1) : iso;
}

export function sumarPeriodos(iso: string, periodo: PeriodoPago, cantidad: number): string {
  if (periodo === 'mensual') {
    return sumarMeses(iso, cantidad);
  }
  return sumarDias(iso, DIAS_POR_PERIODO[periodo] * cantidad);
}

/** El dia de pago solo aplica a la forma semanal. */
export function requiereDiaDePago(periodo: PeriodoPago): boolean {
  return periodo === 'semanal';
}

function redondearMoneda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Muestra un monto como lo escribe una persona en Colombia, con los centavos
 * solo cuando importan. Sirve para que los mensajes de error digan
 * "92.307,69" y no "92307.7", que es lo que el usuario no puede leer.
 */
export function formatearPesos(valor: number): string {
  const centavos = Math.round(valor * 100);

  if (centavos % 100 === 0) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(centavos / 100);
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

export interface ParametrosCredito {
  valorOriginal: string | number;
  interesPorcentaje: string | number;
  formaPago: PeriodoPago;
  numeroPeriodos: number;
  fechaInicio: string;
  diaPago?: number | null;
}

export interface PlanCuota {
  numero: number;
  fechaVencimiento: string;
  monto: number;
  saldoAnterior: number;
  saldoDespues: number;
}

export interface PlanCredito {
  valorOriginal: number;
  interesTotal: number;
  totalPagar: number;
  valorCuota: number;
  numeroPeriodos: number;
  formaPago: PeriodoPago;
  fechaInicio: string;
  fechaVencimiento: string;
  diaPago: number | null;
  cuotas: PlanCuota[];
}

function aNumero(valor: string | number | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Interes fijo: se calcula una sola vez sobre el capital y el total queda
 * congelado al crear el credito. Ejemplo del requerimiento: capital 2.000.000,
 * interes 20%, total 2.400.000, 40 cuotas de 60.000.
 */
export function calcularInteresTotal(valorOriginal: number, interesPorcentaje: number): number {
  if (interesPorcentaje <= 0) return 0;
  return redondearMoneda(valorOriginal * (interesPorcentaje / 100));
}

/**
 * Reparte el total entre las cuotas sin perder ni ganar un peso.
 *
 * El total casi nunca se divide exacto entre el numero de cuotas, asi que se
 * calcula en centavos enteros: todas las cuotas valen la parte que "cabe" y la
 * ultima se queda con lo que sobra. Con 2.400.000 en 26 cuotas son 25 de
 * 92.307,69 y la ultima de 92.307,75, que suma justo 2.400.000. Concentrar la
 * diferencia en la ultima cuota es preferible a repartirla entre las primeras:
 * asi el cliente ve el mismo valor en todas las cuotas y solo la ultima, que ya
 * es un caso aparte, se ajusta.
 *
 * Devuelve centavos enteros; el resto del modulo trabaja en pesos.
 */
export function repartirCuotas(total: number, numeroPeriodos: number): number[] {
  const totalCentavos = Math.round(total * 100);

  if (numeroPeriodos <= 0) return [totalCentavos / 100];

  const baseCentavos = Math.floor(totalCentavos / numeroPeriodos);
  const montos: number[] = [];

  for (let i = 0; i < numeroPeriodos; i += 1) {
    const centavos =
      i === numeroPeriodos - 1
        ? totalCentavos - baseCentavos * (numeroPeriodos - 1)
        : baseCentavos;
    montos.push(centavos / 100);
  }

  return montos;
}

/** Calcula la primera fecha de vencimiento segun la forma de pago. */
export function calcularPrimeraVencimiento(input: {
  fechaInicio: string;
  formaPago: PeriodoPago;
  diaPago: number | null;
}): string {
  const { fechaInicio, formaPago, diaPago } = input;

  if (formaPago !== 'semanal') {
    return ajustarDiaDeCobro(sumarPeriodos(fechaInicio, formaPago, 1));
  }

  const objetivo = diaPago && diaPago >= 1 && diaPago <= 7 ? diaPago : diaSemana(fechaInicio);
  let candidato = fechaInicio;
  // Avanza como maximo 7 dias hasta encontrar el dia de pago solicitado.
  for (let i = 0; i < 8; i += 1) {
    if (diaSemana(candidato) === objetivo) break;
    candidato = sumarDias(candidato, 1);
  }

  return ajustarDiaDeCobro(candidato);
}

export function planCredito(input: ParametrosCredito): PlanCredito {
  const valorOriginal = aNumero(input.valorOriginal);
  const interesPorcentaje = aNumero(input.interesPorcentaje);
  const numeroPeriodos = Math.max(1, input.numeroPeriodos);
  const diaPago = requiereDiaDePago(input.formaPago) ? (input.diaPago ?? null) : null;

  const interesTotal = calcularInteresTotal(valorOriginal, interesPorcentaje);
  const totalPagar = redondearMoneda(valorOriginal + interesTotal);
  const montos = repartirCuotas(totalPagar, numeroPeriodos);

  const primera = calcularPrimeraVencimiento({
    fechaInicio: input.fechaInicio,
    formaPago: input.formaPago,
    diaPago,
  });

  const cuotas: PlanCuota[] = [];
  let saldo = totalPagar;

  for (let i = 0; i < numeroPeriodos; i += 1) {
    // El mensual se ancla en la fecha de inicio y no en la primera cuota: si se
    // encadenara desde "primera", un credito del 31 quedaria clavado en el 28
    // para siempre, porque ese dia fue el recorte del 31 de enero.
    const fechaVencimiento =
      input.formaPago === 'mensual'
        ? ajustarDiaDeCobro(sumarMeses(input.fechaInicio, i + 1))
        : i === 0
          ? primera
          : ajustarDiaDeCobro(sumarPeriodos(primera, input.formaPago, i));

    const monto = montos[i] ?? 0;
    const saldoAnterior = redondearMoneda(saldo);
    saldo = redondearMoneda(saldo - monto);

    cuotas.push({
      numero: i + 1,
      fechaVencimiento,
      monto,
      saldoAnterior,
      saldoDespues: saldo,
    });
  }

  return {
    valorOriginal,
    interesTotal,
    totalPagar,
    valorCuota: montos[0] ?? 0,
    numeroPeriodos,
    formaPago: input.formaPago,
    fechaInicio: input.fechaInicio,
    fechaVencimiento: cuotas[cuotas.length - 1]?.fechaVencimiento ?? input.fechaInicio,
    diaPago,
    cuotas,
  };
}

export interface EstadoCuotas {
  total: number;
  pagadas: number;
  pendientes: number;
  atrasadas: number;
  proximaVencimiento: string | null;
  saldoTotal: number;
  valorCuota: number;
}

export interface CuotaParaResumen {
  numero: number;
  fechaVencimiento: string;
  estado: string;
  monto: string | number;
}

/** Regla 6: las cuotas atrasadas se calculan solas comparando contra la fecha de hoy. */
export function resumenCuotas(
  cuotas: CuotaParaResumen[],
  saldo: string | number,
  valorCuota: string | number,
  fechaReferencia: string,
): EstadoCuotas {
  const pagadas = cuotas.filter((cuota) => cuota.estado === 'pagada');
  const pendientes = cuotas.filter((cuota) => cuota.estado !== 'pagada');
  const proxima = pendientes.sort((a, b) => a.numero - b.numero)[0] ?? null;

  return {
    total: cuotas.length,
    pagadas: pagadas.length,
    pendientes: pendientes.length,
    atrasadas: pendientes.filter((cuota) => cuota.fechaVencimiento < fechaReferencia).length,
    proximaVencimiento: proxima?.fechaVencimiento ?? null,
    saldoTotal: aNumero(saldo),
    valorCuota: aNumero(valorCuota),
  };
}

export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
