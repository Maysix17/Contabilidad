const formatterPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatterCentavos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function aNumero(valor: string | number | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Muestra los centavos solo cuando el monto los tiene. Un total de 2.400.000 se
 * ve igual que antes, pero una cuota de 92.307,70 ya no se muestra como 92.308:
 * ese redondeo era la causa de que el valor mostrado nunca coincidiera con el
 * valor real y el abono fuera rechazado.
 */
export function formatearPesos(valor: string | number | null | undefined): string {
  const centavos = Math.round(aNumero(valor) * 100);

  if (centavos % 100 === 0) {
    return formatterPesos.format(centavos / 100);
  }

  return formatterCentavos.format(centavos / 100);
}

export function formatearNumero(valor: number): string {
  return new Intl.NumberFormat('es-CO').format(valor);
}

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Acepta lo que la gente escribe de verdad: "92307.70", "92.307,70", "92308",
 * "$ 92.308".
 *
 * El separador decimal cambia segun como se escriba, y antes se asumia siempre
 * el formato colombiano: un punto se tomaba como separador de miles, asi que
 * "92307.70" terminaba siendo 9.230.770 y el abono se rechazaba por superar el
 * saldo. Ahora la coma manda como decimal, y si solo hay puntos se usa como
 * decimal salvo cuando le siguen exactamente tres digitos, que es la forma en
 * que se escriben los miles.
 */
export function parsearPesos(texto: string): number {
  const limpio = texto.replace(/[^\d,.-]/g, '').replace(/-/g, '');
  if (!limpio) return 0;

  let normalizado: string;

  if (limpio.includes(',')) {
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = limpio.split('.');
    const esSeparadorDeMiles =
      partes.length > 2 || (partes.length === 2 && partes[1].length === 3);
    normalizado = esSeparadorDeMiles ? partes.join('') : limpio;
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}
