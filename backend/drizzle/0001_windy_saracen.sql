ALTER TABLE "clientes" DROP CONSTRAINT "clientes_usuario_id_usuarios_id_fk";
--> statement-breakpoint
DROP INDEX "clientes_usuario_documento_unico";--> statement-breakpoint
DROP INDEX "clientes_usuario_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_documento_unico" ON "clientes" USING btree ("documento");--> statement-breakpoint
CREATE INDEX "clientes_apellido_idx" ON "clientes" USING btree ("apellido","nombre");--> statement-breakpoint
ALTER TABLE "clientes" DROP COLUMN "usuario_id";