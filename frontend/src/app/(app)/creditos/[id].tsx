import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  anularAbono,
  cerrarCredito,
  deleteCredito,
  getCredito,
  registrarAbono,
  type CreditoDetalle,
  type Cuota,
} from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, FilaBoton } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, EstadoBadge, FilaDato, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos, parsearPesos } from '@/utils/money';

export default function CreditoDetalleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { esAdmin } = useSession();

  const [credito, setCredito] = useState<CreditoDetalle | null>(null);
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
      if (!id) return;
      try {
        setCredito(await getCredito(id));
        setError(null);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar el crédito');
      } finally {
        setCargando(false);
      }

      if (refrescar) setRefrescando(false);
    },
    [id],
  );

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  async function refrescar() {
    setRefrescando(true);
    await cargar(true);
  }

  /** Sin cuota: el backend reparte el monto sobre las cuotas mas antiguas. */
  function abrirAbonoLibre() {
    setCuotaSeleccionada(null);
    setMonto('');
    setReferencia('');
    setErrorAbono(null);
    setModal(true);
  }

  function abrirAbonoCuota(cuota: Cuota) {
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

  async function confirmarAbono() {
    if (!id || enviando) return;
    const valor = parsearPesos(monto);

    if (valor <= 0) {
      setErrorAbono('El monto del abono debe ser mayor que cero');
      return;
    }
    if (cuotaSeleccionada && Math.round((valor - Number(cuotaSeleccionada.monto)) * 100) !== 0) {
      setErrorAbono(`El abono debe ser exactamente ${formatearPesos(cuotaSeleccionada.monto)}`);
      return;
    }
    if (credito && valor > Number(credito.saldo)) {
      setErrorAbono('El abono no puede ser mayor que el saldo pendiente');
      return;
    }

    setEnviando(true);
    setErrorAbono(null);
    try {
      await registrarAbono(id, {
        monto: valor,
        cuotaId: cuotaSeleccionada?.id ?? null,
        fecha,
        referencia: referencia.trim() || null,
      });
      cerrarModal();
      setMonto('');
      setReferencia('');
      await cargar();
    } catch (cause) {
      setErrorAbono(cause instanceof ApiError ? cause.message : 'No se pudo registrar el abono');
    } finally {
      setEnviando(false);
    }
  }

  function confirmarAnulacion(abonoId: string) {
    Alert.alert(
      'Anular abono',
      'Se devolverá el monto al saldo y la cuota volverá a quedar pendiente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular',
          style: 'destructive',
          onPress: () => {
            void anularAbono(abonoId, 'Anulado desde la app')
              .then(() => cargar())
              .catch((cause) =>
                setError(
                  cause instanceof ApiError ? cause.message : 'No se pudo anular el abono',
                ),
              );
          },
        },
      ],
    );
  }

  function confirmarCierre() {
    if (!id) return;
    Alert.alert('Cerrar crédito', 'El crédito quedará bloqueado y no admite más abonos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar',
        style: 'destructive',
        onPress: () => {
          void cerrarCredito(id)
            .then(() => cargar())
            .catch((cause) =>
              setError(cause instanceof ApiError ? cause.message : 'No se pudo cerrar'),
            );
        },
      },
    ]);
  }

  function confirmarEliminar() {
    if (!id) return;
    Alert.alert('Eliminar crédito', 'Se borrará también su historial de abonos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void deleteCredito(id)
            .then(() => router.replace('/creditos'))
            .catch((cause) =>
              setError(cause instanceof ApiError ? cause.message : 'No se pudo eliminar'),
            );
        },
      },
    ]);
  }

  const bloqueado = credito?.estado === 'cerrado';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.contenido}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
          }>
          <ScreenHeader
            titulo="Crédito"
            subtitulo={
              credito?.cliente
                ? `${credito.cliente.nombre} ${credito.cliente.apellido}`
                : undefined
            }
            derecha={
              credito ? <EstadoBadge estado={credito.estado} /> : undefined
            }
          />

          {cargando ? <ActivityIndicator /> : null}
          {error ? <ErrorBox mensaje={error} /> : null}

          {credito ? (
            <>
              <ThemedView type="backgroundElement" style={styles.tarjeta}>
                <FilaDato etiqueta="Valor del crédito" valor={formatearPesos(credito.valorOriginal)} />
                <FilaDato
                  etiqueta="Interés"
                  valor={`${credito.interesPorcentaje}% · ${formatearPesos(credito.interesTotal)}`}
                />
                <FilaDato etiqueta="Total a pagar" valor={formatearPesos(credito.totalPagar)} />
                <FilaDato etiqueta="Saldo pendiente" valor={formatearPesos(credito.saldo)} />
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.tarjeta}>
                <FilaDato etiqueta="Forma de pago" valor={credito.formaPago} />
                <FilaDato
                  etiqueta="Cuota"
                  valor={
                    credito.numeroPeriodos === 1
                      ? formatearPesos(credito.totalPagar)
                      : `${formatearPesos(credito.valorCuota)} x ${credito.numeroPeriodos}`
                  }
                />
                <FilaDato etiqueta="Inicio" valor={formatearFecha(credito.fechaInicio)} />
                <FilaDato
                  etiqueta="Vence"
                  valor={formatearFecha(credito.fechaVencimiento)}
                  color={credito.resumen.atrasadas > 0 ? '#DC2626' : undefined}
                />
                <FilaDato
                  etiqueta="Progreso"
                  valor={`${credito.resumen.pagadas} de ${credito.resumen.total} cuotas`}
                />
                {credito.creador ? (
                  <FilaDato etiqueta="Creado por" valor={credito.creador.nombre} />
                ) : null}
              </ThemedView>

              {credito.resumen.atrasadas > 0 ? (
                <ThemedText type="small" style={styles.vencido}>
                  {credito.resumen.atrasadas}{' '}
                  {credito.resumen.atrasadas === 1 ? 'cuota vencida' : 'cuotas vencidas'}
                </ThemedText>
              ) : null}

              {credito.observaciones ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {credito.observaciones}
                </ThemedText>
              ) : null}

              <ThemedText type="smallBold" style={styles.tituloAbonos}>
                Plan de pagos
              </ThemedText>

              {credito.cuotas.length === 0 ? (
                <Vacio mensaje="Este crédito no tiene cuotas" />
              ) : (
                credito.cuotas.map((cuota) => {
                  const pagada = cuota.estado === 'pagada';
                  const vencida = !pagada && cuota.fechaVencimiento < credito.referencia;
                  return (
                    <ThemedView key={cuota.id} type="backgroundElement" style={styles.cuota}>
                      <View style={styles.abonoEncabezado}>
                        <ThemedText type="smallBold">Cuota {cuota.numero}</ThemedText>
                        <ThemedText
                          type="smallBold"
                          style={vencida ? styles.vencido : undefined}>
                          {formatearPesos(cuota.monto)}
                        </ThemedText>
                      </View>
                      <View style={styles.abonoEncabezado}>
                        <ThemedText
                          type="small"
                          themeColor="textSecondary"
                          style={vencida ? styles.vencido : undefined}>
                          {formatearFecha(cuota.fechaVencimiento)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {pagada
                            ? `Pagada ${cuota.pagadoEn ? formatearFecha(cuota.pagadoEn) : ''}`
                            : vencida
                              ? 'Vencida'
                              : 'Pendiente'}
                        </ThemedText>
                      </View>
                      {!pagada && !bloqueado ? (
                        <Button
                          title="Pagar esta cuota"
                          variant="secundario"
                          onPress={() => abrirAbonoCuota(cuota)}
                        />
                      ) : null}
                    </ThemedView>
                  );
                })
              )}

              {!bloqueado ? (
                <FilaBoton>
                  <Button title="Abono libre" onPress={abrirAbonoLibre} />
                </FilaBoton>
              ) : null}

              {esAdmin ? (
                <FilaBoton>
                  {!bloqueado ? (
                    <Button
                      title="Cerrar crédito"
                      variant="peligro"
                      onPress={confirmarCierre}
                    />
                  ) : null}
                  <Button title="Eliminar" variant="peligro" onPress={confirmarEliminar} />
                </FilaBoton>
              ) : null}

              <ThemedText type="smallBold" style={styles.tituloAbonos}>
                Abonos registrados
              </ThemedText>

              {credito.abonos.length === 0 ? (
                <Vacio mensaje="Aún no hay abonos en este crédito" />
              ) : (
                credito.abonos.map((abono) => (
                  <ThemedView key={abono.id} type="backgroundElement" style={styles.abono}>
                    <View style={styles.abonoEncabezado}>
                      <ThemedText type="smallBold">{formatearPesos(abono.monto)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatearFecha(abono.fecha)}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Saldo {formatearPesos(abono.saldoAnterior)} → {formatearPesos(abono.saldoDespues)}
                    </ThemedText>
                    {abono.referencia ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Ref. {abono.referencia}
                      </ThemedText>
                    ) : null}
                    {abono.registrador ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Por {abono.registrador.nombre}
                      </ThemedText>
                    ) : null}
                    {abono.anuladoEn ? (
                      <ThemedText type="small" style={styles.vencido}>
                        Anulado{abono.motivoAnulacion ? ` · ${abono.motivoAnulacion}` : ''}
                      </ThemedText>
                    ) : esAdmin ? (
                      <Button
                        title="Anular abono"
                        variant="secundario"
                        onPress={() => confirmarAnulacion(abono.id)}
                      />
                    ) : null}
                  </ThemedView>
                ))
              )}
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
          <ThemedView style={[styles.modalCaja, { backgroundColor: theme.background }]}>            <ScrollView contentContainerStyle={styles.modalContenido}>
              <ScreenHeader
                titulo={cuotaSeleccionada ? `Pagar cuota ${cuotaSeleccionada.numero}` : 'Nuevo abono'}
              />

              {cuotaSeleccionada ? (
                <ThemedView type="backgroundElement" style={styles.cuota}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Vence {formatearFecha(cuotaSeleccionada.fechaVencimiento)}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {formatearPesos(cuotaSeleccionada.monto)}
                  </ThemedText>
                </ThemedView>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  El monto se aplicará a las cuotas pendientes más antiguas. Para pagar
                  una cuota exacta usa el botón de su fila en el plan de pagos.
                </ThemedText>
              )}

              <FormField
                label="Monto (pesos)"
                value={monto}
                onChangeText={setMonto}
                placeholder="50000"
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
    gap: Spacing.two,
  },
  abonos: { gap: Spacing.two },
  tituloAbonos: { marginTop: Spacing.two },
  abono: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: 2,
  },
  abonoEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vencido: { color: '#DC2626' },
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
