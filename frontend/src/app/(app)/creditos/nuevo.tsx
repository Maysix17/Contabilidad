import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  createCredito,
  listClientesDisponiblesParaCredito,
  simularCredito,
  type Cliente,
  type PeriodoPago,
  type PlanCreditoSimulado,
} from '@/api/client';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos, parsearPesos } from '@/utils/money';

const PERIODOS: { valor: PeriodoPago; texto: string }[] = [
  { valor: 'diario', texto: 'Diario' },
  { valor: 'semanal', texto: 'Semanal' },
  { valor: 'quincenal', texto: 'Quincenal' },
  { valor: 'mensual', texto: 'Mensual' },
];

/** El domingo no se cobra: el backend adelanta esas cuotas al sabado. */
const DIAS_PAGO = [
  { valor: '1', texto: 'Lunes' },
  { valor: '2', texto: 'Martes' },
  { valor: '3', texto: 'Miercoles' },
  { valor: '4', texto: 'Jueves' },
  { valor: '5', texto: 'Viernes' },
  { valor: '6', texto: 'Sabado' },
  { valor: '7', texto: 'Domingo (cobra sabado)' },
];

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function FilaResumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.filaResumen}>
      <ThemedText type="small" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>
      <ThemedText type="smallBold">{valor}</ThemedText>
    </View>
  );
}

export default function NuevoCreditoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { cliente: clienteParam } = useLocalSearchParams<{ cliente?: string }>();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [errorClientes, setErrorClientes] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(clienteParam ?? null);
  const [valor, setValor] = useState('');
  const [formaPago, setFormaPago] = useState<PeriodoPago>('mensual');
  const [interes, setInteres] = useState('');
  const [numeroPeriodos, setNumeroPeriodos] = useState('1');
  const [diaPago, setDiaPago] = useState('1');
  const [fechaInicio, setFechaInicio] = useState(hoy());
  const [observaciones, setObservaciones] = useState('');

  const [planResultado, setPlanResultado] = useState<{
    plan: PlanCreditoSimulado;
    clave: string;
  } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void listClientesDisponiblesParaCredito(busqueda || undefined)
        .then((lista) => {
          setClientes(lista);
          setErrorClientes(null);
        })
        .catch((cause) => {
          setClientes([]);
          setErrorClientes(
            cause instanceof ApiError ? cause.message : 'No se pudieron cargar los clientes',
          );
        });
    }, busqueda ? 400 : 0);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const sugeridos = useMemo(() => {
    const visibles = clientes.slice(0, 5);
    const elegido = clientes.find((item) => item.id === clienteId);
    if (!elegido || visibles.some((item) => item.id === elegido.id)) {
      return visibles;
    }
    return [elegido, ...visibles];
  }, [clientes, clienteId]);

  const monto = parsearPesos(valor);
  const porcentaje = interes ? parsearPesos(interes) : 0;
  const periodos = Math.max(1, parsearPesos(numeroPeriodos) || 1);
  const esSemanal = formaPago === 'semanal';

  /**
   * El plan lo calcula el backend para que la vista previa use exactamente el
   * mismo motor que al guardar (interes fijo, reparto con ajuste de redondeo y
   * adelanto de los vencimientos que caen en domingo).
   */
  const clave = `${monto}|${porcentaje}|${formaPago}|${periodos}|${fechaInicio}|${diaPago}`;
  const plan = planResultado?.clave === clave ? planResultado.plan : null;

  useEffect(() => {
    const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio);
    if (monto <= 0 || !fechaValida) return;

    let vigente = true;
    const timer = setTimeout(() => {
      void simularCredito({
        valorOriginal: monto,
        interesPorcentaje: porcentaje,
        formaPago,
        numeroPeriodos: periodos,
        fechaInicio,
        diaPago: esSemanal ? Number(diaPago) : null,
      })
        .then((resultado) => {
          if (vigente) setPlanResultado({ plan: resultado, clave });
        })
        .catch(() => {
          if (vigente) setPlanResultado(null);
        });
    }, 350);

    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [monto, porcentaje, formaPago, periodos, fechaInicio, diaPago, esSemanal, clave]);

  async function guardar() {
    if (enviando) return;
    setError(null);

    if (!clienteId) {
      setError('Selecciona un cliente');
      return;
    }
    if (monto <= 0) {
      setError('El valor del crédito debe ser mayor que cero');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
      setError('La fecha de inicio debe tener formato AAAA-MM-DD');
      return;
    }

    setEnviando(true);
    try {
      const credito = await createCredito({
        clienteId,
        valorOriginal: monto,
        interesPorcentaje: porcentaje,
        formaPago,
        numeroPeriodos: periodos,
        fechaInicio,
        diaPago: esSemanal ? Number(diaPago) : null,
        observaciones: observaciones.trim() || null,
      });
      router.replace(`/creditos/${credito.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo crear el crédito');
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
            <ScreenHeader titulo="Nuevo crédito" />

            <ThemedText type="smallBold">Cliente</ThemedText>
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar cliente"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
            />
            <View style={styles.listaClientes}>
              {errorClientes ? <ErrorBox mensaje={errorClientes} /> : null}

              {sugeridos.map((item) => {
                const activo = item.id === clienteId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setClienteId(item.id)}
                    style={[
                      styles.cliente,
                      {
                        backgroundColor: activo ? theme.tint : theme.backgroundElement,
                      },
                    ]}>
                    <ThemedText type="smallBold" style={activo ? styles.blanco : undefined}>
                      {item.nombre} {item.apellido}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={activo ? styles.blanco : undefined}>
                      Doc. {item.documento}
                    </ThemedText>
                  </Pressable>
                );
              })}
              {clientes.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {errorClientes
                    ? 'No se pudo consultar la lista de clientes.'
                    : 'No se encontraron clientes disponibles para crédito'}
                </ThemedText>
              ) : null}
            </View>

            <FormField
              label="Valor del crédito (pesos)"
              value={valor}
              onChangeText={setValor}
              placeholder="500000"
              keyboardType="numeric"
            />

            {plan ? (
              <ThemedView type="backgroundElement" style={styles.preview}>
                <ThemedText type="smallBold">Resumen del crédito</ThemedText>

                <FilaResumen etiqueta="Interés" valor={formatearPesos(plan.interesTotal)} />
                <FilaResumen etiqueta="Total a pagar" valor={formatearPesos(plan.totalPagar)} />
                <FilaResumen
                  etiqueta="Valor de la cuota"
                  valor={
                    plan.numeroPeriodos === 1
                      ? formatearPesos(plan.totalPagar)
                      : `${formatearPesos(plan.valorCuota)} x ${plan.numeroPeriodos}`
                  }
                />
                <FilaResumen
                  etiqueta="Vence"
                  valor={formatearFecha(plan.fechaVencimiento)}
                />
              </ThemedView>
            ) : null}

            <SelectField
              label="Forma de pago"
              value={formaPago}
              options={PERIODOS}
              onChange={(v) => setFormaPago(v as PeriodoPago)}
            />

            <FormField
              label="Número de periodos"
              value={numeroPeriodos}
              onChangeText={setNumeroPeriodos}
              placeholder="1"
              keyboardType="numeric"
            />

            {esSemanal ? (
              <SelectField
                label="Día de cobro"
                value={diaPago}
                options={DIAS_PAGO}
                onChange={(v) => setDiaPago(v)}
              />
            ) : null}

            <FormField
              label="Interés (%)"
              value={interes}
              onChangeText={setInteres}
              placeholder="0"
              keyboardType="decimal-pad"
            />
            <ThemedText type="small" themeColor="textSecondary">
              {porcentaje > 0
                ? `Sobre ${formatearPesos(monto)} el interés es ${formatearPesos(
                    Math.round(monto * (porcentaje / 100)),
                  )}.`
                : 'Sin interés.'}
            </ThemedText>

            <FormField
              label="Fecha de inicio (AAAA-MM-DD)"
              value={fechaInicio}
              onChangeText={setFechaInicio}
              placeholder="2026-01-15"
              autoCapitalize="none"
            />

            <FormField
              label="Observaciones"
              value={observaciones}
              onChangeText={setObservaciones}
              placeholder="Opcional"
              multiline
            />

            {error ? <ErrorBox mensaje={error} /> : null}

            <Button
              title="Guardar crédito"
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
  input: {
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  listaClientes: { gap: Spacing.two },
  cliente: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: 2,
  },
  blanco: { color: '#fff' },
  filaResumen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#8888',
  },
});
