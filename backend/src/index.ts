import 'dotenv/config';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { errorHandler } from '@/http';
import { authRoutes } from '@/routes/auth';
import { clienteRoutes } from '@/routes/clientes';
import { creditoRoutes } from '@/routes/creditos';
import { indicadorRoutes } from '@/routes/indicadores';
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

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'contabilidad-server', time: new Date().toISOString() }),
);

app.route('/api/auth', authRoutes);
app.route('/api/clientes', clienteRoutes);
app.route('/api/creditos', creditoRoutes);
app.route('/api/indicadores', indicadorRoutes);
app.route('/api/usuarios', usuarioRoutes);

app.notFound((c) => c.json({ error: { message: 'Ruta no encontrada' } }, 404));

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[contabilidad-server] escuchando en http://localhost:${info.port}`);
});
