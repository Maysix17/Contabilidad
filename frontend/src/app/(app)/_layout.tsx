import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View, type ColorValue } from 'react-native';

import { useSession } from '@/auth/session';
import { useTheme } from '@/hooks/use-theme';

function Icono({ children, color }: { children: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{children}</Text>;
}

export default function AppLayout() {
  const theme = useTheme();
  const { user, cargando, esAdmin } = useSession();

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.backgroundSelected,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Icono color={color}>◎</Icono>,
        }}
      />
      <Tabs.Screen
        name="creditos"
        options={{
          title: 'Crédito',
          tabBarIcon: ({ color }) => <Icono color={color}>＄</Icono>,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Cliente',
          tabBarIcon: ({ color }) => <Icono color={color}>☺</Icono>,
        }}
      />
      <Tabs.Screen
        name="abonos"
        options={{
          title: 'Abono',
          tabBarIcon: ({ color }) => <Icono color={color}>✓</Icono>,
        }}
      />
      {esAdmin ? (
        <Tabs.Screen
          name="usuarios"
          options={{
            title: 'Operadores',
            tabBarIcon: ({ color }) => <Icono color={color}>⚙</Icono>,
          }}
        />
      ) : (
        <Tabs.Screen name="usuarios" options={{ href: null }} />
      )}

      {/*
        Expo Router crea una pantalla por cada archivo del directorio, y
        `<Tabs.Screen>` solo les asigna opciones: no las oculta. Por eso hay que
        declarar con `href: null` todas las rutas que no son pestañas, o se
        acumulan en la barra.
      */}
      <Tabs.Screen name="perfil" options={{ href: null }} />
      <Tabs.Screen name="creditos/nuevo" options={{ href: null }} />
      <Tabs.Screen name="creditos/[id]" options={{ href: null }} />
      <Tabs.Screen name="clientes/nuevo" options={{ href: null }} />
      <Tabs.Screen name="clientes/[id]" options={{ href: null }} />
      <Tabs.Screen name="abonos/[clienteId]" options={{ href: null }} />
      <Tabs.Screen name="usuarios/nuevo" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
