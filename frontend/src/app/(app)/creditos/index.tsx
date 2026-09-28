import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, listCreditos, type Credito, type EstadoCredito } from '@/api/client';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorBox, EstadoBadge, Vacio } from '@/components/ui-cards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatearFecha, formatearPesos } from '@/utils/money';

const FILTROS: { valor: EstadoCredito | 'todos'; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'activo', texto: 'Activos' },
  { valor: 'finalizado', texto: 'Finalizados' },
  { valor: 'cerrado', texto: 'Cerrados' },
];

export default function CreditosScreen() {
  const theme = useTheme();
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<EstadoCredito | 'todos'>('activo');
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (texto: string, estado: EstadoCredito | 'todos', refrescar = false) => {
      try {
        setCreditos(
          await listCreditos({
            search: texto || undefined,
            estado: estado === 'todos' ? undefined : estado,
          }),
        );
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof ApiError ? cause.message : 'No se pudieron cargar los créditos',
        );
      } finally {
        setCargando(false);
      }

      if (refrescar) setRefrescando(false);
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => void cargar(search, filtro), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [cargar, search, filtro]);

  async function refrescar() {
    setRefrescando(true);
    await cargar(search, filtro, true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          titulo="Créditos"
          subtitulo={`${creditos.length} registros`}
          derecha={
            <Link href="/creditos/nuevo" asChild>
              <Button title="Nuevo" compacto />
            </Link>
          }
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cliente o documento"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.search,
            { backgroundColor: theme.backgroundElement, color: theme.text },
          ]}
        />

        <SelectField
          label="Estado"
          value={filtro}
          options={FILTROS}
          onChange={(valor) => setFiltro(valor as EstadoCredito | 'todos')}
        />

        {error ? <ErrorBox mensaje={error} /> : null}
        {cargando ? <ActivityIndicator /> : null}

        <ScrollView
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => void refrescar()} />
          }>
          {!cargando && creditos.length === 0 ? (
            <Vacio mensaje="No hay créditos con esos filtros" />
          ) : null}

          {creditos.map((credito) => (
            <Link key={credito.id} href={`/creditos/${credito.id}`} asChild>
              <Pressable style={({ pressed }) => [pressed && styles.press]}>
                <ThemedView type="backgroundElement" style={styles.tarjeta}>
                  <View style={styles.tarjetaEncabezado}>
                    <ThemedText type="smallBold">
                      {credito.cliente
                        ? `${credito.cliente.nombre} ${credito.cliente.apellido}`
                        : 'Cliente eliminado'}
                    </ThemedText>
                    <EstadoBadge estado={credito.estado} />
                  </View>

                  <ThemedText type="small" themeColor="textSecondary">
                    {credito.cliente ? `Doc. ${credito.cliente.documento}` : '—'}
                  </ThemedText>

                  <View style={styles.montos}>
                    <View style={styles.monto}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Saldo
                      </ThemedText>
                      <ThemedText type="smallBold">
                        {formatearPesos(credito.saldo)}
                      </ThemedText>
                    </View>
                    <View style={styles.monto}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Cuotas
                      </ThemedText>
                      <ThemedText type="smallBold">
                        {credito.resumen.pagadas}/{credito.resumen.total}
                      </ThemedText>
                    </View>
                    <View style={styles.monto}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Vence
                      </ThemedText>
                      <ThemedText
                        type="smallBold"
                        style={credito.resumen.atrasadas > 0 ? styles.vencido : undefined}>
                        {formatearFecha(credito.fechaVencimiento)}
                      </ThemedText>
                    </View>
                  </View>
                </ThemedView>
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: Spacing.four,
  },
  search: {
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  lista: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  tarjeta: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tarjetaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  montos: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  monto: { gap: 2 },
  vencido: { color: '#DC2626' },
  press: { opacity: 0.8 },
});
