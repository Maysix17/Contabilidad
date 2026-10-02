import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { assertCedula } from '@/auth/cedula';
import { exceeded, limpiarIntentos, registrarIntento } from '@/auth/rate-limit';
import { loginUser, revokeRefreshToken, rotateRefreshToken } from '@/auth/service';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { badRequest, requireAuth, tooManyRequests, unauthorized } from '@/http';

export const authRoutes = new Hono();

/**
 * El limite se consulta antes de tocar la base: asi un ataque de fuerza bruta
 * se detiene sin generar ni una consulta de usuarios, y sin dejar que el
 * atacante pueda distinguir "no existe" de "contrasena incorrecta" por el
 * tiempo de respuesta. El mensaje es identico al de credenciales invalidas a
 * proposito, para no confirmar que la cedula existe.
 */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ cedula?: string; password?: string }>();
  const password = body.password ?? '';

  if (!password) {
    throw badRequest('La contrasena es obligatoria');
  }

  if (exceeded(c)) {
    throw tooManyRequests('Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo');
  }

  try {
    const session = await loginUser({ cedula: assertCedula(body.cedula), password });
    limpiarIntentos(c);
    return c.json(session);
  } catch (error) {
    registrarIntento(c);
    throw error;
  }
});

authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>();
  if (!body.refreshToken) {
    throw badRequest('refreshToken es obligatorio');
  }
  return c.json(await rotateRefreshToken(body.refreshToken));
});

authRoutes.post('/logout', async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>();
  if (body.refreshToken) {
    await revokeRefreshToken(body.refreshToken);
  }
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const { userId } = await requireAuth(c);

  const [user] = await db
    .select({
      id: usuarios.id,
      cedula: usuarios.cedula,
      nombre: usuarios.nombre,
      rol: usuarios.rol,
      activo: usuarios.activo,
    })
    .from(usuarios)
    .where(eq(usuarios.id, userId))
    .limit(1);

  if (!user) {
    throw unauthorized();
  }

  return c.json({ user });
});
