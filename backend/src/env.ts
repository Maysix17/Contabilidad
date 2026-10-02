const DEV_SECRET = 'dev-only-insecure-secret-change-me';

const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

/**
 * El secreto con el que se firman los tokens vive en el codigo como valor por
 * defecto para que el desarrollo local no tenga que configurar nada. Ese
 * atajo no puede sobrevivir a produccion: si la app arrancara con el secreto
 * de ejemplo, cualquiera que pudiera leer el codigo firmaria un token con el
 * rol que quisiera y entraria como administrador. Que la app levante en
 * silencio con el secreto equivocado es peor que no levante, asi que aqui se
 * corta el arranque.
 */
function requireSecret(name: string, fallback?: string): string {
  const value = requireEnv(name, fallback);

  if (isProduction && value === DEV_SECRET) {
    throw new Error(
      `${name} debe definirse con un valor propio antes de desplegar. ` +
        'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }

  return value;
}

export const env = {
  jwtSecret: requireSecret('JWT_SECRET', DEV_SECRET),
  accessTokenTtl: Number(requireEnv('ACCESS_TOKEN_TTL', '900')),
  refreshTokenTtl: Number(requireEnv('REFRESH_TOKEN_TTL', '2592000')),
  isProduction,
};