CREATE TYPE "public"."estado_credito" AS ENUM('activo', 'pagado', 'cerrado');--> statement-breakpoint
CREATE TYPE "public"."periodo_pago" AS ENUM('diario', 'semanal', 'quincenal', 'bisemanal', 'mensual');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('administrador', 'operador');--> statement-breakpoint
CREATE TABLE "abonos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credito_id" uuid NOT NULL,
	"monto" bigint NOT NULL,
	"fecha" date NOT NULL,
	"referencia" text,
	"observaciones" text,
	"registrado_por" uuid NOT NULL,
	"anulado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creditos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"valor_original" bigint NOT NULL,
	"saldo" bigint NOT NULL,
	"interes_porcentaje" numeric(5, 2) DEFAULT '0' NOT NULL,
	"interes_periodo" "periodo_pago" DEFAULT 'mensual' NOT NULL,
	"forma_pago" "periodo_pago" NOT NULL,
	"numero_periodos" integer DEFAULT 1 NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"estado" "estado_credito" DEFAULT 'activo' NOT NULL,
	"cerrado_en" timestamp with time zone,
	"observaciones" text,
	"creado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "rol" "rol_usuario" DEFAULT 'operador' NOT NULL;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_credito_id_creditos_id_fk" FOREIGN KEY ("credito_id") REFERENCES "public"."creditos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creditos" ADD CONSTRAINT "creditos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creditos" ADD CONSTRAINT "creditos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonos_credito_idx" ON "abonos" USING btree ("credito_id");--> statement-breakpoint
CREATE INDEX "abonos_fecha_idx" ON "abonos" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "creditos_cliente_idx" ON "creditos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "creditos_estado_idx" ON "creditos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "creditos_fecha_vencimiento_idx" ON "creditos" USING btree ("fecha_vencimiento");