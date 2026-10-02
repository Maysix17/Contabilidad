import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  desactivarCliente,
  deleteCliente,
  getCliente,
  listCreditos,
  updateCliente,
  type Cliente,
  type Credito,
} from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, FilaBoton } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, EstadoBadge, FilaDato, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useRefresco } from '@/hooks/use-refresco';
import { formatearFecha, formatearPesos } from '@/utils/money';

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

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [creditos, setCreditos] = useState<Credito[]>([]);

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
      const [encontrado, listaCreditos] = await Promise.all([
        getCliente(id),
        listCreditos({ clienteId: id }),
      ]);
      setCliente(encontrado);
      setCreditos(listaCreditos);
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
});
