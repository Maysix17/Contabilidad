import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ApiError, createCliente } from '@/api/client';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface FormState {
  documento: string;
  nombre: string;
  apellido: string;
  celular: string;
  direccion: string;
  alias: string;
  telefono: string;
  direccion2: string;
  ciudad: string;
}

const EMPTY_FORM: FormState = {
  documento: '',
  nombre: '',
  apellido: '',
  celular: '',
  direccion: '',
  alias: '',
  telefono: '',
  direccion2: '',
  ciudad: '',
};

const REQUIRED_FIELDS: (keyof FormState)[] = [
  'documento',
  'nombre',
  'apellido',
  'celular',
  'direccion',
];

export default function CrearClienteScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    for (const field of REQUIRED_FIELDS) {
      if (!form[field].trim()) {
        nextErrors[field] = 'Campo obligatorio';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    setFormError(null);

    if (!validate()) {
      return;
    }

    setSending(true);
    try {
      await createCliente({
        documento: form.documento.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        celular: form.celular.trim(),
        direccion: form.direccion.trim(),
        alias: form.alias.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion2: form.direccion2.trim() || null,
        ciudad: form.ciudad.trim() || null,
      });

      setForm(EMPTY_FORM);
      router.replace('/clientes');
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'No se pudo crear el cliente. Intenta de nuevo.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">Crear Cliente</ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Informacion General
            </ThemedText>

            <FormField
              label="Documento (cedula)"
              value={form.documento}
              onChangeText={(value) => update('documento', value)}
              placeholder="123456789"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.documento}
            />

            <FormField
              label="Nombre"
              value={form.nombre}
              onChangeText={(value) => update('nombre', value)}
              placeholder="Juan"
              error={errors.nombre}
            />

            <FormField
              label="Apellido"
              value={form.apellido}
              onChangeText={(value) => update('apellido', value)}
              placeholder="Perez"
              error={errors.apellido}
            />

            <FormField
              label="Celular"
              value={form.celular}
              onChangeText={(value) => update('celular', value)}
              placeholder="3001234567"
              keyboardType="phone-pad"
              error={errors.celular}
            />

            <FormField
              label="Direccion"
              value={form.direccion}
              onChangeText={(value) => update('direccion', value)}
              placeholder="Calle 10 #20-30"
              error={errors.direccion}
            />

            <ThemedText type="smallBold" themeColor="textSecondary">
              Referencias / Alias
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Opcional
            </ThemedText>

            <FormField
              label="Alias"
              value={form.alias}
              onChangeText={(value) => update('alias', value)}
              placeholder="Tienda Don Juan"
            />

            <FormField
              label="Telefono"
              value={form.telefono}
              onChangeText={(value) => update('telefono', value)}
              placeholder="6041234"
              keyboardType="phone-pad"
            />

            <FormField
              label="Direccion 2"
              value={form.direccion2}
              onChangeText={(value) => update('direccion2', value)}
              placeholder="Apto 401, oficina 202"
            />

            <FormField
              label="Ciudad"
              value={form.ciudad}
              onChangeText={(value) => update('ciudad', value)}
              placeholder="Medellin"
            />

            {formError ? (
              <ThemedText type="small" style={styles.formError}>
                {formError}
              </ThemedText>
            ) : null}

            <ThemedView type="backgroundElement" style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={sending}
                onPress={handleSubmit}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
                <ThemedText type="code">{sending ? 'Guardando...' : 'Guardar cliente'}</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
                <ThemedText type="code">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  actions: {
    marginTop: Spacing.two,
    borderRadius: Spacing.four,
    padding: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  formError: {
    color: '#DC2626',
  },
});
