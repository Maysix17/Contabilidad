-- La forma de pago "bisemanal" se retira del sistema. PostgreSQL no permite
-- borrar un valor de un enum que este en uso, asi que primero se lleva la
-- columna a texto, se reconstruye el tipo y se devuelve la columna al enum.
-- La conversion previa es una red de seguridad: si alguien llego a crear un
-- credito bisemanal, queda como quincenal en vez de romper la migracion.
UPDATE "creditos" SET "forma_pago" = 'quincenal' WHERE "forma_pago" = 'bisemanal';
--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "forma_pago" SET DATA TYPE text USING "forma_pago"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."periodo_pago";
--> statement-breakpoint
CREATE TYPE "public"."periodo_pago" AS ENUM('diario', 'semanal', 'quincenal', 'mensual');
--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "forma_pago" SET DATA TYPE "public"."periodo_pago" USING "forma_pago"::"public"."periodo_pago";
