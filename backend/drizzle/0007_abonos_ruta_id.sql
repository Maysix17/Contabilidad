-- Ancla los abonos a la ruta en la que se cobraron. Antes el sistema solo
-- sabia QUE operador registro el abono (abonos.registrado_por), pero no en que
-- ruta: para reconstruir el trabajo de un operador habia que sumar todos sus
-- abonos y restar los de los demas, lo cual se rompe en cuanto hay mas de una
-- persona cobrando el mismo dia.
--
-- Es nullable a proposito: los abonos ya registrados no tienen ruta y no se
-- van a inventar, y los que se creen desde la pantalla de abono normal
-- tampoco la llevan. Solo la llena el endpoint de cobro de una ruta.
ALTER TABLE "abonos" ADD COLUMN "ruta_id" uuid;
--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_ruta_id_rutas_id_fk" FOREIGN KEY ("ruta_id") REFERENCES "public"."rutas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "abonos_ruta_id_idx" ON "abonos" USING btree ("ruta_id");
