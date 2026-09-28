-- Migracion 0004: modelo de cuotas, rutas, fotos e interes fijo.
-- Los creditos y abonos de prueba se limpian porque el modelo de interes cambio
-- de "interes por periodo" a "interes fijo sobre el capital".

DELETE FROM "abonos";
DELETE FROM "creditos";
--> statement-breakpoint
ALTER TABLE "creditos" DROP COLUMN IF EXISTS "interes_periodo";
--> statement-breakpoint
ALTER TABLE "creditos" DROP COLUMN IF EXISTS "interes_porcentaje";
--> statement-breakpoint
-- El enum se renombra en vez de recrearse: la columna creditos.estado depende
-- de el y no se puede borrar el tipo sin romperla.
ALTER TYPE "public"."estado_credito" RENAME VALUE 'pagado' TO 'finalizado';
--> statement-breakpoint
CREATE TYPE "public"."estado_ruta" AS ENUM('pendiente', 'abierta', 'en_proceso', 'cerrada');
--> statement-breakpoint
CREATE TYPE "public"."estado_cuota" AS ENUM('pendiente', 'pagada');
--> statement-breakpoint
CREATE TYPE "public"."tipo_foto_cliente" AS ENUM('cedula', 'persona', 'direccion');
--> statement-breakpoint
CREATE TABLE "rutas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"operador_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"estado" "estado_ruta" DEFAULT 'pendiente' NOT NULL,
	"abierta_en" timestamp with time zone,
	"cerrada_en" timestamp with time zone,
	"observaciones" text,
	"creado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rutas_clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ruta_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credito_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"monto" numeric(18, 2) NOT NULL,
	"saldo_anterior" numeric(18, 2) NOT NULL,
	"saldo_despues" numeric(18, 2) NOT NULL,
	"estado" "estado_cuota" DEFAULT 'pendiente' NOT NULL,
	"abono_id" uuid,
	"pagado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fotos_cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_foto_cliente" NOT NULL,
	"uri" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creditos" ADD COLUMN "interes_porcentaje" numeric(6, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "creditos" ADD COLUMN "interes_total" numeric(18, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "creditos" ADD COLUMN "total_pagar" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "creditos" ADD COLUMN "valor_cuota" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "creditos" ADD COLUMN "dia_pago" integer;
--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "total_pagar" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "total_pagar" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "valor_cuota" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "valor_cuota" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "cuota_id" uuid;
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "saldo_anterior" numeric(18, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "saldo_despues" numeric(18, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "anulado_por" uuid;
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "motivo_anulacion" text;
--> statement-breakpoint
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_operador_id_usuarios_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rutas_clientes" ADD CONSTRAINT "rutas_clientes_ruta_id_rutas_id_fk" FOREIGN KEY ("ruta_id") REFERENCES "public"."rutas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rutas_clientes" ADD CONSTRAINT "rutas_clientes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_credito_id_creditos_id_fk" FOREIGN KEY ("credito_id") REFERENCES "public"."creditos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_abono_id_abonos_id_fk" FOREIGN KEY ("abono_id") REFERENCES "public"."abonos"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_cuota_id_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."cuotas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_anulado_por_usuarios_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fotos_cliente" ADD CONSTRAINT "fotos_cliente_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "rutas_operador_idx" ON "rutas" USING btree ("operador_id");
--> statement-breakpoint
CREATE INDEX "rutas_estado_idx" ON "rutas" USING btree ("estado");
--> statement-breakpoint
CREATE INDEX "rutas_fecha_idx" ON "rutas" USING btree ("fecha");
--> statement-breakpoint
CREATE INDEX "rutas_clientes_cliente_idx" ON "rutas_clientes" USING btree ("cliente_id");
--> statement-breakpoint
CREATE INDEX "cuotas_vencimiento_idx" ON "cuotas" USING btree ("fecha_vencimiento");
--> statement-breakpoint
CREATE INDEX "cuotas_estado_idx" ON "cuotas" USING btree ("estado");
--> statement-breakpoint
CREATE INDEX "fotos_cliente_idx" ON "fotos_cliente" USING btree ("cliente_id");
--> statement-breakpoint
CREATE INDEX "abonos_registrado_por_idx" ON "abonos" USING btree ("registrado_por");
--> statement-breakpoint
CREATE UNIQUE INDEX "rutas_clientes_unico" ON "rutas_clientes" USING btree ("ruta_id","cliente_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "rutas_clientes_orden_unico" ON "rutas_clientes" USING btree ("ruta_id","orden");
--> statement-breakpoint
CREATE UNIQUE INDEX "cuotas_credito_numero_unico" ON "cuotas" USING btree ("credito_id","numero");
--> statement-breakpoint
CREATE UNIQUE INDEX "fotos_cliente_tipo_unico" ON "fotos_cliente" USING btree ("cliente_id","tipo");
--> statement-breakpoint
CREATE UNIQUE INDEX "creditos_un_activo_por_cliente" ON "creditos" USING btree ("cliente_id") WHERE "creditos"."estado" = 'activo';
