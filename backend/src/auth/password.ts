import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) {
    return false;
  }

  const expectedKey = Buffer.from(keyHex, 'hex');
  const derivedKey = await scryptAsync(
    password.normalize('NFKC'),
    Buffer.from(saltHex, 'hex'),
    expectedKey.length,
  );

  return timingSafeEqual(derivedKey, expectedKey);
}
