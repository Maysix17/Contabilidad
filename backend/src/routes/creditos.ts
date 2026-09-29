import { and, asc, count, desc, eq, exists, ilike, lt, ne, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';

import {
  esPeriodoValido,
  hoy,
  planCredito,
  formatearPesos,
  requiereDiaDePago,
  resumenCuotas,
  type PlanCuota,
} from '@/creditos/calculos';
import { db } from '@/db';
import { abonos, clientes, creditos, cuotas, usuarios, type PeriodoPago } from '@/db/schema';
import { badRequest, conflict, notFound, requireAuth, requireRole } from '@/http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const creditoRoutes = new Hono();

creditoRoutes.use('*', async (c, next) => {
  await requireAuth(c);
  await next();
});

function assertUuid(id: string | undefined, campo: string): string {
  if (!id || !UUID_PATTERN.test(id)) {
    throw badRequest(`El ${campo} no es valido`);
  }
  return id;
}

function assertDate(value: unknown, campo: string): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw badRequest(`${campo} debe tener formato YYYY-MM-DD`);
  }
  return value;
}

function assertPeriodo(value: unknown, campo: string): PeriodoPago {
  if (typeof value !== 'string' || !esPeriodoValido(value)) {
    throw badRequest(`${campo} debe ser diario, semanal, quincenal o mensual`);
  }
  return value;
}

function assertMonto(value: unknown, campo: string): number {
  const monto = Number(value);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw badRequest(`${campo} debe ser un monto positivo en pesos`);
  }
  if (monto > 999_999_999_999) {
    throw badRequest(`${campo} excede el monto maximo permitido`);
  }
  return Math.round(monto * 100) / 100;
}

function assertPorcentaje(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const porcentaje = Number(value);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 1000) {
    throw badRequest('interesPorcentaje debe ser un numero entre 0 y 1000');
  }
  return porcentaje;
}

function assertNumeroPeriodos(value: unknown, formaPago: PeriodoPago): number {
  const periodos = Number(value);
  const maximo = formaPago === 'diario' ? 365 : 80;
  if (!Number.isInteger(periodos) || periodos < 1 || periodos > maximo) {
    throw badRequest(
      formaPago === 'diario'
        ? 'numeroPeriodos debe ser el numero de días, entre 1 y 365'
        : 'numeroPeriodos debe ser el numero de pagos, entre 1 y 80',
    );
  }
  return periodos;
}

function assertDiaPago(value: unknown, formaPago: PeriodoPago): number | null {
  if (!requiereDiaDePago(formaPago)) return null;
  const dia = Number(value);
  if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
    throw badRequest('diaPago debe ser un numero de 1 (lunes) a 7 (domingo)');
  }
  return dia;
}

function optionalText(value: unknown, campo: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${campo} debe ser texto`);
  const text = value.trim();
  if (text.length > maxLength) {
    throw badRequest(`${campo} no puede superar ${maxLength} caracteres`);
  }
  return text === '' ? null : text;
}

type ClienteCredito = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
};

type CuotasCredito = {
  id: string;
  numero: number;
  fechaVencimiento: string;
  monto: string;
  saldoAnterior: string;
  saldoDespues: string;
  estado: string;
  abonoId: string | null;
  pagadoEn: Date | null;
};

type ResumenCuotas = ReturnType<typeof resumenCuotas>;

function decorar(fila: typeof creditos.$inferSelect, cliente: ClienteCredito | null) {
  return {
    ...fila,
    cliente,
  };
}

async function cargarCuotas(creditoId: string): Promise<CuotasCredito[]> {
  return db
    .select({
      id: cuotas.id,
      numero: cuotas.numero,
      fechaVencimiento: cuotas.fechaVencimiento,
      monto: cuotas.monto,
      saldoAnterior: cuotas.saldoAnterior,
      saldoDespues: cuotas.saldoDespues,
      estado: cuotas.estado,
      abonoId: cuotas.abonoId,
      pagadoEn: cuotas.pagadoEn,
    })
    .from(cuotas)
    .where(eq(cuotas.creditoId, creditoId))
    .orderBy(asc(cuotas.numero));
}

function resumenDe(cuotasCredito: CuotasCredito[], saldo: string, valorCuota: string) {
  return resumenCuotas(
    cuotasCredito.map((cuota) => ({
      numero: cuota.numero,
      fechaVencimiento: cuota.fechaVencimiento,
      estado: cuota.estado,
      monto: cuota.monto,
    })),
    saldo,
    valorCuota,
    hoy(),
  );
}

creditoRoutes.get('/', async (c) => {
  const clienteId = c.req.query('clienteId');
  const estado = c.req.query('estado');
  const search = c.req.query('search')?.trim();
  const soloActivos = c.req.query('soloActivos') === 'true';

  const conditions: SQL[] = [];

  if (clienteId) conditions.push(eq(creditos.clienteId, assertUuid(clienteId, 'clienteId')));
  if (estado) {
    if (!['activo', 'finalizado', 'cerrado'].includes(estado)) {
      throw badRequest('estado debe ser activo, finalizado o cerrado');
    }
    conditions.push(eq(creditos.estado, estado as 'activo' | 'finalizado' | 'cerrado'));
  } else if (soloActivos) {
    conditions.push(eq(creditos.estado, 'activo'));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        exists(
          db
            .select({ id: clientes.id })
            .from(clientes)
            .where(
              and(
                eq(clientes.id, creditos.clienteId),
                or(
                  ilike(clientes.nombre, pattern),
                  ilike(clientes.apellido, pattern),
                  ilike(clientes.documento, pattern),
                ),
              ),
            ),
        ),
        ilike(creditos.observaciones, pattern),
      ) as SQL,
    );
  }

  const rows = await db
    .select({
      credito: creditos,
      cliente: {
        id: clientes.id,
        nombre: clientes.nombre,
        apellido: clientes.apellido,
        documento: clientes.documento,
      },
    })
    .from(creditos)
    .leftJoin(clientes, eq(creditos.clienteId, clientes.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(creditos.fechaInicio), desc(creditos.creadoEn))
    .limit(200);

  const referencia = hoy();

  const lista = await Promise.all(
    rows.map(async (row) => {
      const cuotasCredito = await cargarCuotas(row.credito.id);
      return {
        ...decorar(row.credito, row.cliente),
        resumen: resumenDe(cuotasCredito, row.credito.saldo, row.credito.valorCuota),
        cuotas: cuotasCredito,
        referencia,
      };
    }),
  );

  return c.json({ creditos: lista });
});

creditoRoutes.post('/simular', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();

  const plan = planCredito({
    valorOriginal: assertMonto(body.valorOriginal, 'valorOriginal'),
    interesPorcentaje: assertPorcentaje(body.interesPorcentaje),
    formaPago: assertPeriodo(body.formaPago, 'formaPago'),
    numeroPeriodos: assertNumeroPeriodos(body.numeroPeriodos, assertPeriodo(body.formaPago, 'formaPago')),
    fechaInicio: body.fechaInicio ? assertDate(body.fechaInicio, 'fechaInicio') : hoy(),
    diaPago: body.diaPago ? Number(body.diaPago) : null,
  });

  return c.json({ plan });
});

creditoRoutes.post('/', async (c) => {
  const { userId } = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>();

  const clienteId = assertUuid(
    typeof body.clienteId === 'string' ? body.clienteId : undefined,
    'clienteId',
  );
  const formaPago = assertPeriodo(body.formaPago, 'formaPago');
  const valorOriginal = assertMonto(body.valorOriginal, 'valorOriginal');
  const numeroPeriodos = assertNumeroPeriodos(body.numeroPeriodos, formaPago);
  const fechaInicio = body.fechaInicio ? assertDate(body.fechaInicio, 'fechaInicio') : hoy();
  const diaPago = assertDiaPago(body.diaPago, formaPago);

  const [cliente] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      documento: clientes.documento,
    })
    .from(clientes)
    .where(eq(clientes.id, clienteId))
    .limit(1);

  if (!cliente) throw notFound('Cliente no encontrado');

  const [creditoActivo] = await db
    .select({ id: creditos.id })
    .from(creditos)
    .where(and(eq(creditos.clienteId, clienteId), eq(creditos.estado, 'activo')))
    .limit(1);

  if (creditoActivo) {
    throw conflict('El cliente ya tiene un credito activo');
  }

  const plan = planCredito({
    valorOriginal,
    interesPorcentaje: assertPorcentaje(body.interesPorcentaje),
    formaPago,
    numeroPeriodos,
    fechaInicio,
    diaPago,
  });

  const creado = await db.transaction(async (tx) => {
    const [fila] = await tx
      .insert(creditos)
      .values({
        clienteId,
        valorOriginal: plan.valorOriginal.toString(),
        interesPorcentaje: assertPorcentaje(body.interesPorcentaje).toString(),
        interesTotal: plan.interesTotal.toString(),
        totalPagar: plan.totalPagar.toString(),
        valorCuota: plan.valorCuota.toString(),
        saldo: plan.totalPagar.toString(),
        formaPago,
        numeroPeriodos: plan.numeroPeriodos,
        diaPago: plan.diaPago,
        fechaInicio: plan.fechaInicio,
        fechaVencimiento: plan.fechaVencimiento,
        observaciones: optionalText(body.observaciones, 'observaciones', 500),
        creadoPor: userId,
      })
      .returning();

    if (!fila) throw new Error('No se pudo crear el credito');

    await tx.insert(cuotas).values(
      plan.cuotas.map((cuota: PlanCuota) => ({
        creditoId: fila.id,
        numero: cuota.numero,
        fechaVencimiento: cuota.fechaVencimiento,
        monto: cuota.monto.toString(),
        saldoAnterior: cuota.saldoAnterior.toString(),
        saldoDespues: cuota.saldoDespues.toString(),
      })),
    );

    return fila;
  });

  const cuotasCredito = await cargarCuotas(creado.id);

  return c.json(
    {
      credito: {
        ...decorar(creado, cliente as ClienteCredito | null),
        resumen: resumenDe(cuotasCredito, creado.saldo, creado.valorCuota),
        cuotas: cuotasCredito,
        referencia: hoy(),
      },
    },
    201,
  );
});

creditoRoutes.get('/:id', async (c) => {
  const id = assertUuid(c.req.param('id'), 'id del credito');

  const [row] = await db
    .select({
      credito: creditos,
      cliente: {
        id: clientes.id,
        nombre: clientes.nombre,
        apellido: clientes.apellido,
        documento: clientes.documento,
      },
      creador: { nombre: usuarios.nombre, cedula: usuarios.cedula },
    })
    .from(creditos)
    .leftJoin(clientes, eq(creditos.clienteId, clientes.id))
    .leftJoin(usuarios, eq(creditos.creadoPor, usuarios.id))
    .where(eq(creditos.id, id))
    .limit(1);

  if (!row) throw notFound('Credito no encontrado');

  const cuotasCredito = await cargarCuotas(id);

  const historial = await db
    .select({ abono: abonos, registrador: { nombre: usuarios.nombre } })
    .from(abonos)
    .leftJoin(usuarios, eq(abonos.registradoPor, usuarios.id))
    .where(eq(abonos.creditoId, id))
    .orderBy(desc(abonos.fecha), desc(abonos.creadoEn));

  // Misma forma que devuelve el listado, mas `creador` y `abonos`.
  const referencia = hoy();

  return c.json({
    credito: {
      ...decorar(row.credito, row.cliente),
      resumen: resumenDe(cuotasCredito, row.credito.saldo, row.credito.valorCuota),
      cuotas: cuotasCredito,
      referencia,
      creador: row.creador,
    },
    abonos: historial.map((item) => ({ ...item.abono, registrador: item.registrador })),
  });
});

creditoRoutes.post('/:id/abonos', async (c) => {
  const { userId } = await requireAuth(c);
  const id = assertUuid(c.req.param('id'), 'id del credito');
  const body = await c.req.json<Record<string, unknown>>();

  const monto = assertMonto(body.monto, 'monto');
  const fecha = body.fecha ? assertDate(body.fecha, 'fecha') : hoy();
  const cuotaId = body.cuotaId ? assertUuid(body.cuotaId as string, 'cuotaId') : null;

  const [credito] = await db.select().from(creditos).where(eq(creditos.id, id)).limit(1);
  if (!credito) throw notFound('Credito no encontrado');
  if (credito.estado === 'cerrado') {
    throw conflict('No se pueden registrar abonos en un credito cerrado');
  }

  const [cliente] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      documento: clientes.documento,
    })
    .from(clientes)
    .where(eq(clientes.id, credito.clienteId))
    .limit(1);

  const saldoAnterior = Math.round(Number(credito.saldo) * 100) / 100;
  if (saldoAnterior <= 0) throw conflict('El credito ya esta pagado');

  let saldoDespues = Math.round((saldoAnterior - monto) * 100) / 100;
  if (saldoDespues < 0) {
    throw badRequest('El abono es mayor que el saldo pendiente');
  }

  if (cuotaId) {
    const [cuota] = await db
      .select()
      .from(cuotas)
      .where(and(eq(cuotas.id, cuotaId), eq(cuotas.creditoId, id)))
      .limit(1);

    if (!cuota) throw notFound('La cuota no pertenece a este credito');
    if (cuota.estado === 'pagada') throw conflict('La cuota ya esta pagada');

    /**
     * Las cuotas se pagan en orden: no se puede saltar una pendiente y saldar
     * una futura, porque eso dejaria meses sin cubrir y el atraso pasaria
     * desapercibido. Solo se habilita la mas antigua pendiente, y el abono
     * libre cubre varias contiguas de una vez.
     */
    const [anteriores] = await db
      .select({ total: count() })
      .from(cuotas)
      .where(
        and(
          eq(cuotas.creditoId, id),
          lt(cuotas.numero, cuota.numero),
          ne(cuotas.estado, 'pagada'),
        ),
      );

    if (anteriores && Number(anteriores.total) > 0) {
      throw conflict('Primero debes liquidar las cuotas anteriores');
    }

    const valorCuota = Math.round(Number(cuota.monto) * 100) / 100;
    if (Math.round((monto - valorCuota) * 100) / 100 !== 0) {
      throw badRequest(
        `El abono debe ser exactamente el valor de la cuota (${formatearPesos(valorCuota)})`,
      );
    }
  }

  if (!cuotaId) {
    const pendientes = await db
      .select({ id: cuotas.id, monto: cuotas.monto })
      .from(cuotas)
      .where(and(eq(cuotas.creditoId, id), eq(cuotas.estado, 'pendiente')))
      .orderBy(asc(cuotas.numero));

    const primera = pendientes[0];

    if (!primera) {
      throw conflict('Este credito no tiene cuotas pendientes por pagar');
    }

    /**
     * El abono libre solo admite importes que cubran cuotas enteras. Aceptar un
     * resto haria que el saldo del credito bajara por el monto completo mientras
     * ese resto no se imputaria a ninguna cuota, y el plan de pagos quedaria
     * descuadrado: quedarian cuotas "pendientes" que ya no suman el saldo y que
     * despues no se podrian pagar de forma individual.
     */
    let acumulado = 0;
    const aceptables: number[] = [];

    for (const cuota of pendientes) {
      const valor = Math.round(Number(cuota.monto) * 100) / 100;
      acumulado = Math.round((acumulado + valor) * 100) / 100;
      aceptables.push(acumulado);
    }

    const esValido = aceptables.some((valor) => Math.round((monto - valor) * 100) === 0);

    if (!esValido) {
      const valorPrimera = Math.round(Number(primera.monto) * 100) / 100;

      if (monto < valorPrimera) {
        throw badRequest(
          `El abono debe ser de al menos ${formatearPesos(valorPrimera)}, el valor de la cuota pendiente mas antigua`,
        );
      }

      // A igualdad de distancia se sugiere el importe mayor: si el usuario
      // escribio de mas, lo util es completar las cuotas que faltan, no
      // devolverle un numero mas pequeno que el que el mismo propuso.
      const masCercano = aceptables.reduce((mejor, valor) => {
        const distancia = Math.abs(valor - monto);
        const distanciaMejor = Math.abs(mejor - monto);
        const gana = distancia < distanciaMejor || (distancia === distanciaMejor && valor > mejor);
        return gana ? valor : mejor;
      });

      throw badRequest(
        `El abono debe cubrir cuotas completas. El importe mas cercano es ${formatearPesos(masCercano)}`,
      );
    }
  }

  const resultado = await db.transaction(async (tx) => {
    const [abono] = await tx
      .insert(abonos)
      .values({
        creditoId: id,
        cuotaId,
        monto: monto.toString(),
        fecha,
        referencia: optionalText(body.referencia, 'referencia', 60),
        observaciones: optionalText(body.observaciones, 'observaciones', 500),
        saldoAnterior: saldoAnterior.toString(),
        saldoDespues: saldoDespues.toString(),
        registradoPor: userId,
      })
      .returning();

    if (cuotaId) {
      await tx
        .update(cuotas)
        .set({ estado: 'pagada', abonoId: abono!.id, pagadoEn: new Date() })
        .where(eq(cuotas.id, cuotaId));
    } else {
      const pendientes = await tx
        .select()
        .from(cuotas)
        .where(and(eq(cuotas.creditoId, id), eq(cuotas.estado, 'pendiente')))
        .orderBy(asc(cuotas.numero));

      let restante = monto;
      for (const cuota of pendientes) {
        if (restante <= 0) break;
        const valor = Math.round(Number(cuota.monto) * 100) / 100;
        if (restante + 0.001 >= valor) {
          await tx
            .update(cuotas)
            .set({ estado: 'pagada', abonoId: abono!.id, pagadoEn: new Date() })
            .where(eq(cuotas.id, cuota.id));
          restante = Math.round((restante - valor) * 100) / 100;
        }
      }
    }

    const [actualizado] = await tx
      .update(creditos)
      .set({
        saldo: saldoDespues.toString(),
        estado: saldoDespues === 0 ? 'finalizado' : 'activo',
        actualizadoEn: new Date(),
      })
      .where(eq(creditos.id, id))
      .returning();

    return { abono, actualizado };
  });

  const cuotasCredito = await cargarCuotas(id);
  const referencia = hoy();

  return c.json(
    {
      abono: resultado.abono,
      credito: {
        ...decorar(resultado.actualizado!, cliente as ClienteCredito | null),
        resumen: resumenDe(cuotasCredito, resultado.actualizado!.saldo, credito.valorCuota),
        cuotas: cuotasCredito,
        referencia,
      },
      saldo: saldoDespues,
      estado: saldoDespues === 0 ? 'finalizado' : 'activo',
    },
    201,
  );
});

creditoRoutes.post('/abonos/:abonoId/anular', async (c) => {
  await requireRole(c, 'administrador');

  const abonoId = assertUuid(c.req.param('abonoId'), 'id del abono');
  const body = await c.req.json<{ motivo?: unknown }>();
  const motivo = optionalText(body.motivo, 'motivo', 500);
  if (!motivo) throw badRequest('Debes indicar el motivo de la anulacion');

  const [abono] = await db.select().from(abonos).where(eq(abonos.id, abonoId)).limit(1);
  if (!abono) throw notFound('Abono no encontrado');
  if (abono.anuladoEn) throw conflict('El abono ya fue anulado');

  const [credito] = await db.select().from(creditos).where(eq(creditos.id, abono.creditoId)).limit(1);
  if (!credito) throw notFound('Credito no encontrado');

  const monto = Math.round(Number(abono.monto) * 100) / 100;
  const saldoRestaurado = Math.round((Number(credito.saldo) + monto) * 100) / 100;

  const { userId } = await requireAuth(c);

  await db.transaction(async (tx) => {
    await tx
      .update(abonos)
      .set({ anuladoEn: new Date(), anuladoPor: userId, motivoAnulacion: motivo })
      .where(eq(abonos.id, abonoId));

    if (abono.cuotaId) {
      await tx
        .update(cuotas)
        .set({ estado: 'pendiente', abonoId: null, pagadoEn: null })
        .where(eq(cuotas.id, abono.cuotaId!));
    } else {
      const pagadas = await tx
        .select()
        .from(cuotas)
        .where(and(eq(cuotas.creditoId, abono.creditoId), eq(cuotas.abonoId, abonoId)));

      for (const cuota of pagadas) {
        await tx
          .update(cuotas)
          .set({ estado: 'pendiente', abonoId: null, pagadoEn: null })
          .where(eq(cuotas.id, cuota.id));
      }
    }

    await tx
      .update(creditos)
      .set({
        saldo: saldoRestaurado.toString(),
        estado: 'activo',
        actualizadoEn: new Date(),
      })
      .where(eq(creditos.id, abono.creditoId));
  });

  return c.json({ anulado: abonoId, saldo: saldoRestaurado });
});

creditoRoutes.post('/:id/cerrar', async (c) => {
  await requireRole(c, 'administrador');

  const id = assertUuid(c.req.param('id'), 'id del credito');
  const body = await c.req.json<{ motivo?: unknown }>();

  const [row] = await db
    .update(creditos)
    .set({
      estado: 'cerrado',
      cerradoEn: new Date(),
      observaciones: optionalText(body.motivo, 'motivo', 500),
      actualizadoEn: new Date(),
    })
    .where(eq(creditos.id, id))
    .returning();

  if (!row) throw notFound('Credito no encontrado');

  return c.json({ credito: row });
});

creditoRoutes.delete('/:id', async (c) => {
  await requireRole(c, 'administrador');

  const id = assertUuid(c.req.param('id'), 'id del credito');
  const row = await db.delete(creditos).where(eq(creditos.id, id)).returning({ id: creditos.id });

  if (row.length === 0) throw notFound('Credito no encontrado');

  return c.json({ eliminado: id });
});

creditoRoutes.get('/cliente/:clienteId', async (c) => {
  const clienteId = assertUuid(c.req.param('clienteId'), 'clienteId');

  const rows = await db
    .select({
      credito: creditos,
      cliente: {
        id: clientes.id,
        nombre: clientes.nombre,
        apellido: clientes.apellido,
        documento: clientes.documento,
      },
    })
    .from(creditos)
    .leftJoin(clientes, eq(creditos.clienteId, clientes.id))
    .where(eq(creditos.clienteId, clienteId))
    .orderBy(desc(creditos.fechaInicio));

  const referencia = hoy();

  const lista = await Promise.all(
    rows.map(async (row) => {
      const cuotasCredito = await cargarCuotas(row.credito.id);
      return {
        ...decorar(row.credito, row.cliente),
        resumen: resumenDe(cuotasCredito, row.credito.saldo, row.credito.valorCuota),
        cuotas: cuotasCredito,
        referencia,
      };
    }),
  );

  return c.json({ creditos: lista });
});
