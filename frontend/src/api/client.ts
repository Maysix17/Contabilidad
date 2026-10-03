import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const STORAGE_KEY = 'contabilidad.sesion';

export type RolUsuario = 'administrador' | 'operador';
export type PeriodoPago = 'diario' | 'semanal' | 'quincenal' | 'mensual';
export type EstadoCredito = 'activo' | 'finalizado' | 'cerrado';
export type EstadoRuta = 'pendiente' | 'abierta' | 'en_proceso' | 'cerrada';

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

/**
 * Da de baja al cliente sin perder su historial: deja de recibir creditos y de
 * aparecer en el cobro, pero los creditos y abonos que ya tiene siguen
 * existiendo y contando en los indicadores.
 */
export async function desactivarCliente(id: string): Promise<Cliente> {
  const result = await request<{ cliente: Cliente }>(`/api/clientes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ activo: false }),
  });
  return result.cliente;
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
    /** Fecha de la cuota pendiente mas vieja que ya vencio; `null` si esta al dia. */
    vencidaMasAntigua: string | null;
    /** Cuantas cuotas pendientes hay vencidas. */
    vencidas: number;
  };
}

/** Devuelve el backend en `resumenCuotas` (backend/src/creditos/calculos.ts). */
export interface ResumenCuotas {
  total: number;
  pagadas: number;
  pendientes: number;
  atrasadas: number;
  proximaVencimiento: string | null;
  vencidaMasAntigua: string | null;
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
  rutaId: string | null;
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
  vencidaMasAntigua: string | null;
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
    /** Etiqueta para distinguir fallos que la pantalla debe tratar distinto. */
    readonly clase?: string,
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

    /**
     * Solo un 401 real significa "esta sesion ya no sirve". Un error de red,
     * un backend que reinicia o un timeout NO: son fallos temporales, y tratar
     * esos como una sesion invalida hacia que un simple reload durante un
     * reinicio del servidor borrara la sesion del telefono y mandara al login.
     * Peor todavia, `clearSession` tambien revoca el refresh token en la base,
     * asi que el usuario tendria que volver a escribir su contrasena.
     *
     * Cuando no se puede confirmar nada por red, se devuelve la sesion guardada:
     * las peticiones siguientes mostraran su propio error de conexion si la red
     * sigue caída, sin haber expulsado al usuario de la app.
     */
    try {
      const user = await getMe();
      session.user = user;
      cache = session;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await clearSession();
        return null;
      }

      // Status 0 es "no hubo respuesta". Se conserva lo que habia en disco.
      return session;
    }
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

/**
 * Borra la sesion del telefono.
 *
 * `revocar` solo se usa al cerrar sesion a proposito. Cuando lo que falla es
 * una validacion (un token vencido, una cuenta desactivada), revocar el refresh
 * token en el servidor convierte un problema menor en uno terminal: la sesion
 * queda inservible aunque el token siguiera siendo valido, y el usuario tiene
 * que volver a escribir su contrasena. Aqui solo se borra lo local y se deja
 * que el refresh token siga sirviendo hasta que el backend lo rechace de verdad.
 */
export async function clearSession(opciones: { revocar?: boolean } = {}): Promise<void> {
  const session = cache;
  cache = null;
  await AsyncStorage.removeItem(STORAGE_KEY);

  if (opciones.revocar && session?.refreshToken) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
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

/**
 * Cliente puntual. Existe `GET /clientes/:id`, y usarlo evita descargar el
 * listado completo (que llega a 200 filas) solo para buscar una.
 *
 * Devuelve `null` cuando ya no existe, en vez de lanzar: la pantalla de detalle
 * necesita distinguir "no existe" de "no se pudo cargar".
 */
export async function getCliente(id: string): Promise<Cliente | null> {
  try {
    const result = await request<{ cliente: Cliente }>(`/api/clientes/${id}`);
    return result.cliente;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
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

/* ------------------------ fotos del cliente ------------------------ */

/**
 * Hay tres ranuras por cliente y solo una foto en cada una: la base de datos
 * tiene un indice unico por cliente y tipo, asi que volver a subir una foto
 * reemplaza la anterior en vez de acumular versiones.
 */
export type TipoFotoCliente = 'cedula' | 'persona' | 'direccion';

export interface FotoCliente {
  id: string;
  clienteId: string;
  tipo: TipoFotoCliente;
  uri: string;
  creadoEn: string;
}

/** URL publica de la foto, para pintar en un `<Image>`. */
export function urlFoto(nombreArchivo: string): string {
  return `${API_URL}/fotos/${nombreArchivo}`;
}

export async function listarFotosCliente(clienteId: string): Promise<FotoCliente[]> {
  const result = await request<{ fotos: FotoCliente[] }>(`/api/clientes/${clienteId}/fotos`);
  return result.fotos;
}

export async function subirFotoCliente(
  clienteId: string,
  tipo: TipoFotoCliente,
  uriLocal: string,
): Promise<FotoCliente> {
  const cuerpo = new FormData();
  /**
   * `File` de `expo-file-system` implementa `Blob`. Es lo que hay que adjuntar:
   * el `fetch` global de React Native rechaza el objeto plano `{ uri, name,
   * type }` con "Unsupported FormDataPart implementation", y el error sale
   * como fallo de red, no como error de archivo.
   */
  cuerpo.append('foto', new File(uriLocal));

  const result = await request<{ foto: FotoCliente }>(
    `/api/clientes/${clienteId}/fotos?tipo=${tipo}`,
    { method: 'POST', body: cuerpo, timeoutMs: TIMEOUT_SUBIDA_MS, multipart: true },
  );
  return result.foto;
}

export async function eliminarFotoCliente(clienteId: string, tipo: TipoFotoCliente): Promise<void> {
  await request<{ eliminada: TipoFotoCliente }>(`/api/clientes/${clienteId}/fotos/${tipo}`, {
    method: 'DELETE',
  });
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
 *
 * `rutaId` tambien es opcional: se envia cuando el abono se registra desde
 * dentro de una ruta, y es lo que permite despues saber en que visita se cobro.
 */
export async function registrarAbono(
  creditoId: string,
  input: {
    monto: number;
    cuotaId?: string | null;
    rutaId?: string | null;
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

/* --------------------------------- rutas --------------------------------- */

/**
 * Un cliente que se puede cobrar en una fecha. Es una fila por cliente, no por
 * cuota: un cliente que debe tres cuotas aparece una vez y `totalVencido` es la
 * suma de las tres, que es lo que el operador realmente va a cobrar.
 */
export interface ClienteVigente {
  clienteId: string;
  nombre: string;
  apellido: string;
  documento: string;
  direccion: string;
  celular: string;
  creditoId: string;
  saldo: number;
  valorCuota: number;
  totalVencido: number;
  cuotasPendientes: number;
  atrasadas: number;
  vencimientoMasAntiguo: string;
}

export interface VigentesRespuesta {
  fecha: string;
  pendientes: ClienteVigente[];
  resumen: { clientes: number; porCobrar: number; conAtraso: number };
}

export interface Ruta {
  id: string;
  nombre: string;
  operadorId: string;
  fecha: string;
  estado: EstadoRuta;
  abiertaEn: string | null;
  cerradaEn: string | null;
  observaciones: string | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
  operador: { id: string; nombre: string; cedula: string };
}

export interface RutaListada extends Ruta {
  clientes: number;
  cobrado: number;
  abonos: number;
}

export interface ClienteEnRuta {
  orden: number;
  cliente: {
    id: string;
    nombre: string;
    apellido: string;
    documento: string;
    direccion: string;
    celular: string;
  };
  creditoId: string | null;
  saldo: number;
  valorCuota: number;
  cobrado: number;
  abonos: number;
}

export interface RutaDetalle extends Ruta {
  clientes: ClienteEnRuta[];
}

/** Alimenta la pantalla de nueva ruta: a quien se puede cobrar ese dia. */
export async function listVigentes(fecha?: string): Promise<VigentesRespuesta> {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return request<VigentesRespuesta>(`/api/rutas/vigentes${query}`);
}

export async function listRutas(
  filters: { fecha?: string; operadorId?: string } = {},
): Promise<RutaListada[]> {
  const params = new URLSearchParams();
  if (filters.fecha) params.set('fecha', filters.fecha);
  if (filters.operadorId) params.set('operadorId', filters.operadorId);

  const query = params.toString();
  const result = await request<{ rutas: RutaListada[] }>(`/api/rutas${query ? `?${query}` : ''}`);
  return result.rutas;
}

export async function getRuta(id: string): Promise<RutaDetalle> {
  const result = await request<{ ruta: RutaDetalle }>(`/api/rutas/${id}`);
  return result.ruta;
}

export async function createRuta(input: {
  operadorId: string;
  fecha: string;
  clienteIds: string[];
  nombre?: string | null;
  observaciones?: string | null;
}): Promise<Ruta> {
  const result = await request<{ ruta: Ruta }>('/api/rutas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.ruta;
}

export async function cambiarEstadoRuta(id: string, estado: EstadoRuta): Promise<Ruta> {
  const result = await request<{ ruta: Ruta }>(`/api/rutas/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
  return result.ruta;
}

export async function deleteRuta(id: string): Promise<void> {
  await request<{ eliminada: string }>(`/api/rutas/${id}`, { method: 'DELETE' });
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

type RequestInitExt = RequestInit & {
  anonimo?: boolean;
  timeoutMs?: number;
  /**
   * Marca explicita de subida multipart. No se fia de `instanceof FormData`
   * para decidir el `Content-Type`: si esa comprobacion fallara, se mandaria
   * `application/json` sin el limite del archivo y el servidor recibiria la
   * foto vacia. Se declara a mano en la unica llamada que lo necesita.
   */
  multipart?: boolean;
};

/**
 * Sin este tope, un `fetch` que no logra conectar se queda pendiente para
 * siempre: la promesa nunca resuelve, el `finally` de quien la espera nunca
 * corre y los botones quedan en "Cargando…" sin mostrar ningun error.
 */
const TIMEOUT_MS = 20000;

/** Subir una foto por una red movil tarda bastante mas que una peticion normal. */
const TIMEOUT_SUBIDA_MS = 90000;

export const MENSAJE_SIN_CONEXION =
  'No se pudo conectar con el servidor. Revisa que el backend esté corriendo ' +
  'y que el teléfono esté en la misma red que el computador.';

export async function request<T>(
  path: string,
  init: RequestInitExt = {},
  retry = true,
): Promise<T> {
  /**
   * `FormData` lleva su propio `Content-Type` con el limite del archivo
   * adentro. Ponerle `application/json` a mano rompe el parseo del servidor y la
   * foto llega vacia.
   */
  const esFormData =
    init.multipart === true ||
    (init.multipart === undefined && typeof FormData !== 'undefined' && init.body instanceof FormData);

  const headers: Record<string, string> = {
    ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (!init.anonimo && cache?.accessToken) {
    headers.Authorization = `Bearer ${cache.accessToken}`;
  }

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), init.timeoutMs ?? TIMEOUT_MS);

  let response: Response;

  /**
   * Las subidas multipart van por el `fetch` de Expo, no por el global de
   * React Native. El global rechaza un `FormData` con un `File` de Expo y
   * lanza "Unsupported FormDataPart implementation"; el de Expo esta hecho
   * para esto y arma el `multipart/form-data` con su delimitador.
   */
  const enviar = init.multipart ? expoFetch : fetch;

  try {
    response = await enviar(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: control.signal,
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new ApiError(0, 'El servidor no respondió a tiempo.');
    }
    /**
     * Antes se descartaba `cause` y todos los fallos de red se veian igual.
     * Con una subida de archivo eso es un problema: un corte de WiFi, un
     * archivo que React Native no logra leer y un `FormData` mal construido
     * dan el mismo error, y son causas distintas. Se conserva el motivo.
     */
    console.warn('[api] fallo de red en', path, cause);
    const detalle =
      cause instanceof Error && cause.message ? ` (${cause.message})` : '';
    throw new ApiError(0, `${MENSAJE_SIN_CONEXION}${detalle}`);
  } finally {
    clearTimeout(temporizador);
  }

  /**
   * Cuando el access token venció, `refrescar()` lo resuelve sin que la persona
   * se entere. Si el refresh tambien falla, la sesion ya no existe: eso no es un
   * fallo de red ni de datos, y se marca como tal para que la pantalla no lo
   * muestre como un error cualquiera.
   */
  if (response.status === 401 && retry && cache?.refreshToken) {
    const renovado = await refrescar();
    if (renovado) {
      return request<T>(path, init, false);
    }
    throw new ApiError(401, 'Tu sesión terminó. Vuelve a iniciar sesión.', 'sesionCaducada');
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, payload?.error?.message ?? 'Error inesperado');
  }

  return payload as T;
}

/**
 * Refresh en curso, para que varias respuestas 401 simultaneas compartan una
 * sola renovacion.
 *
 * El backend rota el refresh token: al usarlo, el anterior queda revocado. Si
 * dos peticiones fallan con 401 al mismo tiempo y cada una renueva por su cuenta,
 * la segunda llega con un token que la primera ya revoco, el backend responde
 * error, y `clearSession` borra la sesion que la primera acababa de guardar. El
 * usuario ve que lo sacan al login aunque la renovacion haya funcionado.
 */
let refrescoEnCurso: Promise<boolean> | null = null;

async function refrescar(): Promise<boolean> {
  if (refrescoEnCurso) return refrescoEnCurso;

  const tarea = (async () => {
    const refreshToken = cache?.refreshToken;
    if (!refreshToken) return false;

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);

    /**
     * Aqui se distingue el fallo de red del token rechazado:
     *
     * - `null` (o una respuesta sin status) es que no hubo respuesta: se
     *   devuelve `false` SIN borrar la sesion. Antes, un corte de WiFi en
     *   pleno cobro revocaba el refresh token en el servidor y obligaba a
     *   iniciar sesion de nuevo.
     * - 401/403 es que el token ya no sirve (expirado, revocado, cuenta
     *   desactivada): si se guarda, ya no valdra nunca mas.
     */
    if (!response) return false;

    if (response.status === 401 || response.status === 403) {
      // El token no sirve: se pierde la sesion local. Sin `revocar` a proposito,
      // porque rotarlo es una carrera normal entre dos peticiones y no una
      // decision del usuario cerrar sesion.
      await clearSession();
      console.warn('[api] refresh rechazado, se cierra la sesion');
      return false;
    }

    if (!response.ok) return false;

    const session = (await response.json()) as Session;
    await guardar(session);
    return true;
  })();

  refrescoEnCurso = tarea;

  try {
    return await tarea;
  } finally {
    refrescoEnCurso = null;
  }
}
