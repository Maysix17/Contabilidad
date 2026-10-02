import { and, eq, isNull, lt } from 'drizzle-orm';

import { hashPassword, verifyPassword } from '@/auth/password';
import { normalizarCedula } from '@/auth/cedula';
import { createRefreshToken, hashRefreshToken, signAccessToken } from '@/auth/token';
import { db } from '@/db';
import { tokensRefresh, usuarios, type RolUsuario } from '@/db/schema';
import { env } from '@/env';
import { HttpError, unauthorized } from '@/http';

export interface UsuarioSession {
  id: string;
  cedula: string;
  nombre: string;
  rol: RolUsuario;
}

export interface SessionResponse {
  user: UsuarioSession;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function toSessionResponse(
  user: UsuarioSession,
  refreshToken: string,
  accessToken: string,
): SessionResponse {
  return { user, accessToken, refreshToken, expiresIn: env.accessTokenTtl };
}

export async function createUser(input: {
  cedula: string;
  password: string;
  name: string;
  rol: RolUsuario;
}): Promise<UsuarioSession> {
  const cedula = normalizarCedula(input.cedula);

  const [existing] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.cedula, cedula))
    .limit(1);

  if (existing) {
    throw new HttpError(409, 'Ya existe un usuario con esa cedula');
  }

  const [user] = await db
    .insert(usuarios)
    .values({
      cedula,
      nombre: input.name.trim(),
      rol: input.rol,
      hashContrasena: await hashPassword(input.password),
    })
    .returning({ id: usuarios.id, cedula: usuarios.cedula, nombre: usuarios.nombre, rol: usuarios.rol });

  if (!user) {
    throw new HttpError(500, 'No se pudo crear el usuario');
  }

  return { id: user.id, cedula: user.cedula, nombre: user.nombre, rol: user.rol };
}

export async function loginUser(input: {
  cedula: string;
  password: string;
}): Promise<SessionResponse> {
  const cedula = normalizarCedula(input.cedula);

  const [user] = await db.select().from(usuarios).where(eq(usuarios.cedula, cedula)).limit(1);

  if (!user || !user.activo || !(await verifyPassword(input.password, user.hashContrasena))) {
    throw unauthorized('Cedula o contrasena incorrectos');
  }

  /**
   * Un login es el momento natural para limpiar: ya se esta usando la base, y
   * de paso no se corre el borrado si no hay trafico. Si falla, el login igual
   * continua; la tabla se limpia en el proximo.
   */
  void purgeExpiredTokens().catch(() => undefined);

  const { token, tokenHash } = createRefreshToken();
  await db.insert(tokensRefresh).values({
    usuarioId: user.id,
    hashToken: tokenHash,
    expiraEn: new Date(Date.now() + env.refreshTokenTtl * 1000),
  });

  return toSessionResponse(
    { id: user.id, cedula: user.cedula, nombre: user.nombre, rol: user.rol },
    token,
    await signAccessToken({ userId: user.id, cedula: user.cedula }),
  );
}

export async function rotateRefreshToken(token: string): Promise<SessionResponse> {
  const tokenHash = hashRefreshToken(token);

  const [stored] = await db
    .select()
    .from(tokensRefresh)
    .where(and(eq(tokensRefresh.hashToken, tokenHash), isNull(tokensRefresh.revocadoEn)))
    .limit(1);

  if (!stored || stored.expiraEn.getTime() <= Date.now()) {
    throw unauthorized('Sesion expirada, vuelve a iniciar sesion');
  }

  const [user] = await db.select().from(usuarios).where(eq(usuarios.id, stored.usuarioId)).limit(1);
  if (!user || !user.activo) {
    throw unauthorized();
  }

  await db
    .update(tokensRefresh)
    .set({ revocadoEn: new Date() })
    .where(eq(tokensRefresh.id, stored.id));

  const next = createRefreshToken();
  await db.insert(tokensRefresh).values({
    usuarioId: user.id,
    hashToken: next.tokenHash,
    expiraEn: new Date(Date.now() + env.refreshTokenTtl * 1000),
  });

  return toSessionResponse(
    { id: user.id, cedula: user.cedula, nombre: user.nombre, rol: user.rol },
    next.token,
    await signAccessToken({ userId: user.id, cedula: user.cedula }),
  );
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(tokensRefresh)
    .set({ revocadoEn: new Date() })
    .where(eq(tokensRefresh.hashToken, hashRefreshToken(token)));
}

export async function revokeAllSessions(usuarioId: string): Promise<void> {
  await db
    .update(tokensRefresh)
    .set({ revocadoEn: new Date() })
    .where(and(eq(tokensRefresh.usuarioId, usuarioId), isNull(tokensRefresh.revocadoEn)));
}

export async function purgeExpiredTokens(): Promise<void> {
  await db.delete(tokensRefresh).where(lt(tokensRefresh.expiraEn, new Date()));
}
