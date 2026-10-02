import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import { Hono, type Context } from 'hono';

import { hoy } from '@/creditos/calculos';
import { db } from '@/db';
import {
  abonos,
  clientes,
  creditos,
  cuotas,
  rutas,
  rutasClientes,
  usuarios,
  type EstadoRuta,
  type RolUsuario,
} from '@/db/schema';
import { badRequest, conflict, forbidden, notFound, requireAuth, requireRole, unauthorized } from '@/http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS: EstadoRuta[] = ['pendiente', 'abierta', 'en_proceso', 'cerrada'];

export const rutaRoutes = new Hono();

rutaRoutes.use('*', async (c, next) => {
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

function optionalText(value: unknown, campo: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${campo} debe ser texto`);
  const text = value.trim();
  if (text.length > maxLength) throw badRequest(`${campo} no puede superar ${maxLength} caracteres`);
  return text === '' ? null : text;
}

/**
 * A diferencia de `requireRole`, este no lanza si el usuario no es
 * administrador: hay endpoints donde ambos roles entran y la diferencia esta en
 * que se le puede ver, no en si puede entrar.
 */
async function contexto(c: Context): Promise<{ userId: string; rol: RolUsuario; nombre: string }> {
  const { userId } = await requireAuth(c);

  const [user] = await db
    .select({ nombre: usuarios.nombre, rol: usuarios.rol, activo: usuarios.activo })
    .from(usuarios)
    .where(eq(usuarios.id, userId))
    .limit(1);

  if (!user || !user.activo) {
    throw unauthorized('La cuenta esta desactivada');
  }

  return { userId, rol: user.rol, nombre: user.nombre };
}

function aNumero(valor: string | number | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Los clientes que ya quedaron asignados a una ruta abierta de esa misma fecha.
 *
 * Sin esto, el administrador podria meter al mismo cliente en dos rutas del dia
 * y quedaria con dos cobradores yendo a la misma puerta, o peor: pagaria la cuota
 * dos veces en cobros distintos.
 */
async function clientesYaAsignados(fecha: string): Promise<string[]> {
  const filas = await db
    .select({ clienteId: rutasClientes.clienteId })
    .from(rutasClientes)
    .innerJoin(rutas, eq(rutasClientes.rutaId, rutas.id))
    .where(and(eq(rutas.fecha, fecha), ne(rutas.estado, 'cerrada')));

  return [...new Set(filas.map((fila) => fila.clienteId))];
}

/**
 * Alimenta la pantalla de "Nueva ruta". Es lo unico que el administrador ve
 * antes de decidir: la cartera que se puede cobrar en esa fecha.
 *
 * "Vigente" son las cuotas **pendientes con vencimiento igual o anterior** a la
 * fecha, no solo las que vencen ese dia. Un cliente que debio el mes pasado sigue
 * siendo cobrable hoy, y mandarlo al cobrador solo con la cuota de hoy deja la
 * deuda antigua sin nadie que la reclame. El campo `atrasadas` le dice al
 * administrador cuantas de esas cuotas son viejas, y el orden pone primero las
 * mas antiguas.
 *
 * La fecha que se compara es la ya guardada en la cuota, que ya viene ajustada
 * cuando cayo en domingo, asi que no hay que volver a aplicar esa regla aqui.
 */
rutaRoutes.get('/vigentes', async (c) => {
  await requireRole(c, 'administrador');

  const fecha = c.req.query('fecha') ? assertDate(c.req.query('fecha'), 'fecha') : hoy();
  const yaAsignados = await clientesYaAsignados(fecha);

  const conditions: SQL[] = [
    eq(cuotas.estado, 'pendiente'),
    lte(cuotas.fechaVencimiento, fecha),
    eq(creditos.estado, 'activo'),
    eq(clientes.activo, true),
  ];

  // `notInArray` con una lista vacia genera un "NOT IN ()" invalido en Postgres,
  // asi que la condicion solo se agrega cuando hay algo que excluir.
  if (yaAsignados.length > 0) {
    conditions.push(notInArray(clientes.id, yaAsignados));
  }

  const filas = await db
    .select({
      clienteId: clientes.id,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      documento: clientes.documento,
      direccion: clientes.direccion,
      celular: clientes.celular,
      creditoId: creditos.id,
      saldo: creditos.saldo,
      valorCuota: creditos.valorCuota,
      totalVencido: sql<string>`sum(${cuotas.monto})`,
      cuotasPendientes: sql<number>`count(*)::int`,
      atrasadas: sql<number>`(count(*) filter (where ${cuotas.fechaVencimiento} < ${fecha}))::int`,
      vencimientoMasAntiguo: sql<string>`min(${cuotas.fechaVencimiento})`,
    })
    .from(cuotas)
    .innerJoin(creditos, eq(cuotas.creditoId, creditos.id))
    .innerJoin(clientes, eq(creditos.clienteId, clientes.id))
    .where(and(...conditions))
    .groupBy(clientes.id, creditos.id)
    .orderBy(asc(sql`min(${cuotas.fechaVencimiento})`), asc(clientes.apellido), asc(clientes.nombre));

  const pendientes = filas.map((fila) => ({
    ...fila,
    saldo: aNumero(fila.saldo),
    valorCuota: aNumero(fila.valorCuota),
    totalVencido: aNumero(fila.totalVencido),
    vencimientoMasAntiguo: fila.vencimientoMasAntiguo as string,
    yaAsignado: yaAsignados.includes(fila.clienteId),
  }));

  return c.json({
    fecha,
    pendientes,
    resumen: {
      clientes: pendientes.length,
      porCobrar: pendientes.reduce((suma, fila) => suma + fila.totalVencido, 0),
      conAtraso: pendientes.filter((fila) => fila.atrasadas > 0).length,
    },
  });
});

rutaRoutes.get('/', async (c) => {
  const { userId, rol } = await contexto(c);

  const conditions: SQL[] = [];

  if (c.req.query('fecha')) {
    conditions.push(eq(rutas.fecha, assertDate(c.req.query('fecha'), 'fecha')));
  }
  if (c.req.query('operadorId')) {
    conditions.push(eq(rutas.operadorId, assertUuid(c.req.query('operadorId'), 'operadorId')));
  }

  // El operador solo puede ver lo suyo: no es un filtro de la interfaz, es una
  // condicion de la consulta, asi que tampoco se puede pedir por parametro.
  if (rol !== 'administrador') {
    conditions.push(eq(rutas.operadorId, userId));
  }

  const filas = await db
    .select({
      ruta: rutas,
      operador: { id: usuarios.id, nombre: usuarios.nombre, cedula: usuarios.cedula },
    })
    .from(rutas)
    .innerJoin(usuarios, eq(rutas.operadorId, usuarios.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(rutas.fecha), asc(usuarios.nombre));

  const ids = filas.map((fila) => fila.ruta.id);

  const conteos = new Map<string, number>();
  const cobros = new Map<string, { total: number; cantidad: number }>();

  if (ids.length > 0) {
    const porRuta = await db
      .select({ rutaId: rutasClientes.rutaId, cantidad: sql<number>`count(*)::int` })
      .from(rutasClientes)
      .where(inArray(rutasClientes.rutaId, ids))
      .groupBy(rutasClientes.rutaId);

    for (const fila of porRuta) {
      conteos.set(fila.rutaId, fila.cantidad);
    }

    const porCobro = await db
      .select({
        rutaId: abonos.rutaId,
        total: sql<string>`sum(${abonos.monto})`,
        cantidad: sql<number>`count(*)::int`,
      })
      .from(abonos)
      .where(and(inArray(abonos.rutaId, ids), isNull(abonos.anuladoEn)))
      .groupBy(abonos.rutaId);

    for (const fila of porCobro) {
      if (!fila.rutaId) continue;
      cobros.set(fila.rutaId, { total: aNumero(fila.total), cantidad: fila.cantidad });
    }
  }

  return c.json({
    rutas: filas.map((fila) => {
      const cobro = cobros.get(fila.ruta.id);
      return {
        ...fila.ruta,
        operador: fila.operador,
        clientes: conteos.get(fila.ruta.id) ?? 0,
        cobrado: cobro?.total ?? 0,
        abonos: cobro?.cantidad ?? 0,
      };
    }),
  });
});

rutaRoutes.post('/', async (c) => {
  const { userId } = await requireRole(c, 'administrador');
  const body = await c.req.json<Record<string, unknown>>();

  const operadorId = assertUuid(
    typeof body.operadorId === 'string' ? body.operadorId : undefined,
    'operadorId',
  );
  const fecha = assertDate(body.fecha, 'fecha');
  const observaciones = optionalText(body.observaciones, 'observaciones', 500);

  if (!Array.isArray(body.clienteIds) || body.clienteIds.length === 0) {
    throw badRequest('Selecciona al menos un cliente para la ruta');
  }
  if (body.clienteIds.length > 200) {
    throw badRequest('Una ruta no puede tener mas de 200 clientes');
  }

  const clienteIds = [...new Set(body.clienteIds.map((id) => assertUuid(id as string, 'clienteId')))];

  const [operador] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, activo: usuarios.activo })
    .from(usuarios)
    .where(eq(usuarios.id, operadorId))
    .limit(1);

  if (!operador) throw notFound('El operador no existe');
  if (!operador.activo) throw badRequest('El operador esta desactivado');

  const yaAsignados = await clientesYaAsignados(fecha);
  const repetidos = clienteIds.filter((id) => yaAsignados.includes(id));
  if (repetidos.length > 0) {
    throw conflict('Alguno de esos clientes ya esta en otra ruta de esa fecha');
  }

  const validos = await db
    .select({ id: clientes.id })
    .from(clientes)
    .innerJoin(creditos, eq(creditos.clienteId, clientes.id))
    .where(
      and(
        inArray(clientes.id, clienteIds),
        eq(clientes.activo, true),
        eq(creditos.estado, 'activo'),
      ),
    );

  if (validos.length !== clienteIds.length) {
    throw badRequest('Uno de los clientes no tiene un credito activo');
  }

  const nombre = optionalText(body.nombre, 'nombre', 80);

  const creada = await db.transaction(async (tx) => {
    const [fila] = await tx
      .insert(rutas)
      .values({
        nombre: nombre ?? `Ruta ${fecha}`,
        operadorId,
        fecha,
        observaciones,
        creadoPor: userId,
      })
      .returning();

    if (!fila) throw new Error('No se pudo crear la ruta');

    await tx.insert(rutasClientes).values(
      clienteIds.map((clienteId, indice) => ({
        rutaId: fila.id,
        clienteId,
        orden: indice + 1,
      })),
    );

    return fila;
  });

  return c.json({ ruta: creada }, 201);
});

rutaRoutes.get('/:id', async (c) => {
  const { userId, rol } = await contexto(c);
  const id = assertUuid(c.req.param('id'), 'id de la ruta');

  const [fila] = await db
    .select({
      ruta: rutas,
      operador: { id: usuarios.id, nombre: usuarios.nombre, cedula: usuarios.cedula },
    })
    .from(rutas)
    .innerJoin(usuarios, eq(rutas.operadorId, usuarios.id))
    .where(eq(rutas.id, id))
    .limit(1);

  if (!fila) throw notFound('Ruta no encontrada');
  if (rol !== 'administrador' && fila.ruta.operadorId !== userId) {
    throw forbidden('Esa ruta no es tuya');
  }

  const items = await db
    .select({
      orden: rutasClientes.orden,
      cliente: {
        id: clientes.id,
        nombre: clientes.nombre,
        apellido: clientes.apellido,
        documento: clientes.documento,
        direccion: clientes.direccion,
        celular: clientes.celular,
      },
      creditoId: creditos.id,
      saldo: creditos.saldo,
      valorCuota: creditos.valorCuota,
    })
    .from(rutasClientes)
    .innerJoin(clientes, eq(rutasClientes.clienteId, clientes.id))
    .leftJoin(creditos, eq(creditos.clienteId, clientes.id))
    .where(eq(rutasClientes.rutaId, id))
    .orderBy(asc(rutasClientes.orden));

  const cobros = await db
    .select({
      clienteId: creditos.clienteId,
      total: sql<string>`sum(${abonos.monto})`,
      cantidad: sql<number>`count(*)::int`,
    })
    .from(abonos)
    .innerJoin(creditos, eq(abonos.creditoId, creditos.id))
    .where(and(eq(abonos.rutaId, id), isNull(abonos.anuladoEn)))
    .groupBy(creditos.clienteId);

  const porCliente = new Map(
    cobros.map((fila) => [
      fila.clienteId,
      { total: aNumero(fila.total), cantidad: fila.cantidad },
    ]),
  );

  return c.json({
    ruta: {
      ...fila.ruta,
      operador: fila.operador,
      clientes: items.map((item) => {
        const cobro = item.cliente.id ? porCliente.get(item.cliente.id) : undefined;
        return {
          orden: item.orden,
          cliente: item.cliente,
          creditoId: item.creditoId,
          saldo: aNumero(item.saldo),
          valorCuota: aNumero(item.valorCuota),
          cobrado: cobro?.total ?? 0,
          abonos: cobro?.cantidad ?? 0,
        };
      }),
    },
  });
});

/**
 * Un operador solo avanza su ruta; el administrador puede corregirla, incluida
 * reabrirla. Cerrar una ruta ya no borra lo cobrado: los abonos quedan enlazados
 * a ella y un abono anulado se excluye de los totales.
 */
rutaRoutes.patch('/:id/estado', async (c) => {
  const { userId, rol } = await contexto(c);
  const id = assertUuid(c.req.param('id'), 'id de la ruta');
  const body = await c.req.json<{ estado?: unknown }>();

  if (typeof body.estado !== 'string' || !ESTADOS.includes(body.estado as EstadoRuta)) {
    throw badRequest('estado debe ser pendiente, abierta, en_proceso o cerrada');
  }
  const estado = body.estado as EstadoRuta;

  const [actual] = await db.select().from(rutas).where(eq(rutas.id, id)).limit(1);
  if (!actual) throw notFound('Ruta no encontrada');

  if (rol !== 'administrador') {
    if (actual.operadorId !== userId) {
      throw forbidden('Esa ruta no es tuya');
    }
    if (actual.estado === estado) {
      return c.json({ ruta: actual });
    }
    const permitidos: EstadoRuta[] =
      actual.estado === 'pendiente'
        ? ['abierta', 'cerrada']
        : actual.estado === 'abierta'
          ? ['en_proceso', 'cerrada']
          : [];

    if (!permitidos.includes(estado)) {
      throw badRequest('Solo puedes avanzar el estado de tu ruta');
    }
  }

  const [row] = await db
    .update(rutas)
    .set({
      estado,
      abiertaEn:
        estado === 'abierta' ? (actual.abiertaEn ?? new Date()) : actual.abiertaEn,
      cerradaEn: estado === 'cerrada' ? new Date() : null,
      actualizadoEn: new Date(),
    })
    .where(eq(rutas.id, id))
    .returning();

  if (!row) throw notFound('Ruta no encontrada');

  return c.json({ ruta: row });
});

/** Solo se puede borrar una ruta que el operador todavia no empezo a cobrar. */
rutaRoutes.delete('/:id', async (c) => {
  await requireRole(c, 'administrador');
  const id = assertUuid(c.req.param('id'), 'id de la ruta');

  const [actual] = await db.select().from(rutas).where(eq(rutas.id, id)).limit(1);
  if (!actual) throw notFound('Ruta no encontrada');
  if (actual.estado !== 'pendiente') {
    throw conflict('Solo se puede eliminar una ruta que el operador todavia no empezo');
  }

  const cobrados = await db
    .select({ id: abonos.id })
    .from(abonos)
    .where(eq(abonos.rutaId, id))
    .limit(1);

  if (cobrados.length > 0) {
    throw conflict('Esa ruta ya tiene abonos registrados');
  }

  const row = await db.delete(rutas).where(eq(rutas.id, id)).returning({ id: rutas.id });
  if (row.length === 0) throw notFound('Ruta no encontrada');

  return c.json({ eliminada: id });
});
