import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OrigenFoto = 'camara' | 'galeria';

export interface FotoTomada {
  uri: string;
  origen: OrigenFoto;
}

/**
 * Aplica a la foto antes de mandarla al servidor. `quality` recodifica el JPEG
 * en el telefono, que es donde se recupera casi todo el peso: una foto de
 * camara de 12 MP baja a menos de 1 MB sin que se note al verla en pantalla.
 */
const CALIDAD = 0.5;

/**
 * Abre la camara o la galeria y devuelve la foto elegida, o `null` si el
 * usuario cancela o no tiene permiso.
 *
 * Falla en silencio ante un permiso denegado a proposito: cancelar no es un
 * error que merezca un aviso rojo en medio de un formulario.
 */
export async function elegirFoto(origen: OrigenFoto): Promise<FotoTomada | null> {
  const esCamara = origen === 'camara';

  if (esCamara) {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        'Sin permiso de cámara',
        'Activa el permiso de la cámara en los ajustes del teléfono para tomar fotos.',
      );
      return null;
    }
  } else {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        'Sin permiso de fotos',
        'Activa el permiso de fotos en los ajustes del teléfono para elegirlas.',
      );
      return null;
    }
  }

  const opciones: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: CALIDAD,
    // Sin esto se sube el archivo original sin recortar, que es justo lo que
    // se quiere evitar al comprimir.
    allowsEditing: false,
    cameraType: esCamara ? ImagePicker.CameraType.back : undefined,
  };

  const resultado = esCamara
    ? await ImagePicker.launchCameraAsync(opciones)
    : await ImagePicker.launchImageLibraryAsync(opciones);

  if (resultado.canceled) return null;

  const asset = resultado.assets[0];
  if (!asset) return null;

  /**
   * React Native solo puede adjuntar a un `FormData` archivos locales que su
   * capa de red sepa leer. Si la plataforma devuelve otro tipo de URI
   * (`content://` en Android, `ph://` en iOS con la fototeca), la subida falla
   * como error de red y no como error de foto. Se registra para poder
   * distinguirlo.
   */
  console.log(
    `[fotos] capturada desde ${origen}:`,
    JSON.stringify({
      uri: asset.uri,
      tipo: asset.type,
      mime: asset.mimeType,
      bytes: asset.fileSize,
      ancho: asset.width,
      alto: asset.height,
    }),
  );

  return { uri: asset.uri, origen };
}

/**
 * Pregunta de dónde sacar la foto y ejecuta lo que elija el usuario. Permite
 * elegir siempre entre camara y galeria: tomar una foto nueva no siempre es lo
 * que se quiere, por ejemplo cuando hay que corregir una foto ya existente.
 */
export function preguntarFoto(
  etiqueta: string,
  alElegir: (origen: OrigenFoto) => void,
  onQuitar?: () => void,
) {
  const opciones: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
    { text: 'Tomar foto', onPress: () => alElegir('camara') },
    { text: 'Elegir de la galería', onPress: () => alElegir('galeria') },
  ];

  // Solo aparece cuando hay algo que quitar.
  if (onQuitar) {
    opciones.push({ text: 'Quitar foto', style: 'destructive', onPress: onQuitar });
  }

  opciones.push({ text: 'Cancelar', style: 'cancel' });

  Alert.alert(etiqueta, 'Elige de dónde tomar la foto.', opciones);
}

/**
 * Icono de camara para poner al final de un campo de texto.
 *
 * Cuando ya hay foto, se muestra la miniatura: asi se ve que quedo guardada
 * sin salir del formulario, y basta un toque para abrir la camara de nuevo.
 */
export function BotonFoto({
  uri,
  onChange,
  etiqueta,
  compacto = false,
}: {
  /** `null` cuando todavia no hay foto tomada. */
  uri: string | null;
  onChange: (foto: FotoTomada | null) => void;
  etiqueta: string;
  compacto?: boolean;
}) {
  const theme = useTheme();
  const [ocupado, setOcupado] = useState(false);

  async function tomar(origen: OrigenFoto) {
    setOcupado(true);
    try {
      const foto = await elegirFoto(origen);
      if (foto) onChange(foto);
    } finally {
      setOcupado(false);
    }
  }

  function preguntar() {
    preguntarFoto(etiqueta, (origen) => void tomar(origen), uri ? () => onChange(null) : undefined);
  }

  if (compacto) {
    return (
      <Pressable
        onPress={preguntar}
        disabled={ocupado}
        accessibilityLabel={uri ? `Cambiar foto de ${etiqueta}` : `Tomar foto de ${etiqueta}`}
        // Un area tactil de 44 px es el minimo comodo en movil; el icono mide
        // menos, asi que sin esto seria dificil de acertar con el dedo.
        hitSlop={10}>
        {ocupado ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : uri ? (
          <Image
            source={{ uri }}
            style={styles.miniaturaMini}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <MaterialCommunityIcons name="camera-outline" size={22} color={theme.textSecondary} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={preguntar}
      disabled={ocupado}
      accessibilityLabel={uri ? `Cambiar foto de ${etiqueta}` : `Tomar foto de ${etiqueta}`}
      style={({ pressed }) => [styles.boton, pressed && styles.press]}>
      {ocupado ? (
        <ActivityIndicator size="small" color={theme.textSecondary} />
      ) : uri ? (
        <Image
          source={{ uri }}
          style={styles.miniatura}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <MaterialCommunityIcons name="camera-outline" size={26} color={theme.textSecondary} />
      )}

      <ThemedText type="small" themeColor="textSecondary" style={styles.textoBoton}>
        {uri ? 'Cambiar foto' : 'Tomar foto'}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Ranura de foto con su miniatura al lado. Se usa en las secciones de cedula y
 * de direccion del formulario de cliente, donde ademas hay un icono de camara
 * pegado al campo de texto.
 *
 * Con foto puesta, la miniatura abre el visor y cambiar la foto queda en un
 * boton aparte. Si no, la miniatura abre directamente el menu de camara.
 */
export function EspacioFoto({
  uri,
  onChange,
  etiqueta,
  descripcion,
  onVer,
}: {
  uri: string | null;
  onChange: (foto: FotoTomada | null) => void;
  etiqueta: string;
  descripcion: string;
  /** Abre la foto en pantalla completa. Sin esto, la miniatura abre la camara. */
  onVer?: (uri: string) => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.espacio}>
      {uri && onVer ? (
        <Pressable
          onPress={() => onVer(uri)}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${etiqueta} en pantalla completa`}>
          <Image
            source={{ uri }}
            style={styles.miniatura}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            accessibilityLabel={etiqueta}
          />
        </Pressable>
      ) : (
        <BotonFoto uri={uri} onChange={onChange} etiqueta={etiqueta} />
      )}

      <View style={styles.textosEspacio}>
        <ThemedText type="smallBold">{etiqueta}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {uri ? descripcion : `Sin foto · ${descripcion}`}
        </ThemedText>

        {uri && onVer ? (
          <View style={styles.accionesEspacio}>
            <Pressable onPress={() => onVer(uri)} hitSlop={8} accessibilityRole="button">
              <ThemedText type="linkPrimary">Ver</ThemedText>
            </Pressable>
            <BotonFoto uri={uri} onChange={onChange} etiqueta={etiqueta} compacto />
          </View>
        ) : null}
      </View>
    </ThemedView>
  );
}

/**
 * Abre la foto en pantalla completa. Se controla con el propio `uri`: mientras
 * sea `null` no hay nada que mostrar, asi que quien lo usa solo tiene que
 * guardar en un estado la foto que quiere abrir y ponerla en `null` al cerrar.
 *
 * Se cierra tocando cualquier parte del fondo o el boton de cerrar, porque con
 * una foto de 12 MP la mano tapa el boton y es facil cerrar sin querer.
 */
export function VisorFoto({
  uri,
  etiqueta,
  onClose,
}: {
  uri: string | null;
  etiqueta: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.visorFondo} onPress={onClose} accessibilityLabel="Cerrar foto">
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.visorImagen}
            contentFit="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel={etiqueta}
          />
        ) : null}
      </Pressable>

      <View style={styles.visorBarra} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.visorCerrar}>
          <MaterialCommunityIcons name="close" size={26} color="#fff" />
        </Pressable>
        <ThemedText type="small" style={styles.visorEtiqueta}>
          {etiqueta}
        </ThemedText>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  boton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: 104,
  },
  miniatura: {
    width: 72,
    height: 72,
    borderRadius: Spacing.two,
  },
  miniaturaMini: {
    width: 30,
    height: 30,
    borderRadius: Spacing.one,
  },
  textoBoton: {
    fontSize: 12,
  },
  espacio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  textosEspacio: { flex: 1, gap: 2 },
  accionesEspacio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  press: { opacity: 0.6 },
  visorFondo: {
    flex: 1,
    // Negro y no el fondo del tema: sobre una foto, cualquier color de la app
    // compite con la imagen y distorsiona el color real de la piel, de la
    // fachada o del papel de la cedula.
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visorImagen: {
    width: '100%',
    height: '100%',
  },
  visorBarra: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  visorCerrar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#0006',
  },
  visorEtiqueta: {
    color: '#fff',
  },
});
