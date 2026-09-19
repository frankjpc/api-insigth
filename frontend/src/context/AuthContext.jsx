import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  // validating: true mientras comprobamos si el token guardado sigue vigente
  const [validating, setValidating] = useState(true);

  // Al montar, validar el token guardado en localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      setValidating(false);
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      localStorage.removeItem('user');
    }

    client.get('/health')
      .catch(() => {})
      .finally(() => { setValidating(false); });
  }, []);

  // Keep-alive: ping cada 10 min para evitar que Render duerma el servidor
  const KEEP_ALIVE_MS = 10 * 60 * 1000; // 10 minutos
  useEffect(() => {
    if (!user) return; // Solo cuando hay sesión activa
    const ping = () => client.get('/health').catch(() => {});
    const interval = setInterval(ping, KEEP_ALIVE_MS);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (nombre, apellido, posicion, pin) => {
    setLoading(true);
    try {
      const body = { nombre, apellido, posicion };
      if (pin !== undefined && pin !== '') body.pin = pin;

      const { data } = await client.post('/auth/login', body);

      if (data.requiresPin) {
        return {
          success: false,
          error: data.error || 'Se requiere PIN de administrador',
          requiresPin: true,
        };
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.usuario));
      setUser(data.usuario);
      return { success: true, usuario: data.usuario };
    } catch (err) {
      const errData = err.response?.data;
      return {
        success: false,
        error: errData?.error || 'Error al iniciar sesión',
        requiresPin: errData?.requiresPin || false,
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, validating, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
