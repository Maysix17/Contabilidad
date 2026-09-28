ALTER TABLE "abonos" ALTER COLUMN "monto" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "valor_original" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "creditos" ALTER COLUMN "saldo" SET DATA TYPE numeric(18, 2);