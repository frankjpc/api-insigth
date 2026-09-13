import { createContext, useContext, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = async (nombre, apellido, posicion, pin) => {
    setLoading(true);
    try {
      const body = { nombre, apellido, posicion };
      if (pin !== undefined && pin !== '') body.pin = pin;

      const { data } = await client.post('/auth/login', body);

      // El backend devuelve 200 + requiresPin:true cuando
      // la cuenta tiene PIN pero no fue provisto o era incorrecto.
      // En ese caso NO hay token — no es un login exitoso.
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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
