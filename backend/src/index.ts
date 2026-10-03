import 'dotenv/config';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { CARPETA_FOTOS, asegurarCarpetaFotos } from '@/almacen/fotos';
import { errorHandler } from '@/http';
import { authRoutes } from '@/routes/auth';
import { clienteRoutes } from '@/routes/clientes';
import { creditoRoutes } from '@/routes/creditos';
import { indicadorRoutes } from '@/routes/indicadores';
import { rutaRoutes } from '@/routes/rutas';
import { usuarioRoutes } from '@/routes/usuarios';

const app = new Hono();

app.onError(errorHandler);

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

/**
 * Las fotos se sirven por ruta publica y no con el token de autorizacion, porque
 * `<Image>` no manda cabeceras propias. El nombre del archivo es un UUID
 * generado por el servidor (ver `almacen/fotos.ts`), no algo que el cliente
 * pueda adivinar, asi que adivinar la URL de la foto de otra persona no es
 * viable en la practica. A futuro con mas datos, esto pasaria a una ruta con
 * token o a un bucket privado con URLs firmadas.
 */
app.use('/fotos/*', serveStatic({ root: CARPETA_FOTOS, rewriteRequestPath: (path) => path.replace(/^\/fotos\//, '') }));

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'contabilidad-server', time: new Date().toISOString() }),
);

app.route('/api/auth', authRoutes);
app.route('/api/clientes', clienteRoutes);
app.route('/api/creditos', creditoRoutes);
app.route('/api/indicadores', indicadorRoutes);
app.route('/api/rutas', rutaRoutes);
app.route('/api/usuarios', usuarioRoutes);

app.notFound((c) => c.json({ error: { message: 'Ruta no encontrada' } }, 404));

const port = Number(process.env.PORT ?? 4000);

// Antes de registrar `serveStatic`, que revisa que la carpeta exista al armar
// el servidor y falla si no.
await asegurarCarpetaFotos();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[contabilidad-server] escuchando en http://localhost:${info.port}`);
});
