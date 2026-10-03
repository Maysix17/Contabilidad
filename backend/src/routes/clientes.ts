import { and, asc, eq, ilike, inArray, lt, ne, notExists, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';

import {
  borrarArchivo,
  extensionPermitida,
  guardarFoto,
  nombreArchivo,
  TAMANO_MAXIMO,
} from '@/almacen/fotos';
import { hoy } from '@/creditos/calculos';
import { db } from '@/db';
import { clientes, creditos, cuotas, fotosCliente, type TipoFotoCliente } from '@/db/schema';
import { badRequest, conflict, notFound, requireAuth, requireRole } from '@/http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENTO_PATTERN = /^[0-9a-zA-Z.-]{3,20}$/;

const TIPOS_FOTO: TipoFotoCliente[] = ['cedula', 'persona', 'direccion'];

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
  activo?: unknown;
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

  /**
   * Cuotas ya vencidas por credito, en una consulta aparte y no con un
   * `join` lateral: la subconsulta correlacionada con `creditos.id` no la arma
   * Drizzle aca y devolvia 500 en cuanto se afectaba mas de un credito. Es
   * ademas la forma mas barata, porque el filtro `inArray` deja entrar solo las
   * cuotas de los 300 creditos de la pagina.
   *
   * Lo que dice "llevo tres dias debiendo" es la cuota pendiente mas vieja, no
   * el vencimiento final del credito: ese ultimo es la fecha en que termina de
   * pagar y por lo general esta meses adelante.
   */
  const ids = rows.map((row) => row.creditoId);
  const fecha = hoy();

  const vencidasPorCredito = new Map<string, { vencidaMasAntigua: string; vencidas: number }>();

  if (ids.length > 0) {
    const vencidas = await db
      .select({
        creditoId: cuotas.creditoId,
        vencidaMasAntigua: sql<string>`min(${cuotas.fechaVencimiento})`,
        vencidas: sql<number>`count(*)::int`,
      })
      .from(cuotas)
      .where(
        and(
          inArray(cuotas.creditoId, ids),
          eq(cuotas.estado, 'pendiente'),
          lt(cuotas.fechaVencimiento, fecha),
        ),
      )
      .groupBy(cuotas.creditoId);

    for (const fila of vencidas) {
      vencidasPorCredito.set(fila.creditoId, {
        vencidaMasAntigua: fila.vencidaMasAntigua,
        vencidas: fila.vencidas,
      });
    }
  }

  return c.json({
    clientes: rows.map((row) => {
      const mora = vencidasPorCredito.get(row.creditoId);

      return {
        ...row.cliente,
        creditoActivo: {
          id: row.creditoId,
          saldo: row.saldo,
          valorCuota: row.valorCuota,
          totalPagar: row.totalPagar,
          numeroPeriodos: row.numeroPeriodos,
          fechaVencimiento: row.fechaVencimiento,
          vencidaMasAntigua: mora?.vencidaMasAntigua ?? null,
          vencidas: mora?.vencidas ?? 0,
        },
      };
    }),
  });
});

/**
 * Fotos del cliente. Hay tres ranuras, una por tipo (`cedula`, `persona`,
 * `direccion`), y la base de datos tiene un indice unico por cliente y tipo, asi
 * que volver a subir una foto de un tipo reemplaza la anterior en vez de
 * acumular versiones.
 */
clienteRoutes.get('/:id/fotos', async (c) => {
  const id = assertUuid(c.req.param('id'));

  const [existe] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1);

  if (!existe) {
    throw notFound('Cliente no encontrado');
  }

  const rows = await db
    .select()
    .from(fotosCliente)
    .where(eq(fotosCliente.clienteId, id))
    .orderBy(asc(fotosCliente.tipo));

  return c.json({ fotos: rows });
});

clienteRoutes.post('/:id/fotos', async (c) => {
  const id = assertUuid(c.req.param('id'));

  const tipo = c.req.query('tipo');
  if (!tipo || !TIPOS_FOTO.includes(tipo as TipoFotoCliente)) {
    throw badRequest('tipo debe ser cedula, persona o direccion');
  }

  const [existe] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1);

  if (!existe) {
    throw notFound('Cliente no encontrado');
  }

  const body = await c.req.parseBody();
  const archivo = body.foto;

  /**
   * Se registra cada intento con su resultado. Cuando el telefono y el
   * computador estan en redes distintas, el unico forma de saber si la foto
   * llego a ser es mirando que respondio el servidor.
   */
  console.log(
    `[fotos] intento cliente=${id} tipo=${tipo} campos=${Object.keys(body).join(',') || '(ninguno)'} ` +
      `archivo=${archivo instanceof File ? `si (${archivo.type}, ${archivo.size}b)` : `no (${archivo === undefined ? 'undefined' : typeof archivo})`}`,
  );

  if (!(archivo instanceof File)) {
    throw badRequest('Se debe enviar el archivo en el campo "foto"');
  }

  if (archivo.size > TAMANO_MAXIMO) {
    throw badRequest('La foto supera el tamaño maximo permitido (8 MB)');
  }

  const extension = extensionPermitida(archivo.type);
  if (!extension) {
    throw badRequest(`El archivo debe ser una imagen JPG, PNG o WebP (recibido: ${archivo.type})`);
  }

  // Se valida el tamaño antes de leer el archivo en memoria: un `arrayBuffer`
  // de un archivo enorme se come el proceso del servidor.
  const datos = new Uint8Array(await archivo.arrayBuffer());

  const nombre = nombreArchivo(tipo, extension);
  await guardarFoto(nombre, datos);

  /**
   * La foto anterior se borra del disco despues de que la nueva quedo guardada.
   * Si el borrado fallara antes, el cliente se quedaria sin ninguna foto pero
   * con el registro apuntando a un archivo inexistente.
   */
  const [anterior] = await db
    .delete(fotosCliente)
    .where(and(eq(fotosCliente.clienteId, id), eq(fotosCliente.tipo, tipo as TipoFotoCliente)))
    .returning();

  const [row] = await db
    .insert(fotosCliente)
    .values({ clienteId: id, tipo: tipo as TipoFotoCliente, uri: nombre })
    .returning();

  if (anterior) {
    await borrarArchivo(anterior.uri);
  }

  return c.json({ foto: row }, 201);
});

clienteRoutes.delete('/:id/fotos/:tipo', async (c) => {
  const id = assertUuid(c.req.param('id'));
  const tipo = c.req.param('tipo');

  if (!TIPOS_FOTO.includes(tipo as TipoFotoCliente)) {
    throw badRequest('tipo debe ser cedula, persona o direccion');
  }

  const [row] = await db
    .delete(fotosCliente)
    .where(and(eq(fotosCliente.clienteId, id), eq(fotosCliente.tipo, tipo as TipoFotoCliente)))
    .returning();

  if (!row) {
    throw notFound('El cliente no tiene esa foto');
  }

  await borrarArchivo(row.uri);

  return c.json({ eliminada: row.tipo });
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

  /**
   * Desactivar es la forma correcta de "dar de baja" a un cliente: deja de
   * aparecer para recibir creditos nuevos ni aparecer en el cobro, pero su
   * historia de creditos y abonos sigue intacta y los indicadores lo siguen
   * contando. Antes esto no existia, y la unica forma de sacar a alguien de la
   * operacion era borrarlo, que arrastraba en cascada todos sus creditos y
   * abonos.
   */
  if (body.activo !== undefined) {
    if (typeof body.activo !== 'boolean') {
      throw badRequest('activo debe ser true o false');
    }
    updates.activo = body.activo;
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

  /**
   * Borrar en cascada se lleva por delante creditos, cuotas y abonos, es decir
   * el historial contable de esa persona. Eso solo es aceptable si nunca se
   * movieron, o el saldo por cobrar dejaria de cuadrar sin que nadie lo notara.
   * Para el resto de casos la salida correcta es desactivar con
   * `PATCH { activo: false }`.
   */
  const [conCredito] = await db
    .select({ id: creditos.id })
    .from(creditos)
    .where(eq(creditos.clienteId, id))
    .limit(1);

  if (conCredito) {
    throw conflict(
      'Este cliente tiene creditos registrados y no se puede eliminar. ' +
        'Desactivalo para sacarlo de la operacion sin perder su historial.',
    );
  }

  const [row] = await db
    .delete(clientes)
    .where(eq(clientes.id, id))
    .returning({ id: clientes.id });

  if (!row) {
    throw notFound('Cliente no encontrado');
  }

  return c.json({ eliminado: row.id });
});
