import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  getCredito,
  listClientes,
  listCreditos,
  registrarAbono,
  type Cliente,
  type Cuota,
  type Credito,
} from '@/api/client';
import { Button, FilaBoton } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, EstadoBadge, FilaDato, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos, parsearPesos } from '@/utils/money';

export default function AbonoClienteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { clienteId } = useLocalSearchParams<{ clienteId: string }>();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [credito, setCredito] = useState<Credito | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState<Cuota | null>(null);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorAbono, setErrorAbono] = useState<string | null>(null);

  const cargar = useCallback(
    async (refrescar = false) => {
      if (!clienteId) return;
      try {
        const [listaClientes, creditos] = await Promise.all([
          listClientes(),
          listCreditos({ clienteId }),
        ]);

        setCliente(listaClientes.find((item) => item.id === clienteId) ?? null);
        setCredito(creditos.find((item) => item.estado === 'activo') ?? creditos[0] ?? null);
        setError(null);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar el cliente');
      } finally {
        setCargando(false);
      }

      if (refrescar) setRefrescando(false);
    },
    [clienteId],
  );

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  async function refrescar() {
    setRefrescando(true);
    await cargar(true);
  }

  /** Recibe el pago de una cuota y deja la pantalla lista para el siguiente cobro. */
  async function confirmarAbono() {
    if (!credito || enviando) return;
    const valor = parsearPesos(monto);

    if (valor <= 0) {
      setErrorAbono('El monto del abono debe ser mayor que cero');
      return;
    }
    if (valor > Number(credito.saldo)) {
      setErrorAbono('El abono no puede ser mayor que el saldo pendiente');
      return;
    }
    if (
      cuotaSeleccionada &&
      Math.round((valor - Number(cuotaSeleccionada.monto)) * 100) !== 0
    ) {
      setErrorAbono(`El abono debe ser exactamente ${formatearPesos(cuotaSeleccionada.monto)}`);
      return;
    }

    setEnviando(true);
    setErrorAbono(null);
    try {
      await registrarAbono(credito.id, {
        monto: valor,
        cuotaId: cuotaSeleccionada?.id ?? null,
        fecha,
        referencia: referencia.trim() || null,
      });

      // Refleja el pago sin esperar el viaje completo de vuelta.
      const actualizado = await getCredito(credito.id);
      setCredito(actualizado);
      setModal(false);
      setCuotaSeleccionada(null);
      setMonto('');
      setReferencia('');
      setErrorAbono(null);
    } catch (cause) {
      setErrorAbono(cause instanceof ApiError ? cause.message : 'No se pudo registrar el abono');
    } finally {
      setEnviando(false);
    }
  }

  function abrirCuota(cuota: Cuota) {
    setCuotaSeleccionada(cuota);
    setMonto(String(cuota.monto));
    setReferencia('');
    setErrorAbono(null);
    setModal(true);
  }

  function cerrarModal() {
    setModal(false);
    setCuotaSeleccionada(null);
    setErrorAbono(null);
  }

  const bloqueado = credito?.estado === 'cerrado';
  const pendientes = credito?.cuotas.filter((cuota) => cuota.estado === 'pendiente') ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.contenido}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
          }>
          <ScreenHeader
            titulo="Abono"
            subtitulo={
              cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cargando cliente'
            }
            derecha={credito ? <EstadoBadge estado={credito.estado} /> : undefined}
          />

          {cargando ? <ActivityIndicator /> : null}
          {error ? <ErrorBox mensaje={error} /> : null}

          {cliente ? (
            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <FilaDato etiqueta="Documento" valor={cliente.documento} />
              <FilaDato etiqueta="Celular" valor={cliente.celular} />
              <FilaDato
                etiqueta="Dirección"
                valor={cliente.alias || cliente.direccion}
              />
            </ThemedView>
          ) : null}

          {!cargando && !credito ? (
            <>
              <Vacio mensaje="Este cliente no tiene créditos" />
              <FilaBoton>
                <Button
                  title="Crear crédito"
                  onPress={() => router.push(`/creditos/nuevo?cliente=${clienteId}`)}
                />
              </FilaBoton>
            </>
          ) : null}

          {credito ? (
            <>
              <ThemedView type="backgroundElement" style={styles.tarjeta}>
                <FilaDato etiqueta="Total a pagar" valor={formatearPesos(credito.totalPagar)} />
                <FilaDato etiqueta="Saldo pendiente" valor={formatearPesos(credito.saldo)} />
                <FilaDato
                  etiqueta="Valor de la cuota"
                  valor={formatearPesos(credito.valorCuota)}
                />
                <FilaDato
                  etiqueta="Progreso"
                  valor={`${credito.resumen.pagadas} de ${credito.resumen.total} cuotas`}
                />
                {credito.resumen.atrasadas > 0 ? (
                  <FilaDato
                    etiqueta="Cuotas vencidas"
                    valor={String(credito.resumen.atrasadas)}
                    color="#DC2626"
                  />
                ) : null}
              </ThemedView>

              {bloqueado ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Este crédito está cerrado y no admite abonos.
                </ThemedText>
              ) : null}

              <ThemedText type="smallBold">
                Cuotas por pagar ({pendientes.length})
              </ThemedText>

              {pendientes.length === 0 ? (
                <Vacio mensaje="No hay cuotas pendientes" />
              ) : (
                pendientes.map((cuota) => {
                  const vencida = cuota.fechaVencimiento < credito.referencia;
                  return (
                    <Pressable
                      key={cuota.id}
                      disabled={bloqueado}
                      onPress={() => abrirCuota(cuota)}
                      style={({ pressed }) => [
                        styles.cuota,
                        pressed && styles.press,
                      ]}>
                      <View style={styles.cuotaEncabezado}>
                        <ThemedText type="smallBold">Cuota {cuota.numero}</ThemedText>
                        <ThemedText
                          type="smallBold"
                          style={vencida ? styles.vencido : undefined}>
                          {formatearPesos(cuota.monto)}
                        </ThemedText>
                      </View>
                      <View style={styles.cuotaEncabezado}>
                        <ThemedText
                          type="small"
                          themeColor="textSecondary"
                          style={vencida ? styles.vencido : undefined}>
                          {formatearFecha(cuota.fechaVencimiento)}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{ color: vencida ? '#DC2626' : theme.tint }}>
                          {bloqueado ? 'Cerrado' : vencida ? 'Vencida · pagar' : 'Pagar'}                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })
              )}

              {!bloqueado ? (
                <FilaBoton>
                  <Button
                    title="Ver crédito completo"
                    variant="secundario"
                    onPress={() => router.push(`/creditos/${credito.id}`)}
                  />
                </FilaBoton>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={modal}
        animationType="slide"
        transparent
        onRequestClose={cerrarModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalFondo}>
          <ThemedView style={[styles.modalCaja, { backgroundColor: theme.background }]}>
            <ScrollView contentContainerStyle={styles.modalContenido}>
              <ScreenHeader
                titulo={cuotaSeleccionada ? `Cuota ${cuotaSeleccionada.numero}` : 'Abono'}
              />

              <FormField
                label="Monto (pesos)"
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
              />
              <FormField
                label="Fecha (AAAA-MM-DD)"
                value={fecha}
                onChangeText={setFecha}
                autoCapitalize="none"
              />
              <FormField
                label="Referencia"
                value={referencia}
                onChangeText={setReferencia}
                placeholder="Opcional"
              />

              {errorAbono ? <ErrorBox mensaje={errorAbono} /> : null}

              <Button title="Registrar" loading={enviando} onPress={() => void confirmarAbono()} />
              <Button title="Cancelar" variant="secundario" onPress={cerrarModal} />
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  cuota: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
  },
  cuotaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  vencido: { color: '#DC2626' },
  press: { opacity: 0.8 },
  modalFondo: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'flex-end',
  },
  modalCaja: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '85%',
  },
  modalContenido: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
