import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import {
  ApiError,
  desactivarCliente,
  deleteCliente,
  getCliente,
  listCreditos,
  listarFotosCliente,
  subirFotoCliente,
  updateCliente,
  urlFoto,
  type Cliente,
  type Credito,
  type FotoCliente,
  type TipoFotoCliente,
} from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, FilaBoton } from '@/components/button';
import { FormField } from '@/components/form-field';
import { elegirFoto, preguntarFoto, VisorFoto, type OrigenFoto } from '@/components/foto';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, EstadoBadge, FilaDato, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useRefresco } from '@/hooks/use-refresco';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos } from '@/utils/money';

/** Las tres ranuras de foto que existen por cliente, siempre las tres. */
const RANURAS_FOTO: { tipo: TipoFotoCliente; etiqueta: string }[] = [
  { tipo: 'cedula', etiqueta: 'Cédula' },
  { tipo: 'persona', etiqueta: 'Cliente' },
  { tipo: 'direccion', etiqueta: 'Dirección' },
];

export interface FormularioCliente {
  nombre: string;
  apellido: string;
  celular: string;
  direccion: string;
  alias: string;
  telefono: string;
  ciudad: string;
}

/** Copia los campos editables del cliente al formulario. */
function formularioDe(cliente: Cliente): FormularioCliente {
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    celular: cliente.celular,
    direccion: cliente.direccion,
    alias: cliente.alias ?? '',
    telefono: cliente.telefono ?? '',
    ciudad: cliente.ciudad ?? '',
  };
}

export default function ClienteDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { esAdmin } = useSession();
  const theme = useTheme();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [fotos, setFotos] = useState<Record<string, FotoCliente | null>>({});
  /** Foto abierta en pantalla completa; `null` cuando no hay ninguna. */
  const [fotoAbierta, setFotoAbierta] = useState<{ uri: string; etiqueta: string } | null>(null);

  /**
   * El formulario solo existe mientras se edita. Fuera de la edicion, los
   * valores se derivan del cliente, asi que una recarga al volver del foco los
   * actualiza sin necesidad de copiar nada, y nunca pisa lo que se esta
   * escribiendo.
   */
  const [form, setForm] = useState<FormularioCliente | null>(null);
  const editando = form !== null;

  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      const [encontrado, listaCreditos, listaFotos] = await Promise.all([
        getCliente(id),
        listCreditos({ clienteId: id }),
        listarFotosCliente(id),
      ]);
      setCliente(encontrado);
      setCreditos(listaCreditos);
      /**
       * Se indexa por tipo y no se guarda como lista porque la pantalla siempre
       * muestra las tres ranuras, vacias included: asi no hay que preguntar
       * cuantas hay ni quais son.
       */
      setFotos(Object.fromEntries(listaFotos.map((foto) => [foto.tipo, foto])));
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar el cliente');
    } finally {
      setCargando(false);
    }
  }, [id]);

  /**
   * Desde esta pantalla se sale al detalle de un credito a cobrar, y se entra al
   * formulario de credito nuevo. Al volver, los saldos de esa lista de
   * creditos seguian siendo los de antes del cobro y el credito recien creado
   * no aparecia hasta recargar a mano.
   */
  useRefresco(cargar);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function guardar() {
    if (!id || !form || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await updateCliente(id, {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        celular: form.celular.trim(),
        direccion: form.direccion.trim(),
        alias: form.alias.trim() || null,
        telefono: form.telefono.trim() || null,
        ciudad: form.ciudad.trim() || null,
      });
      // Se recarga en lugar de confiar solo en lo que devolvio el
      // update: la vista de arriba muestra direccion2 y otros campos
      // que este formulario no edita, y no deben quedarse viejos.
      await cargar();
      // Al soltar el formulario se vuelve a leer del cliente, que ya
      // viene actualizado desde el servidor.
      setForm(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo actualizar');
    } finally {
      setEnviando(false);
    }
  }

  function confirmarDesactivar() {
    if (!id) return;
    Alert.alert(
      'Desactivar cliente',
      'Deja de recibir creditos y de aparecer en el cobro, pero conserva todo su historial de abonos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: () => {
            void desactivarCliente(id)
              .then(() => cargar())
              .catch((cause) =>
                setError(cause instanceof ApiError ? cause.message : 'No se pudo desactivar'),
              );
          },
        },
      ],
    );
  }

  /**
   * Agregar o reemplazar una foto ya creado el cliente. La que estaba antes se
   * elimina sola en el servidor, asi que aqui no hay que preguntar por ella.
   */
  async function agregarFoto(tipo: TipoFotoCliente, etiqueta: string, origen: OrigenFoto) {
    if (!id) return;
    try {
      const foto = await elegirFoto(origen);
      if (!foto) return;

      const guardada = await subirFotoCliente(id, tipo, foto.uri);
      setFotos((current) => ({ ...current, [tipo]: guardada }));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo subir la foto');
    }
  }

  function confirmarEliminar() {
    if (!id) return;
    Alert.alert(
      'Eliminar cliente',
      'Solo es posible si nunca ha tenido un credito. Si tiene historial, desactivalo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void deleteCliente(id)
              .then(() => router.replace('/clientes'))
              .catch((cause) =>
                setError(cause instanceof ApiError ? cause.message : 'No se pudo eliminar'),
              );
          },
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.contenido}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
            }>
            <ScreenHeader
              titulo={cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente'}
              subtitulo={cliente ? `Doc. ${cliente.documento}` : undefined}
            />

            {cargando ? <ActivityIndicator /> : null}
            {error ? <ErrorBox mensaje={error} /> : null}

            {cliente && !editando ? (
              <>
                <ThemedView type="backgroundElement" style={styles.tarjeta}>
                  <FilaDato etiqueta="Celular" valor={cliente.celular} />
                  <FilaDato etiqueta="Teléfono" valor={cliente.telefono ?? '—'} />
                  <FilaDato etiqueta="Dirección" valor={cliente.direccion} />
                  <FilaDato etiqueta="Dirección 2" valor={cliente.direccion2 ?? '—'} />
                  <FilaDato etiqueta="Ciudad" valor={cliente.ciudad ?? '—'} />
                  <FilaDato etiqueta="Alias" valor={cliente.alias ?? '—'} />
                </ThemedView>

                <ThemedText type="smallBold" themeColor="textSecondary">
                  Fotos
                </ThemedText>

                <View style={styles.rejillaFotos}>
                  {RANURAS_FOTO.map((ranura) => {
                    const foto = fotos[ranura.tipo];
                    return (
                      <ThemedView key={ranura.tipo} type="backgroundElement" style={styles.foto}>
                        {foto ? (
                          <Pressable
                            onPress={() => setFotoAbierta({ uri: urlFoto(foto.uri), etiqueta: ranura.etiqueta })}
                            accessibilityRole="button"
                            accessibilityLabel={`Ver ${ranura.etiqueta} en pantalla completa`}>
                            <Image
                              source={{ uri: urlFoto(foto.uri) }}
                              style={styles.fotoImagen}
                              contentFit="cover"
                              accessibilityIgnoresInvertColors
                              accessibilityLabel={ranura.etiqueta}
                            />
                          </Pressable>
                        ) : (
                          <View style={styles.fotoVacia}>
                            <MaterialCommunityIcons
                              name="image-off-outline"
                              size={24}
                              color={theme.textSecondary}
                            />
                            <ThemedText type="small" themeColor="textSecondary">
                              Sin foto
                            </ThemedText>
                          </View>
                        )}

                        <ThemedText type="smallBold" style={styles.fotoEtiqueta}>
                          {ranura.etiqueta}
                        </ThemedText>

                        <Button
                          title={foto ? 'Cambiar' : 'Tomar'}
                          variant="secundario"
                          onPress={() =>
                            preguntarFoto(ranura.etiqueta, (origen) =>
                              void agregarFoto(ranura.tipo, ranura.etiqueta, origen),
                            )
                          }
                        />
                      </ThemedView>
                    );
                  })}
                </View>

                <FilaBoton>
                  <Button
                    title="Editar"
                    variant="secundario"
                    onPress={() => setForm(formularioDe(cliente))}
                  />
                  <Link href={`/creditos/nuevo?cliente=${cliente.id}`} asChild>
                    <Button title="Nuevo crédito" />
                  </Link>
                </FilaBoton>

                {esAdmin ? (
                  <FilaBoton>
                    {cliente.activo ? (
                      <Button
                        title="Desactivar cliente"
                        variant="peligro"
                        onPress={confirmarDesactivar}
                      />
                    ) : (
                      <Button
                        title="Eliminar cliente"
                        variant="peligro"
                        onPress={confirmarEliminar}
                      />
                    )}
                  </FilaBoton>
                ) : null}

                {!cliente.activo ? (
                  <ErrorBox
                    mensaje="Este cliente esta inactivo: no recibe creditos nuevos ni aparece en el cobro. Su historial sigue guardado."
                  />
                ) : null}

                <ThemedText type="smallBold" style={styles.titulo}>
                  Créditos del cliente
                </ThemedText>

                {creditos.length === 0 ? (
                  <Vacio mensaje="Este cliente no tiene créditos" />
                ) : (
                  creditos.map((credito) => (
                    <Link key={credito.id} href={`/creditos/${credito.id}`} asChild>
                      <ThemedView type="backgroundElement" style={styles.credito}>
                        <View style={styles.creditoEncabezado}>
                          <ThemedText type="smallBold">
                            {formatearPesos(credito.saldo)}
                          </ThemedText>
                          <EstadoBadge estado={credito.estado} />
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          Cuota {formatearPesos(credito.valorCuota)} · vence{' '}
                          {formatearFecha(credito.fechaVencimiento)}
                        </ThemedText>
                      </ThemedView>
                    </Link>
                  ))
                )}
              </>
            ) : null}

            {cliente && editando ? (
              <>
                <FormField
                  label="Nombre"
                  value={form.nombre}
                  onChangeText={(v) => setForm({ ...form, nombre: v })}
                />
                <FormField
                  label="Apellido"
                  value={form.apellido}
                  onChangeText={(v) => setForm({ ...form, apellido: v })}
                />
                <FormField
                  label="Celular"
                  value={form.celular}
                  onChangeText={(v) => setForm({ ...form, celular: v })}
                  keyboardType="phone-pad"
                />
                <FormField
                  label="Dirección"
                  value={form.direccion}
                  onChangeText={(v) => setForm({ ...form, direccion: v })}
                />
                <FormField
                  label="Ciudad"
                  value={form.ciudad}
                  onChangeText={(v) => setForm({ ...form, ciudad: v })}
                />
                <FormField
                  label="Alias"
                  value={form.alias}
                  onChangeText={(v) => setForm({ ...form, alias: v })}
                />
                <FilaBoton>
                  <Button title="Guardar" loading={enviando} onPress={() => void guardar()} />
                  <Button
                    title="Cancelar"
                    variant="secundario"
                    onPress={() => setForm(null)}
                  />
                </FilaBoton>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <VisorFoto
        uri={fotoAbierta?.uri ?? null}
        etiqueta={fotoAbierta?.etiqueta ?? ''}
        onClose={() => setFotoAbierta(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  contenido: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  tarjeta: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  titulo: { marginTop: Spacing.two },
  credito: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: 2,
  },
  creditoEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rejillaFotos: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  foto: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  fotoImagen: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.two,
  },
  fotoVacia: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  fotoEtiqueta: {
    textAlign: 'center',
  },
});
