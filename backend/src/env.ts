const DEV_SECRET = 'dev-only-insecure-secret-change-me';

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

export const env = {
  jwtSecret: requireEnv('JWT_SECRET', DEV_SECRET),
  accessTokenTtl: Number(requireEnv('ACCESS_TOKEN_TTL', '900')),
  refreshTokenTtl: Number(requireEnv('REFRESH_TOKEN_TTL', '2592000')),
  isProduction: process.env.NODE_ENV === 'production',
};
