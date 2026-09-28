import 'dotenv/config';

import { and, eq } from 'drizzle-orm';

import { createUser } from '@/auth/service';
import { db, sql } from '@/db';
import { usuarios } from '@/db/schema';

const CEDULA = process.env.ADMIN_CEDULA ?? '1000000001';
const CONTRASENA = process.env.ADMIN_CONTRASENA ?? 'Admin12345';
const NOMBRE = process.env.ADMIN_NOMBRE ?? 'Administrador';

async function main() {
  const [existente] = await db
    .select({ id: usuarios.id, rol: usuarios.rol })
    .from(usuarios)
    .where(eq(usuarios.cedula, CEDULA))
    .limit(1);

  if (existente) {
    if (existente.rol !== 'administrador') {
      await db
        .update(usuarios)
        .set({ rol: 'administrador', activo: true, actualizadoEn: new Date() })
        .where(eq(usuarios.id, existente.id));
      console.log(`[seed] cedula ${CEDULA} promocionada a administrador`);
      return;
    }

    console.log(`[seed] cedula ${CEDULA} ya existe como administrador`);
    return;
  }

  const user = await createUser({
    cedula: CEDULA,
    name: NOMBRE,
    password: CONTRASENA,
    rol: 'administrador',
  });

  console.log(`[seed] administrador creado: cedula ${user.cedula} (id ${user.id})`);
  console.log('[seed] cambia la contrasena despues del primer inicio de sesion');
}

main()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[seed] error', error);
    await sql.end();
    process.exit(1);
  });
