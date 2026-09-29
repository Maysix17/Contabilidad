import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const rolUsuario = pgEnum('rol_usuario', ['administrador', 'operador']);

export const periodoPago = pgEnum('periodo_pago', ['diario', 'semanal', 'quincenal', 'mensual']);

export const estadoCredito = pgEnum('estado_credito', ['activo', 'finalizado', 'cerrado']);

export const estadoRuta = pgEnum('estado_ruta', [
  'pendiente',
  'abierta',
  'en_proceso',
  'cerrada',
]);

export const estadoCuota = pgEnum('estado_cuota', ['pendiente', 'pagada']);

export const tipoFotoCliente = pgEnum('tipo_foto_cliente', [
  'cedula',
  'persona',
  'direccion',
]);

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cedula: text('cedula').notNull(),
    hashContrasena: text('hash_contrasena').notNull(),
    nombre: text('nombre').notNull(),
    rol: rolUsuario('rol').notNull().default('operador'),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('usuarios_cedula_unico').on(table.cedula)],
);

export const tokensRefresh = pgTable(
  'tokens_refresh',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    hashToken: text('hash_token').notNull(),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    revocadoEn: timestamp('revocado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('tokens_refresh_hash_unico').on(table.hashToken)],
);

export const clientes = pgTable(
  'clientes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documento: text('documento').notNull(),
    nombre: text('nombre').notNull(),
    apellido: text('apellido').notNull(),
    celular: text('celular').notNull(),
    direccion: text('direccion').notNull(),
    alias: text('alias'),
    telefono: text('telefono'),
    direccion2: text('direccion_2'),
    ciudad: text('ciudad'),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('clientes_documento_unico').on(table.documento),
    index('clientes_apellido_idx').on(table.apellido, table.nombre),
  ],
);

export const creditos = pgTable(
  'creditos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    valorOriginal: numeric('valor_original', { precision: 18, scale: 2 }).notNull(),
    interesPorcentaje: numeric('interes_porcentaje', { precision: 6, scale: 2 })
      .notNull()
      .default('0'),
    interesTotal: numeric('interes_total', { precision: 18, scale: 2 }).notNull().default('0'),
    totalPagar: numeric('total_pagar', { precision: 18, scale: 2 }).notNull(),
    valorCuota: numeric('valor_cuota', { precision: 18, scale: 2 }).notNull(),
    saldo: numeric('saldo', { precision: 18, scale: 2 }).notNull(),
    formaPago: periodoPago('forma_pago').notNull(),
    numeroPeriodos: integer('numero_periodos').notNull().default(1),
    diaPago: integer('dia_pago'),
    fechaInicio: date('fecha_inicio').notNull(),
    fechaVencimiento: date('fecha_vencimiento').notNull(),
    estado: estadoCredito('estado').notNull().default('activo'),
    cerradoEn: timestamp('cerrado_en', { withTimezone: true }),
    observaciones: text('observaciones'),
    creadoPor: uuid('creado_por')
      .notNull()
      .references(() => usuarios.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('creditos_cliente_idx').on(table.clienteId),
    index('creditos_estado_idx').on(table.estado),
    index('creditos_fecha_vencimiento_idx').on(table.fechaVencimiento),
    // Regla 1: un cliente no puede tener dos creditos activos a la vez.
    uniqueIndex('creditos_un_activo_por_cliente')
      .on(table.clienteId)
      .where(sql`${table.estado} = 'activo'`),
  ],
);

export const cuotas = pgTable(
  'cuotas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    creditoId: uuid('credito_id')
      .notNull()
      .references(() => creditos.id, { onDelete: 'cascade' }),
    numero: integer('numero').notNull(),
    fechaVencimiento: date('fecha_vencimiento').notNull(),
    monto: numeric('monto', { precision: 18, scale: 2 }).notNull(),
    saldoAnterior: numeric('saldo_anterior', { precision: 18, scale: 2 }).notNull(),
    saldoDespues: numeric('saldo_despues', { precision: 18, scale: 2 }).notNull(),
    estado: estadoCuota('estado').notNull().default('pendiente'),
    abonoId: uuid('abono_id'),
    pagadoEn: timestamp('pagado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cuotas_credito_numero_unico').on(table.creditoId, table.numero),
    index('cuotas_vencimiento_idx').on(table.fechaVencimiento),
    index('cuotas_estado_idx').on(table.estado),
  ],
);

export const abonos = pgTable(
  'abonos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    creditoId: uuid('credito_id')
      .notNull()
      .references(() => creditos.id, { onDelete: 'cascade' }),
    cuotaId: uuid('cuota_id').references(() => cuotas.id, { onDelete: 'set null' }),
    monto: numeric('monto', { precision: 18, scale: 2 }).notNull(),
    fecha: date('fecha').notNull(),
    referencia: text('referencia'),
    observaciones: text('observaciones'),
    saldoAnterior: numeric('saldo_anterior', { precision: 18, scale: 2 }).notNull(),
    saldoDespues: numeric('saldo_despues', { precision: 18, scale: 2 }).notNull(),
    registradoPor: uuid('registrado_por')
      .notNull()
      .references(() => usuarios.id),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: uuid('anulado_por').references(() => usuarios.id),
    motivoAnulacion: text('motivo_anulacion'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('abonos_credito_idx').on(table.creditoId),
    index('abonos_fecha_idx').on(table.fecha),
    index('abonos_registrado_por_idx').on(table.registradoPor),
  ],
);

export const rutas = pgTable(
  'rutas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nombre: text('nombre').notNull(),
    operadorId: uuid('operador_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    fecha: date('fecha').notNull(),
    estado: estadoRuta('estado').notNull().default('pendiente'),
    abiertaEn: timestamp('abierta_en', { withTimezone: true }),
    cerradaEn: timestamp('cerrada_en', { withTimezone: true }),
    observaciones: text('observaciones'),
    creadoPor: uuid('creado_por')
      .notNull()
      .references(() => usuarios.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('rutas_operador_idx').on(table.operadorId),
    index('rutas_estado_idx').on(table.estado),
    index('rutas_fecha_idx').on(table.fecha),
  ],
);

export const rutasClientes = pgTable(
  'rutas_clientes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rutaId: uuid('ruta_id')
      .notNull()
      .references(() => rutas.id, { onDelete: 'cascade' }),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    orden: integer('orden').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('rutas_clientes_unico').on(table.rutaId, table.clienteId),
    uniqueIndex('rutas_clientes_orden_unico').on(table.rutaId, table.orden),
    index('rutas_clientes_cliente_idx').on(table.clienteId),
  ],
);

export const fotosCliente = pgTable(
  'fotos_cliente',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    tipo: tipoFotoCliente('tipo').notNull(),
    uri: text('uri').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('fotos_cliente_idx').on(table.clienteId),
    uniqueIndex('fotos_cliente_tipo_unico').on(table.clienteId, table.tipo),
  ],
);

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  tokensRefresh: many(tokensRefresh),
  rutas: many(rutas),
}));

export const tokensRefreshRelations = relations(tokensRefresh, ({ one }) => ({
  usuario: one(usuarios, { fields: [tokensRefresh.usuarioId], references: [usuarios.id] }),
}));

export const clientesRelations = relations(clientes, ({ many }) => ({
  creditos: many(creditos),
  fotos: many(fotosCliente),
  rutas: many(rutasClientes),
}));

export const creditosRelations = relations(creditos, ({ one, many }) => ({
  cliente: one(clientes, { fields: [creditos.clienteId], references: [clientes.id] }),
  creador: one(usuarios, { fields: [creditos.creadoPor], references: [usuarios.id] }),
  cuotas: many(cuotas),
  abonos: many(abonos),
}));

export const cuotasRelations = relations(cuotas, ({ one }) => ({
  credito: one(creditos, { fields: [cuotas.creditoId], references: [creditos.id] }),
  abono: one(abonos, { fields: [cuotas.abonoId], references: [abonos.id] }),
}));

export const abonosRelations = relations(abonos, ({ one }) => ({
  credito: one(creditos, { fields: [abonos.creditoId], references: [creditos.id] }),
  cuota: one(cuotas, { fields: [abonos.cuotaId], references: [cuotas.id] }),
  registrador: one(usuarios, { fields: [abonos.registradoPor], references: [usuarios.id] }),
  anulador: one(usuarios, { fields: [abonos.anuladoPor], references: [usuarios.id] }),
}));

export const rutasRelations = relations(rutas, ({ one, many }) => ({
  operador: one(usuarios, { fields: [rutas.operadorId], references: [usuarios.id] }),
  creador: one(usuarios, { fields: [rutas.creadoPor], references: [usuarios.id] }),
  clientes: many(rutasClientes),
}));

export const rutasClientesRelations = relations(rutasClientes, ({ one }) => ({
  ruta: one(rutas, { fields: [rutasClientes.rutaId], references: [rutas.id] }),
  cliente: one(clientes, { fields: [rutasClientes.clienteId], references: [clientes.id] }),
}));

export const fotosClienteRelations = relations(fotosCliente, ({ one }) => ({
  cliente: one(clientes, { fields: [fotosCliente.clienteId], references: [clientes.id] }),
}));

export type Usuario = typeof usuarios.$inferSelect;
export type NuevoUsuario = typeof usuarios.$inferInsert;
export type Cliente = typeof clientes.$inferSelect;
export type NuevoCliente = typeof clientes.$inferInsert;
export type Credito = typeof creditos.$inferSelect;
export type NuevoCredito = typeof creditos.$inferInsert;
export type Cuota = typeof cuotas.$inferSelect;
export type NuevaCuota = typeof cuotas.$inferInsert;
export type Abono = typeof abonos.$inferSelect;
export type NuevoAbono = typeof abonos.$inferInsert;
export type Ruta = typeof rutas.$inferSelect;
export type NuevaRuta = typeof rutas.$inferInsert;
export type RutaCliente = typeof rutasClientes.$inferSelect;
export type FotoCliente = typeof fotosCliente.$inferSelect;

export type RolUsuario = (typeof rolUsuario.enumValues)[number];
export type PeriodoPago = (typeof periodoPago.enumValues)[number];
export type EstadoCredito = (typeof estadoCredito.enumValues)[number];
export type EstadoRuta = (typeof estadoRuta.enumValues)[number];
export type EstadoCuota = (typeof estadoCuota.enumValues)[number];
export type TipoFotoCliente = (typeof tipoFotoCliente.enumValues)[number];
