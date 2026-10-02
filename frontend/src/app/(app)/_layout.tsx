import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useSession } from '@/auth/session';
import { useTheme } from '@/hooks/use-theme';

function Icono({
  nombre,
  color,
}: {
  nombre: keyof typeof MaterialCommunityIcons.glyphMap;
  color: ColorValue;
}) {
  return <MaterialCommunityIcons name={nombre} size={24} color={color} />;
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
          tabBarIcon: ({ color }) => <Icono nombre="home-variant-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="creditos"
        options={{
          title: 'Crédito',
          tabBarIcon: ({ color }) => <Icono nombre="wallet-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Cliente',
          tabBarIcon: ({ color }) => <Icono nombre="account-group-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="abonos"
        options={{
          title: 'Abono',
          tabBarIcon: ({ color }) => <Icono nombre="trending-up" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rutas"
        options={{
          title: 'Rutas',
          tabBarIcon: ({ color }) => <Icono nombre="map-marker-path" color={color} />,
        }}
      />
      {esAdmin ? (
        <Tabs.Screen
          name="usuarios"
          options={{
            title: 'Operadores',
            tabBarIcon: ({ color }) => <Icono nombre="shield-account-outline" color={color} />,
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
      <Tabs.Screen name="usuarios/nuevo" options={{ href: null }} />
      <Tabs.Screen name="rutas/nueva" options={{ href: null }} />
      <Tabs.Screen name="rutas/[id]" options={{ href: null }} />
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
