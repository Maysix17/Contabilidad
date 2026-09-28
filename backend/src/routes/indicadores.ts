import { and, desc, eq, gte, isNull, sql, sum } from 'drizzle-orm';
import { Hono } from 'hono';

import { hoy, resumenCuotas } from '@/creditos/calculos';
import { db } from '@/db';
import { abonos, clientes, creditos, cuotas, rutas } from '@/db/schema';
import { requireAuth } from '@/http';

export const indicadorRoutes = new Hono();

indicadorRoutes.use('*', async (c, next) => {
  await requireAuth(c);
  await next();
});

function aNumero(valor: string | number | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function inicioMes(referencia: string): string {
  return `${referencia.slice(0, 7)}-01`;
}

indicadorRoutes.get('/', async (c) => {
  const referencia = hoy();
  const desdeMes = inicioMes(referencia);

  const [totales] = await db
    .select({
      cantidad: sql<number>`count(*)::int`,
      saldoPorCobrar: sum(creditos.saldo),
    })
    .from(creditos)
    .where(eq(creditos.estado, 'activo'));

  const [finalizados] = await db
    .select({ cantidad: sql<number>`count(*)::int` })
    .from(creditos)
    .where(eq(creditos.estado, 'finalizado'));

  const [cerrados] = await db
    .select({ cantidad: sql<number>`count(*)::int` })
    .from(creditos)
    .where(eq(creditos.estado, 'cerrado'));

  const [abonosMes] = await db
    .select({ total: sum(abonos.monto) })
    .from(abonos)
    .where(and(isNull(abonos.anuladoEn), gte(abonos.fecha, desdeMes)));

  const [clientesActivos] = await db
    .select({ cantidad: sql<number>`count(*)::int` })
    .from(clientes)
    .where(eq(clientes.activo, true));

  // Mora: cuotas pendientes cuya fecha de vencimiento ya paso.
  const [mora] = await db
    .select({ cantidad: sql<number>`count(*)::int` })
    .from(cuotas)
    .innerJoin(creditos, eq(cuotas.creditoId, creditos.id))
    .where(
      and(
        eq(cuotas.estado, 'pendiente'),
        sql`${cuotas.fechaVencimiento} < ${referencia}`,
        eq(creditos.estado, 'activo'),
      ),
    );

  const filas = await db
    .select({
      id: creditos.id,
      clienteId: creditos.clienteId,
      saldo: creditos.saldo,
      valorCuota: creditos.valorCuota,
      totalPagar: creditos.totalPagar,
      numeroPeriodos: creditos.numeroPeriodos,
      fechaVencimiento: creditos.fechaVencimiento,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      documento: clientes.documento,
    })
    .from(creditos)
    .innerJoin(clientes, eq(creditos.clienteId, clientes.id))
    .where(eq(creditos.estado, 'activo'))
    .orderBy(desc(creditos.saldo))
    .limit(200);

  const cuotaIds = filas.map((fila) => fila.id);
  const cuotasPorCredito = new Map<string, Parameters<typeof resumenCuotas>[0]>();

  if (cuotaIds.length > 0) {
    const todas = await db
      .select({
        creditoId: cuotas.creditoId,
        numero: cuotas.numero,
        fechaVencimiento: cuotas.fechaVencimiento,
        estado: cuotas.estado,
        monto: cuotas.monto,
      })
      .from(cuotas)
      .where(eq(cuotas.estado, 'pendiente'));

    for (const cuota of todas) {
      if (!cuotaIds.includes(cuota.creditoId)) continue;
      const lista = cuotasPorCredito.get(cuota.creditoId) ?? [];
      lista.push(cuota);
      cuotasPorCredito.set(cuota.creditoId, lista);
    }
  }

  const topDeudores: Array<Record<string, unknown>> = [];
  let clientesEnMora = 0;
  let saldoVencido = 0;

  for (const fila of filas) {
    const resumen = resumenCuotas(
      (cuotasPorCredito.get(fila.id) ?? []) as Parameters<typeof resumenCuotas>[0],
      fila.saldo,
      fila.valorCuota,
      referencia,
    );

    if (resumen.atrasadas > 0) {
      clientesEnMora += 1;
      saldoVencido = Math.round((saldoVencido + aNumero(fila.saldo)) * 100) / 100;
    }

    if (topDeudores.length < 5) {
      topDeudores.push({
        creditoId: fila.id,
        clienteId: fila.clienteId,
        nombre: fila.nombre,
        apellido: fila.apellido,
        documento: fila.documento,
        saldo: aNumero(fila.saldo),
        valorCuota: aNumero(fila.valorCuota),
        cuotasPendientes: resumen.pendientes,
        cuotasAtrasadas: resumen.atrasadas,
        proximaVencimiento: resumen.proximaVencimiento,
      });
    }
  }

  const proximosVencimientos = filas
    .map((fila) => {
      const resumen = resumenCuotas(
        (cuotasPorCredito.get(fila.id) ?? []) as Parameters<typeof resumenCuotas>[0],
        fila.saldo,
        fila.valorCuota,
        referencia,
      );
      return {
        creditoId: fila.id,
        cliente: `${fila.nombre} ${fila.apellido}`,
        documento: fila.documento,
        fechaVencimiento: resumen.proximaVencimiento,
        valorCuota: aNumero(fila.valorCuota),
        saldo: aNumero(fila.saldo),
      };
    })
    .filter((item) => item.fechaVencimiento !== null)
    .sort((a, b) => String(a.fechaVencimiento).localeCompare(String(b.fechaVencimiento)))
    .slice(0, 5);

  const [rutasActivas] = await db
    .select({ cantidad: sql<number>`count(*)::int` })
    .from(rutas)
    .where(sql`${rutas.estado} <> 'cerrada'`);

  return c.json({
    indicadores: {
      referencia,
      creditosActivos: totales?.cantidad ?? 0,
      creditosFinalizados: finalizados?.cantidad ?? 0,
      creditosCerrados: cerrados?.cantidad ?? 0,
      saldoPorCobrar: Math.round(aNumero(totales?.saldoPorCobrar) * 100) / 100,
      abonosDelMes: Math.round(aNumero(abonosMes?.total) * 100) / 100,
      clientesActivos: clientesActivos?.cantidad ?? 0,
      clientesEnMora,
      saldoVencido,
      cuotasAtrasadas: mora?.cantidad ?? 0,
      rutasActivas: rutasActivas?.cantidad ?? 0,
    },
    topDeudores,
    proximosVencimientos,
  });
});
