import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { verifyAccessToken, type AccessTokenPayload } from '@/auth/token';
import { db } from '@/db';
import { usuarios, type RolUsuario } from '@/db/schema';

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, message, details);
}

export function unauthorized(message = 'No autenticado'): HttpError {
  return new HttpError(401, message);
}

export function forbidden(message = 'Sin permisos'): HttpError {
  return new HttpError(403, message);
}

export function conflict(message = 'El recurso ya existe'): HttpError {
  return new HttpError(409, message);
}

export function notFound(message = 'Recurso no encontrado'): HttpError {
  return new HttpError(404, message);
}

export function errorHandler(error: Error, c: Context): Response {
  if (error instanceof HttpError) {
    return c.json(
      { error: { message: error.message, details: error.details ?? null } },
      error.status,
    );
  }

  console.error('[api] error no controlado', error);
  return c.json({ error: { message: 'Error interno del servidor', details: null } }, 500);
}

export async function requireAuth(c: Context): Promise<AccessTokenPayload> {
  const header = c.req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw unauthorized();
  }

  try {
    return await verifyAccessToken(token);
  } catch {
    throw unauthorized('Token invalido o expirado');
  }
}

/**
 * Consulta el rol en la base de datos en cada request, para que un cambio de
 * permisos surta efecto de inmediato y no espere a que caduque el access token.
 */
export async function requireRole(c: Context, rol: RolUsuario): Promise<AccessTokenPayload> {
  const { userId } = await requireAuth(c);

  const [user] = await db
    .select({ rol: usuarios.rol, activo: usuarios.activo })
    .from(usuarios)
    .where(eq(usuarios.id, userId))
    .limit(1);

  if (!user || !user.activo) {
    throw unauthorized('La cuenta esta desactivada');
  }
  if (user.rol !== rol) {
    throw forbidden('Esta accion es solo para el administrador');
  }

  return { userId, cedula: '' };
}
