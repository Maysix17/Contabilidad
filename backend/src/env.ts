const DEV_SECRET = 'dev-only-insecure-secret-change-me';

/**
 * Valores de ejemplo que aparecen en el codigo o en `.env.example`. Si alguno
 * llega a produccion, el secreto es publico: cualquiera que lea el repositorio
 * firmaria un token con el rol que quisiera.
 */
const SECRETOS_DE_EJEMPLO = new Set([
  DEV_SECRET,
  'cambia-esto-por-un-secreto-largo-y-aleatorio',
]);

const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

/**
 * Que la app levante en silencio con el secreto equivocado es peor que no
 * levante, asi que en produccion se corta el arranque. Solo aplica a produccion:
 * en local el valor por defecto evita tener que configurar nada.
 *
 * Aparte del valor de ejemplo, se rechaza tambien un secreto demasiado corto,
 * que es la otra forma facil de que quede adivinable.
 */
function requireSecret(name: string, fallback?: string): string {
  const value = requireEnv(name, fallback);

  if (isProduction) {
    if (SECRETOS_DE_EJEMPLO.has(value)) {
      throw new Error(
        `${name} tiene un valor de ejemplo. Genera uno propio con: ` +
          'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
      );
    }

    if (value.length < 32) {
      throw new Error(`${name} es demasiado corto para produccion (minimo 32 caracteres)`);
    }
  }

  return value;
}

export const env = {
  jwtSecret: requireSecret('JWT_SECRET', DEV_SECRET),
  accessTokenTtl: Number(requireEnv('ACCESS_TOKEN_TTL', '900')),
  refreshTokenTtl: Number(requireEnv('REFRESH_TOKEN_TTL', '2592000')),
  isProduction,
};