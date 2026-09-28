import { badRequest } from '@/http';

const SOLO_DIGITOS = /^\d+$/;

export function normalizarCedula(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function assertCedula(valor: unknown, campo = 'cedula'): string {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw badRequest(`${campo} es obligatorio`);
  }

  const cedula = normalizarCedula(valor);

  if (!SOLO_DIGITOS.test(cedula)) {
    throw badRequest(`${campo} solo puede contener numeros`);
  }

  if (cedula.length < 6 || cedula.length > 10) {
    throw badRequest(`${campo} debe tener entre 6 y 10 digitos`);
  }

  return cedula;
}
