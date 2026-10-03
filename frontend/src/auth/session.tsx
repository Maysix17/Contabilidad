import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  clearSession,
  login as apiLogin,
  restoreSession,
  type SessionUser,
} from '@/api/client';

interface SessionContextValue {
  user: SessionUser | null;
  cargando: boolean;
  esAdmin: boolean;
  entrar: (cedula: string, contrasena: string) => Promise<void>;
  salir: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;

    void restoreSession()
      .then((session) => {
        if (vigente) setUser(session?.user ?? null);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  const entrar = useCallback(async (cedula: string, contrasena: string) => {
    const session = await apiLogin({ cedula, password: contrasena });
    setUser(session.user);
  }, []);

  const salir = useCallback(async () => {
    // Solo aqui se revoca en el servidor: es una salida voluntaria.
    await clearSession({ revocar: true });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, cargando, esAdmin: user?.rol === 'administrador', entrar, salir }),
    [user, cargando, entrar, salir],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}
