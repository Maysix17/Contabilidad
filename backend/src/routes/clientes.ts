import { and, asc, eq, ilike, ne, notExists, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';

import { db } from '@/db';
import { clientes, creditos } from '@/db/schema';
import { badRequest, conflict, notFound, requireAuth, requireRole } from '@/http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENTO_PATTERN = /^[0-9a-zA-Z.-]{3,20}$/;

export interface ClientePayload {
  documento?: unknown;
  nombre?: unknown;
  apellido?: unknown;
  celular?: unknown;
  direccion?: unknown;
  alias?: unknown;
  telefono?: unknown;
  direccion2?: unknown;
  ciudad?: unknown;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} es obligatorio`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw badRequest(`${field} no puede superar ${maxLength} caracteres`);
  }
  return text;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest(`${field} debe ser texto`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw badRequest(`${field} no puede superar ${maxLength} caracteres`);
  }
  return text === '' ? null : text;
}

function requiredDocumento(value: unknown): string {
  const documento = requiredText(value, 'documento', 20);
  if (!DOCUMENTO_PATTERN.test(documento)) {
    throw badRequest('documento solo puede contener letras, numeros, punto y guion');
  }
  return documento;
}

function assertUuid(id: string | undefined): string {
  if (!id || !UUID_PATTERN.test(id)) {
    throw badRequest('El id del cliente no es valido');
  }
  return id;
}

export const clienteRoutes = new Hono();

clienteRoutes.use('*', async (c, next) => {
  await requireAuth(c);
  await next();
});

clienteRoutes.get('/', async (c) => {
  const search = c.req.query('search')?.trim();
  const includeInactive = c.req.query('includeInactive') === 'true';

  const conditions: SQL[] = [];

  if (!includeInactive) {
    conditions.push(eq(clientes.activo, true));
  }
  if (search) {
    const pattern = `%${search}%`;
    const matches = or(
      ilike(clientes.nombre, pattern),
      ilike(clientes.apellido, pattern),
      ilike(clientes.documento, pattern),
    );
    if (matches) {
      conditions.push(matches);
    }
  }

  const rows = await db
    .select()
    .from(clientes)
    .where(and(...conditions))
    .orderBy(asc(clientes.apellido), asc(clientes.nombre))
    .limit(200);

  return c.json({ clientes: rows });
});

clienteRoutes.post('/', async (c) => {
  const body = await c.req.json<ClientePayload>();

  const documento = requiredDocumento(body.documento);
  const nombre = requiredText(body.nombre, 'nombre', 80);
  const apellido = requiredText(body.apellido, 'apellido', 80);
  const celular = requiredText(body.celular, 'celular', 30);
  const direccion = requiredText(body.direccion, 'direccion', 160);

  const [duplicado] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.documento, documento))
    .limit(1);

  if (duplicado) {
    throw conflict('Ya existe un cliente con ese documento');
  }

  const [row] = await db
    .insert(clientes)
    .values({
      documento,
      nombre,
      apellido,
      celular,
      direccion,
      alias: optionalText(body.alias, 'alias', 80),
      telefono: optionalText(body.telefono, 'telefono', 30),
      direccion2: optionalText(body.direccion2, 'direccion2', 160),
      ciudad: optionalText(body.ciudad, 'ciudad', 80),
    })
    .returning();

  return c.json({ cliente: row }, 201);
});

/**
 * Regla 2: solo los clientes sin credito activo pueden recibir un nuevo credito.
 * Este listado alimenta la pantalla de "Crear credito".
 */
clienteRoutes.get('/disponibles-para-credito', async (c) => {
  const search = c.req.query('search')?.trim();
  const conditions: SQL[] = [eq(clientes.activo, true)];

  if (search) {
    const pattern = `%${search}%`;
    const matches = or(
      ilike(clientes.nombre, pattern),
      ilike(clientes.apellido, pattern),
      ilike(clientes.documento, pattern),
    );
    if (matches) conditions.push(matches);
  }

  const rows = await db
    .select()
    .from(clientes)
    .where(
      and(
        ...conditions,
        notExists(
          db
            .select({ id: creditos.id })
            .from(creditos)
            .where(and(eq(creditos.clienteId, clientes.id), eq(creditos.estado, 'activo'))),
        ),
      ),
    )
    .orderBy(asc(clientes.apellido), asc(clientes.nombre))
    .limit(200);

  return c.json({ clientes: rows });
});

/**
 * Alimenta la pestaña de abonos: solo los clientes que tienen un credito
 * activo, que son por definicion los que hay que cobrarle. Se diferencia de
 * `disponibles-para-credito`, que devuelve exactamente lo contrario.
 */
clienteRoutes.get('/con-credito-activo', async (c) => {
  const search = c.req.query('search')?.trim();
  const conditions: SQL[] = [eq(clientes.activo, true)];

  if (search) {
    const pattern = `%${search}%`;
    const matches = or(
      ilike(clientes.nombre, pattern),
      ilike(clientes.apellido, pattern),
      ilike(clientes.documento, pattern),
    );
    if (matches) conditions.push(matches);
  }

  const rows = await db
    .select({
      cliente: clientes,
      creditoId: creditos.id,
      saldo: creditos.saldo,
      valorCuota: creditos.valorCuota,
      totalPagar: creditos.totalPagar,
      numeroPeriodos: creditos.numeroPeriodos,
      fechaVencimiento: creditos.fechaVencimiento,
    })
    .from(creditos)
    .innerJoin(clientes, eq(creditos.clienteId, clientes.id))
    .where(and(...conditions, eq(creditos.estado, 'activo')))
    .orderBy(asc(creditos.fechaVencimiento), asc(clientes.apellido))
    .limit(300);

  return c.json({
    clientes: rows.map((row) => ({
      ...row.cliente,
      creditoActivo: {
        id: row.creditoId,
        saldo: row.saldo,
        valorCuota: row.valorCuota,
        totalPagar: row.totalPagar,
        numeroPeriodos: row.numeroPeriodos,
        fechaVencimiento: row.fechaVencimiento,
      },
    })),
  });
});

clienteRoutes.get('/:id', async (c) => {
  const id = assertUuid(c.req.param('id'));

  const [row] = await db
    .select()
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1);

  if (!row) {
    throw notFound('Cliente no encontrado');
  }

  return c.json({ cliente: row });
});

clienteRoutes.patch('/:id', async (c) => {
  const id = assertUuid(c.req.param('id'));
  const body = await c.req.json<ClientePayload>();

  const updates: Partial<typeof clientes.$inferInsert> = { actualizadoEn: new Date() };

  if (body.documento !== undefined) {
    const documento = requiredDocumento(body.documento);
    const [duplicado] = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(and(eq(clientes.documento, documento), ne(clientes.id, id)))
      .limit(1);

    if (duplicado) {
      throw conflict('Ya existe un cliente con ese documento');
    }
    updates.documento = documento;
  }
  if (body.nombre !== undefined) {
    updates.nombre = requiredText(body.nombre, 'nombre', 80);
  }
  if (body.apellido !== undefined) {
    updates.apellido = requiredText(body.apellido, 'apellido', 80);
  }
  if (body.celular !== undefined) {
    updates.celular = requiredText(body.celular, 'celular', 30);
  }
  if (body.direccion !== undefined) {
    updates.direccion = requiredText(body.direccion, 'direccion', 160);
  }
  if (body.alias !== undefined) {
    updates.alias = optionalText(body.alias, 'alias', 80);
  }
  if (body.telefono !== undefined) {
    updates.telefono = optionalText(body.telefono, 'telefono', 30);
  }
  if (body.direccion2 !== undefined) {
    updates.direccion2 = optionalText(body.direccion2, 'direccion2', 160);
  }
  if (body.ciudad !== undefined) {
    updates.ciudad = optionalText(body.ciudad, 'ciudad', 80);
  }

  const [row] = await db
    .update(clientes)
    .set(updates)
    .where(eq(clientes.id, id))
    .returning();

  if (!row) {
    throw notFound('Cliente no encontrado');
  }

  return c.json({ cliente: row });
});

clienteRoutes.delete('/:id', async (c) => {
  await requireRole(c, 'administrador');

  const id = assertUuid(c.req.param('id'));

  const [row] = await db
    .delete(clientes)
    .where(eq(clientes.id, id))
    .returning({ id: clientes.id });

  if (!row) {
    throw notFound('Cliente no encontrado');
  }

  return c.json({ eliminado: row.id });
});
