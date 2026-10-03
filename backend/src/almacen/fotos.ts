import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
/**
 * Las fotos se guardan como archivos en el servidor, no en la base de datos.
 * Guardarlas en la tabla `fotos_cliente` como base64 engordaria la base y
 * volveria mas lentas las consultas de clientes; aqui solo se guarda el nombre
 * del archivo.
 *
 * La carpeta queda fuera de `src/` porque es contenido generado, no codigo: se
 * regenera sola y no tiene sentido versionarla.
 */
export const CARPETA_FOTOS = path.resolve(process.cwd(), 'uploads', 'fotos-cliente');

/** Tope por foto. 8 MB da de sobra para una foto de cedula o de fachada. */
export const TAMANO_MAXIMO = 8 * 1024 * 1024;

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Solo se admiten imagenes. Sin esto, un cliente podria subir cualquier
 * archivo por el mismo endpoint (un `.html` con un script, por ejemplo) y el
 * navegador lo ejecutaria al servirlo.
 */
export function extensionPermitida(contentType: string | undefined): string | null {
  if (!contentType) return null;
  return EXTENSIONES[contentType.toLowerCase().trim()] ?? null;
}

/**
 * Nombre generado, nunca el que envia el cliente: un nombre arbitrario
 * allowistado con la extension (`../../app.js`) permitiria escribir fuera de la
 * carpeta de fotos.
 */
export function nombreArchivo(tipo: string, extension: string): string {
  return `${tipo}-${Date.now()}-${randomUUID()}.${extension}`;
}

export async function guardarFoto(nombre: string, datos: Uint8Array): Promise<string> {
  await mkdir(CARPETA_FOTOS, { recursive: true });
  await writeFile(path.join(CARPETA_FOTOS, nombre), datos);
  return nombre;
}

/**
 * `serveStatic` se registra al arrancar y falla si la carpeta no existe todavia,
 * que es justo el caso de una instalacion nueva. Se crea vacia al inicio para
 * que el servidor levante siempre.
 */
export async function asegurarCarpetaFotos(): Promise<void> {
  await mkdir(CARPETA_FOTOS, { recursive: true });
}

/**
 * Si el archivo ya no esta, se traga el error: el registro de la base sigue
 * apuntando a un nombre que no existe y borrarlo no deberia fallar.
 */
export async function borrarArchivo(nombre: string): Promise<void> {
  try {
    await unlink(path.join(CARPETA_FOTOS, nombre));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
  }
}
