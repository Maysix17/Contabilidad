import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';

import { assertCedula } from '@/auth/cedula';
import { hashPassword } from '@/auth/password';
import { createUser, revokeAllSessions } from '@/auth/service';
import { db } from '@/db';
import { rolUsuario, usuarios, type RolUsuario } from '@/db/schema';
import { badRequest, notFound, requireRole } from '@/http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = new Set<string>(rolUsuario.enumValues);

export const usuarioRoutes = new Hono();

usuarioRoutes.use('*', async (c, next) => {
  await requireRole(c, 'administrador');
  await next();
});

function assertUuid(id: string | undefined, campo: string): string {
  if (!id || !UUID_PATTERN.test(id)) {
    throw badRequest(`El ${campo} no es valido`);
  }
  return id;
}

function requiredText(value: unknown, campo: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${campo} es obligatorio`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw badRequest(`${campo} no puede superar ${maxLength} caracteres`);
  }
  return text;
}

function requiredRol(value: unknown): RolUsuario {
  if (typeof value !== 'string' || !ROLES.has(value)) {
    throw badRequest('rol debe ser administrador u operador');
  }
  return value as RolUsuario;
}

async function countAdministradoresActivos(exceptId?: string): Promise<number> {
  const rows = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.rol, 'administrador'),
        eq(usuarios.activo, true),
        exceptId ? eq(usuarios.id, exceptId) : undefined,
      ),
    );

  return rows.length;
}

async function assertNotLastAdmin(usuarioId: string, accion: 'degradar' | 'desactivar' | 'eliminar'): Promise<void> {
  const [target] = await db
    .select({ rol: usuarios.rol })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!target) {
    throw notFound('Usuario no encontrado');
  }

  if (target.rol !== 'administrador') {
    return;
  }

  const restantes = await countAdministradoresActivos(usuarioId);
  if (restantes === 0) {
    throw badRequest('No se puede dejar el sistema sin un administrador activo');
  }
}

usuarioRoutes.get('/', async (c) => {
  const search = c.req.query('search')?.trim();

  const condition = search
    ? or(ilike(usuarios.nombre, `%${search}%`), ilike(usuarios.cedula, `%${search}%`))
    : undefined;

  const rows = await db
    .select({
      id: usuarios.id,
      cedula: usuarios.cedula,
      nombre: usuarios.nombre,
      rol: usuarios.rol,
      activo: usuarios.activo,
      creadoEn: usuarios.creadoEn,
    })
    .from(usuarios)
    .where(condition)
    .orderBy(asc(usuarios.nombre));

  return c.json({ usuarios: rows });
});

usuarioRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    cedula?: unknown;
    nombre?: unknown;
    contrasena?: unknown;
    rol?: unknown;
  }>();

  const cedula = assertCedula(body.cedula);

  const nombre = requiredText(body.nombre, 'nombre', 120);
  const contrasena = requiredText(body.contrasena, 'contrasena', 200);
  if (contrasena.length < 8) {
    throw badRequest('La contrasena debe tener al menos 8 caracteres');
  }
  const rol = requiredRol(body.rol);

  const user = await createUser({ cedula, name: nombre, password: contrasena, rol });

  return c.json({ usuario: user }, 201);
});

usuarioRoutes.patch('/:id/rol', async (c) => {
  const id = assertUuid(c.req.param('id'), 'id del usuario');
  const body = await c.req.json<{ rol?: unknown }>();
  const rol = requiredRol(body.rol);

  if (rol !== 'administrador') {
    await assertNotLastAdmin(id, 'degradar');
  }

  const [row] = await db
    .update(usuarios)
    .set({ rol, actualizadoEn: new Date() })
    .where(eq(usuarios.id, id))
    .returning({
      id: usuarios.id,
      cedula: usuarios.cedula,
      nombre: usuarios.nombre,
      rol: usuarios.rol,
      activo: usuarios.activo,
    });

  if (!row) {
    throw notFound('Usuario no encontrado');
  }

  return c.json({ usuario: row });
});

usuarioRoutes.patch('/:id/estado', async (c) => {
  const id = assertUuid(c.req.param('id'), 'id del usuario');
  const body = await c.req.json<{ activo?: unknown }>();

  if (typeof body.activo !== 'boolean') {
    throw badRequest('activo debe ser true o false');
  }

  if (!body.activo) {
    await assertNotLastAdmin(id, 'desactivar');
  }

  const [row] = await db
    .update(usuarios)
    .set({ activo: body.activo, actualizadoEn: new Date() })
    .where(eq(usuarios.id, id))
    .returning({
      id: usuarios.id,
      cedula: usuarios.cedula,
      nombre: usuarios.nombre,
      rol: usuarios.rol,
      activo: usuarios.activo,
    });

  if (!row) {
    throw notFound('Usuario no encontrado');
  }

  if (!row.activo) {
    await revokeAllSessions(id);
  }

  return c.json({ usuario: row });
});

usuarioRoutes.post('/:id/restablecer-contrasena', async (c) => {
  const id = assertUuid(c.req.param('id'), 'id del usuario');
  const body = await c.req.json<{ contrasena?: unknown }>();

  const contrasena = requiredText(body.contrasena, 'contrasena', 200);
  if (contrasena.length < 8) {
    throw badRequest('La contrasena debe tener al menos 8 caracteres');
  }

  const [row] = await db
    .update(usuarios)
    .set({ hashContrasena: await hashPassword(contrasena), actualizadoEn: new Date() })
    .where(eq(usuarios.id, id))
    .returning({ id: usuarios.id });

  if (!row) {
    throw notFound('Usuario no encontrado');
  }

  await revokeAllSessions(id);

  return c.json({ ok: true, id: row.id });
});

usuarioRoutes.delete('/:id', async (c) => {
  const id = assertUuid(c.req.param('id'), 'id del usuario');

  await assertNotLastAdmin(id, 'eliminar');

  const row = await db.delete(usuarios).where(eq(usuarios.id, id)).returning({ id: usuarios.id });

  if (row.length === 0) {
    throw notFound('Usuario no encontrado');
  }

  return c.json({ eliminado: id });
});
