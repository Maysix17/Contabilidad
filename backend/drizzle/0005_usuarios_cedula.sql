-- El login pasa a ser por cedula y el correo electronico se elimina.
-- Los usuarios existentes reciben una cedula derivada de su id para no
-- perder el acceso, y deben ser reasignados desde la pantalla de usuarios.
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "cedula" text;
--> statement-breakpoint
UPDATE "usuarios" SET "cedula" = substr(md5("id"::text)::text, 1, 10) WHERE "cedula" IS NULL;
--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "cedula" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "public"."usuarios_correo_unico";
--> statement-breakpoint
ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "correo";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_cedula_unico" ON "usuarios" USING btree ("cedula");
