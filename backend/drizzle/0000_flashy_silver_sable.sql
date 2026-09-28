CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"documento" text NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"celular" text NOT NULL,
	"direccion" text NOT NULL,
	"alias" text,
	"telefono" text,
	"direccion_2" text,
	"ciudad" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens_refresh" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"hash_token" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"revocado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correo" text NOT NULL,
	"hash_contrasena" text NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens_refresh" ADD CONSTRAINT "tokens_refresh_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_usuario_documento_unico" ON "clientes" USING btree ("usuario_id","documento");--> statement-breakpoint
CREATE INDEX "clientes_usuario_idx" ON "clientes" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_refresh_hash_unico" ON "tokens_refresh" USING btree ("hash_token");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_correo_unico" ON "usuarios" USING btree ("correo");