import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const STORAGE_KEY = 'contabilidad.sesion';

export type RolUsuario = 'administrador' | 'operador';
export type PeriodoPago = 'diario' | 'semanal' | 'quincenal' | 'bisemanal' | 'mensual';
export type EstadoCredito = 'activo' | 'finalizado' | 'cerrado';

export interface SessionUser {
  id: string;
  cedula: string;
  nombre: string;
  rol: RolUsuario;
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Cliente {
  id: string;
  documento: string;
  nombre: string;
  apellido: string;
  celular: string;
  direccion: string;
  alias: string | null;
  telefono: string | null;
  direccion2: string | null;
  ciudad: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ClienteInput {
  documento: string;
  nombre: string;
  apellido: string;
  celular: string;
  direccion: string;
  alias?: string | null;
  telefono?: string | null;
  direccion2?: string | null;
  ciudad?: string | null;
}

/** Cliente con su credito activo, tal como lo devuelve la pestaña de abonos. */
export interface ClientePorCobrar extends Cliente {
  creditoActivo: {
    id: string;
    saldo: string;
    valorCuota: string;
    totalPagar: string;
    numeroPeriodos: number;
    fechaVencimiento: string;
  };
}

/** Devuelve el backend en `resumenCuotas` (backend/src/creditos/calculos.ts). */
export interface ResumenCuotas {
  total: number;
  pagadas: number;
  pendientes: number;
  atrasadas: number;
  proximaVencimiento: string | null;
  saldoTotal: number;
  valorCuota: number;
}

export interface Cuota {
  id: string;
  numero: number;
  fechaVencimiento: string;
  monto: string;
  saldoAnterior: string;
  saldoDespues: string;
  estado: 'pendiente' | 'pagada';
  abonoId: string | null;
  pagadoEn: string | null;
}

export interface Credito {
  id: string;
  clienteId: string;
  valorOriginal: string;
  interesPorcentaje: string;
  interesTotal: string;
  totalPagar: string;
  valorCuota: string;
  saldo: string;
  formaPago: PeriodoPago;
  numeroPeriodos: number;
  diaPago: number | null;
  fechaInicio: string;
  fechaVencimiento: string;
  estado: EstadoCredito;
  cerradoEn: string | null;
  observaciones: string | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
  cliente: { id: string; nombre: string; apellido: string; documento: string } | null;
  resumen: ResumenCuotas;
  cuotas: Cuota[];
  referencia: string;
  /** Solo lo devuelve el detalle de un crédito. */
  creador?: { nombre: string; cedula: string } | null;
}

export interface Abono {
  id: string;
  creditoId: string;
  cuotaId: string | null;
  monto: string;
  fecha: string;
  referencia: string | null;
  observaciones: string | null;
  saldoAnterior: string;
  saldoDespues: string;
  registradoPor: string;
  anuladoEn: string | null;
  anuladoPor: string | null;
  motivoAnulacion: string | null;
  creadoEn: string;
  registrador?: { nombre: string } | null;
}

export interface CreditoDetalle extends Credito {
  abonos: Abono[];
}

export interface Usuario {
  id: string;
  cedula: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEn?: string;
}

export interface Indicadores {
  referencia: string;
  creditosActivos: number;
  creditosFinalizados: number;
  creditosCerrados: number;
  saldoPorCobrar: number;
  abonosDelMes: number;
  clientesActivos: number;
  clientesEnMora: number;
  saldoVencido: number;
  cuotasAtrasadas: number;
  rutasActivas: number;
}

export interface TopDeudor {
  creditoId: string;
  clienteId: string;
  nombre: string;
  apellido: string;
  documento: string;
  saldo: number;
  valorCuota: number;
  cuotasPendientes: number;
  cuotasAtrasadas: number;
  proximaVencimiento: string | null;
}

export interface ProximoVencimiento {
  creditoId: string;
  cliente: string;
  documento: string;
  fechaVencimiento: string;
  valorCuota: number;
  saldo: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let cache: Session | null = null;
let cargando = false;

export async function restoreSession(): Promise<Session | null> {
  if (cache) return cache;
  if (cargando) return null;

  cargando = true;
  try {
    const guardado = await AsyncStorage.getItem(STORAGE_KEY);
    if (!guardado) return null;

    const session = JSON.parse(guardado) as Session;
    cache = session;

    try {
      const user = await getMe();
      session.user = user;
      cache = session;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      await clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  } finally {
    cargando = false;
  }
}

async function guardar(session: Session): Promise<void> {
  cache = session;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  const session = cache;
  cache = null;
  await AsyncStorage.removeItem(STORAGE_KEY);

  if (session?.refreshToken) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken}),
    }).catch(() => undefined);
  }
}

export async function login(input: {
  cedula: string;
  password: string;
}): Promise<Session> {
  const session = await request<Session>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    anonimo: true,
  });
  await guardar(session);
  return session;
}

export async function getMe(): Promise<SessionUser> {
  const result = await request<{ user: SessionUser }>('/api/auth/me');
  return result.user;
}

/* ------------------------------- clientes ------------------------------- */

export async function listClientes(
  filters: { search?: string; includeInactive?: boolean } = {},
): Promise<Cliente[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.includeInactive) params.set('includeInactive', 'true');

  const query = params.toString();
  const result = await request<{ clientes: Cliente[] }>(
    `/api/clientes${query ? `?${query}` : ''}`,
  );
  return result.clientes;
}

/** Regla 2: solo los clientes sin credito activo pueden recibir un credito nuevo. */
export async function listClientesDisponiblesParaCredito(
  search?: string,
): Promise<Cliente[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const result = await request<{ clientes: Cliente[] }>(
    `/api/clientes/disponibles-para-credito${query}`,
  );
  return result.clientes;
}

/** Solo los clientes que tienen credito activo: la cartera por cobrar. */
export async function listClientesPorCobrar(search?: string): Promise<ClientePorCobrar[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const result = await request<{ clientes: ClientePorCobrar[] }>(
    `/api/clientes/con-credito-activo${query}`,
  );
  return result.clientes;
}

export async function createCliente(input: ClienteInput): Promise<Cliente> {
  const result = await request<{ cliente: Cliente }>('/api/clientes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.cliente;
}

export async function updateCliente(id: string, input: Partial<ClienteInput>): Promise<Cliente> {
  const result = await request<{ cliente: Cliente }>(`/api/clientes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return result.cliente;
}

export async function deleteCliente(id: string): Promise<void> {
  await request<{ eliminado: string }>(`/api/clientes/${id}`, { method: 'DELETE' });
}

/* ------------------------------- creditos ------------------------------- */

export interface CreditoInput {
  clienteId: string;
  valorOriginal: number;
  interesPorcentaje: number;
  formaPago: PeriodoPago;
  numeroPeriodos: number;
  fechaInicio: string;
  diaPago?: number | null;
  observaciones?: string | null;
}

export interface PlanCuota {
  numero: number;
  fechaVencimiento: string;
  monto: number;
  saldoAnterior: number;
  saldoDespues: number;
}

export interface PlanCreditoSimulado {
  valorOriginal: number;
  interesTotal: number;
  totalPagar: number;
  valorCuota: number;
  numeroPeriodos: number;
  formaPago: PeriodoPago;
  fechaInicio: string;
  fechaVencimiento: string;
  diaPago: number | null;
  cuotas: PlanCuota[];
}

/** Alimenta la vista previa de la pantalla de nuevo crédito. */
export async function simularCredito(
  input: Omit<CreditoInput, 'clienteId' | 'observaciones'>,
): Promise<PlanCreditoSimulado> {
  const result = await request<{ plan: PlanCreditoSimulado }>('/api/creditos/simular', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.plan;
}

export async function listCreditos(
  filters: {
    clienteId?: string;
    estado?: EstadoCredito;
    desde?: string;
    hasta?: string;
    search?: string;
  } = {},
): Promise<Credito[]> {
  const params = new URLSearchParams();
  if (filters.clienteId) params.set('clienteId', filters.clienteId);
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.desde) params.set('desde', filters.desde);
  if (filters.hasta) params.set('hasta', filters.hasta);
  if (filters.search) params.set('search', filters.search);

  const query = params.toString();
  const result = await request<{ creditos: Credito[] }>(
    `/api/creditos${query ? `?${query}` : ''}`,
  );
  return result.creditos;
}

export async function createCredito(input: CreditoInput): Promise<Credito> {
  const result = await request<{ credito: Credito }>('/api/creditos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.credito;
}

export async function getCredito(id: string): Promise<CreditoDetalle> {
  const result = await request<{ credito: Credito; abonos: Abono[] }>(
    `/api/creditos/${id}`,
  );
  return { ...result.credito, abonos: result.abonos };
}

export async function cerrarCredito(id: string, motivo?: string): Promise<Credito> {  const result = await request<{ credito: Credito }>(`/api/creditos/${id}/cerrar`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
  return result.credito;
}

export async function deleteCredito(id: string): Promise<void> {
  await request<{ eliminado: string }>(`/api/creditos/${id}`, { method: 'DELETE' });
}

/* -------------------------------- abonos -------------------------------- */

export interface AbonoResultado {
  abono: Abono;
  credito: Credito;
  saldo: number;
  estado: EstadoCredito;
  resumen: ResumenCuotas;
}

/**
 * `cuotaId` es opcional: si se envia, el abono se aplica exactamente a esa
 * cuota y el monto debe coincidir. Si se omite, el backend reparte el abono
 * sobre las cuotas pendientes mas antiguas.
 */
export async function registrarAbono(
  creditoId: string,
  input: {
    monto: number;
    cuotaId?: string | null;
    fecha?: string;
    referencia?: string | null;
    observaciones?: string | null;
  },
): Promise<AbonoResultado> {
  return request<AbonoResultado>(`/api/creditos/${creditoId}/abonos`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function anularAbono(
  abonoId: string,
  motivo: string,
): Promise<{ anulado: string; saldo: number }> {
  return request(`/api/creditos/abonos/${abonoId}/anular`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
}

/* ------------------------------- usuarios ------------------------------- */

export async function listUsuarios(search?: string): Promise<Usuario[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const result = await request<{ usuarios: Usuario[] }>(`/api/usuarios${query}`);
  return result.usuarios;
}

export async function createUsuario(input: {
  cedula: string;
  nombre: string;
  contrasena: string;
  rol: RolUsuario;
}): Promise<Usuario> {
  const result = await request<{ usuario: Usuario }>('/api/usuarios', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.usuario;
}

export async function cambiarRolUsuario(id: string, rol: RolUsuario): Promise<Usuario> {
  const result = await request<{ usuario: Usuario }>(`/api/usuarios/${id}/rol`, {
    method: 'PATCH',
    body: JSON.stringify({ rol }),
  });
  return result.usuario;
}

export async function cambiarEstadoUsuario(id: string, activo: boolean): Promise<Usuario> {
  const result = await request<{ usuario: Usuario }>(`/api/usuarios/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  });
  return result.usuario;
}

export async function restablecerContrasena(id: string, contrasena: string): Promise<void> {
  await request(`/api/usuarios/${id}/restablecer-contrasena`, {
    method: 'POST',
    body: JSON.stringify({ contrasena }),
  });
}

export async function deleteUsuario(id: string): Promise<void> {
  await request<{ eliminado: string }>(`/api/usuarios/${id}`, { method: 'DELETE' });
}

/* ------------------------------ indicadores ----------------------------- */

export async function getIndicadores(): Promise<{
  indicadores: Indicadores;
  topDeudores: TopDeudor[];
  proximosVencimientos: ProximoVencimiento[];
}> {
  return request('/api/indicadores');
}

/* --------------------------------- core --------------------------------- */

type RequestInitExt = RequestInit & { anonimo?: boolean };

/**
 * Sin este tope, un `fetch` que no logra conectar se queda pendiente para
 * siempre: la promesa nunca resuelve, el `finally` de quien la espera nunca
 * corre y los botones quedan en "Cargando…" sin mostrar ningun error.
 */
const TIMEOUT_MS = 20000;

export const MENSAJE_SIN_CONEXION =
  'No se pudo conectar con el servidor. Revisa que el backend esté corriendo ' +
  'y que el teléfono esté en la misma red que el computador.';

export async function request<T>(
  path: string,
  init: RequestInitExt = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (!init.anonimo && cache?.accessToken) {
    headers.Authorization = `Bearer ${cache.accessToken}`;
  }

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: control.signal,
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new ApiError(0, 'El servidor no respondió a tiempo.');
    }
    throw new ApiError(0, MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(temporizador);
  }

  if (response.status === 401 && retry && cache?.refreshToken) {
    const renovado = await refrescar();
    if (renovado) {
      return request<T>(path, init, false);
    }
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, payload?.error?.message ?? 'Error inesperado');
  }

  return payload as T;
}

async function refrescar(): Promise<boolean> {
  const refreshToken = cache?.refreshToken;
  if (!refreshToken) return false;

  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearSession();
    return false;
  }

  const session = (await response.json()) as Session;
  await guardar(session);
  return true;
}
