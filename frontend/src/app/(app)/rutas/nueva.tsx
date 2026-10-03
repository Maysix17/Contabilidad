import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  ApiError,
  createRuta,
  listUsuarios,
  listVigentes,
  type ClienteVigente,
  type Usuario,
  type VigentesRespuesta,
} from '@/api/client';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, SectionHeader, StatCard, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Pastel, Spacing } from '@/constants/theme';
import { useRefresco } from '@/hooks/use-refresco';
import { hoy } from '@/utils/fecha';
import { formatearPesos } from '@/utils/money';
import { calcularMora, tonoMora } from '@/utils/mora';

export default function NuevaRutaScreen() {
  const router = useRouter();

  const [fecha, setFecha] = useState(hoy());
  const [operadores, setOperadores] = useState<Usuario[]>([]);
  const [operadorId, setOperadorId] = useState<string | null>(null);
  const [datos, setDatos] = useState<VigentesRespuesta | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>([]);

  const [cargandoLista, setCargandoLista] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ultima fecha consultada, para distinguir "cambio de dia" de "volvio el foco".
  const fechaCargada = useRef<string | null>(null);

  const cargarOperadores = useCallback(async () => {
    try {
      const lista = await listUsuarios();
      const activos = lista.filter((item) => item.activo);
      setOperadores(activos);
      setOperadorId((actual) => actual ?? activos[0]?.id ?? null);
    } catch {
      // La lista de operadores no es critica para armar la ruta: si falla, se
      // avisa al guardar. El error real se muestra en el campo de error.
    }
  }, []);

  const cargarVigentes = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;

    setCargandoLista(true);

    // Cambiar de dia invalida lo que el admin habia marcado: esos clientes no
    // son los de la fecha nueva. Volver al foco, en cambio, solo poda lo que ya
    // se pago o dejo de ser cobrable.
    const cambioDeDia = fechaCargada.current !== null && fechaCargada.current !== fecha;
    fechaCargada.current = fecha;

    try {
      const resultado = await listVigentes(fecha);
      setDatos(resultado);
      setError(null);

      // Aunque la fecha no haya cambiado, la cartera pudo bajar mientras el
      // admin estaba cobrando. Lo que ya se pago no puede seguir marcado, ni
      // tampoco quedar marcado para un cliente que ya no esta en la lista.
      setSeleccion((actual) => {
        if (cambioDeDia) return [];
        const vigentes = new Set(resultado.pendientes.map((fila) => fila.clienteId));
        return actual.filter((id) => vigentes.has(id));
      });
    } catch (cause) {
      setDatos(null);
      setError(
        cause instanceof ApiError ? cause.message : 'No se pudo cargar la cartera del día',
      );
    } finally {
      setCargandoLista(false);
    }
  }, [fecha]);

  /**
   * Expo Router no desmonta la pantalla al salir de ella, la deja viva. Por eso
   * cargar solo en el montaje congela la cartera: el admin cobra, regresa, y los
   * clientes que ya pago siguen en la lista como si debieran. Recargar al
   * recuperar el foco es lo que hace que la pantalla refleje lo que se acaba de
   * cobrar.
   */
  useRefresco(cargarVigentes, 300);

  // La lista de operadores tambien puede quedar vieja si se creo o desactivo
  // alguien desde la pestana de usuarios mientras esta pantalla sigue viva.
  useRefresco(cargarOperadores);

  const pendientes = useMemo(() => datos?.pendientes ?? [], [datos]);

  const totalSeleccionado = useMemo(
    () =>
      pendientes
        .filter((fila) => seleccion.includes(fila.clienteId))
        .reduce((suma, fila) => suma + fila.totalVencido, 0),
    [pendientes, seleccion],
  );

  const todosSel = pendientes.length > 0 && seleccion.length === pendientes.length;

  function alternar(clienteId: string) {
    setSeleccion((actual) =>
      actual.includes(clienteId)
        ? actual.filter((id) => id !== clienteId)
        : [...actual, clienteId],
    );
  }

  async function guardar() {
    if (enviando) return;
    setError(null);

    if (!operadorId) {
      setError('Selecciona el operador que hará la ruta');
      return;
    }
    if (seleccion.length === 0) {
      setError('Selecciona al menos un cliente para la ruta');
      return;
    }

    setEnviando(true);
    try {
      const ruta = await createRuta({
        operadorId,
        fecha,
        clienteIds: seleccion,
      });
      router.replace({ pathname: '/rutas/[id]', params: { id: ruta.id } });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo crear la ruta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
            <ScreenHeader
              titulo="Nueva ruta"
              subtitulo="Elige a quién se le cobra y qué clientes visita"
            />

            <FormField
              label="Fecha de la ruta (AAAA-MM-DD)"
              value={fecha}
              onChangeText={setFecha}
              placeholder="2026-09-29"
              autoCapitalize="none"
            />

            <SelectField
              label="Operador"
              value={operadorId ?? ''}
              options={operadores.map((item) => ({
                valor: item.id,
                texto: item.rol === 'administrador' ? `${item.nombre} (admin)` : item.nombre,
              }))}
              onChange={setOperadorId}
            />

            {cargandoLista ? <ActivityIndicator /> : null}

            {pendientes.length > 0 ? (
              <View style={styles.resumen}>
                <StatCard
                  titulo="Por cobrar"
                  valor={formatearPesos(datos?.resumen.porCobrar ?? 0)}
                  detalle={`${pendientes.length} ${
                    pendientes.length === 1 ? 'cliente' : 'clientes'
                  } en total`}
                  icono="wallet-outline"
                  tono="azul"
                />
                <StatCard
                  titulo="Con atraso"
                  valor={String(datos?.resumen.conAtraso ?? 0)}
                  detalle="tienen cuotas vencidas"
                  icono="alert-circle-outline"
                  tono={datos?.resumen.conAtraso ? 'rojo' : 'neutro'}
                />
              </View>
            ) : null}

            {pendientes.length > 0 ? (
              <>
                <View style={styles.encabezadoLista}>
                  <SectionHeader
                    titulo="Cartera del día"
                    icono="account-group-outline"
                  />
                  <Pressable
                    onPress={() =>
                      setSeleccion(
                        todosSel
                          ? []
                          : pendientes.map((fila) => fila.clienteId),
                      )
                    }
                    style={({ pressed }) => [
                      styles.seleccionarTodos,
                      { backgroundColor: Pastel.azul.superficie },
                      pressed && styles.press,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: Pastel.azul.texto }}>
                      {todosSel ? 'Quitar todos' : 'Seleccionar todos'}
                    </ThemedText>
                  </Pressable>
                </View>

                {pendientes.map((fila) => (
                  <FilaCandidato
                    key={fila.clienteId}
                    fila={fila}
                    marcado={seleccion.includes(fila.clienteId)}
                    onPress={() => alternar(fila.clienteId)}
                  />
                ))}
              </>
            ) : null}

            {!cargandoLista && pendientes.length === 0 ? (
              <Tarjeta>
                <Vacio
                  mensaje={
                    error
                      ? error
                      : 'No hay nada por cobrar en esa fecha. Todos los clientes ya pagaron.'
                  }
                />
              </Tarjeta>
            ) : null}

            {seleccion.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {seleccion.length}{' '}
                {seleccion.length === 1 ? 'cliente seleccionado' : 'clientes seleccionados'} por{' '}
                {formatearPesos(totalSeleccionado)}
              </ThemedText>
            ) : null}

            {error && !cargandoLista ? <ErrorBox mensaje={error} /> : null}

            <Button
              title="Crear ruta"
              loading={enviando}
              onPress={() => void guardar()}
            />
            <Button
              title="Cancelar"
              variant="secundario"
              onPress={() => router.back()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  return <ThemedView type="backgroundElement" style={styles.tarjetaVacia}>{children}</ThemedView>;
}

function FilaCandidato({
  fila,
  marcado,
  onPress,
}: {
  fila: ClienteVigente;
  marcado: boolean;
  onPress: () => void;
}) {
  // El fondo de esta fila lo usa el estado de seleccion, asi que el nivel de
  // mora se aplica solo a la etiqueta, para que marcar un cliente no borre la
  // senal de quantos dias lleva de atraso.
  const mora = calcularMora(fila.vencimientoMasAntiguo);
  const tono = mora ? tonoMora(mora) : Pastel.neutro;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.candidato,
        {
          backgroundColor: marcado ? Pastel.azul.superficie : Pastel.neutro.superficie,
          borderColor: marcado ? Pastel.azul.solido : 'transparent',
          borderWidth: 1,
        },
        pressed && styles.press,
      ]}>
      <MaterialCommunityIcons
        name={marcado ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={22}
        color={marcado ? Pastel.azul.texto : '#9A9AA2'}
      />

      <View style={styles.candidatoTexto}>
        <ThemedText type="smallBold">
          {fila.nombre} {fila.apellido}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Doc. {fila.documento} · {fila.direccion}
        </ThemedText>
        {mora ? (
          <View style={[styles.mora, { backgroundColor: tono.superficie }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={12} color={tono.texto} />
            <ThemedText type="small" style={{ color: tono.texto }}>
              {mora.etiqueta} · {fila.atrasadas}{' '}
              {fila.atrasadas === 1 ? 'cuota' : 'cuotas'}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.candidatoValor}>
        <ThemedText type="smallBold" style={marcado ? { color: Pastel.azul.texto } : undefined}>
          {formatearPesos(fila.totalVencido)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {fila.cuotasPendientes} {fila.cuotasPendientes === 1 ? 'cuota' : 'cuotas'}
        </ThemedText>
      </View>
    </Pressable>
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
  resumen: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  encabezadoLista: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  seleccionarTodos: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Spacing.two,
  },
  candidato: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  candidatoTexto: { flex: 1, gap: 2 },
  candidatoValor: { alignItems: 'flex-end', gap: 2 },
  mora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.one,
    marginTop: 2,
  },
  tarjetaVacia: {
    borderRadius: Spacing.three,
  },
  press: { opacity: 0.85 },
});
