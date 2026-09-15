import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Activity, User, ChevronDown, Lock,
  ArrowRight, Zap
} from 'lucide-react';

const POSITIONS = ['Portero', 'Defensa', 'Centrocampista', 'Delantero', 'Universal'];

// Datos decorativos del panel izquierdo
const BRAND_STATS = [
  { val: '35', cls: 'cyan', label: 'Jugadores' },
  { val: '6', cls: 'volt', label: 'Semanas' },
  { val: '∞', cls: 'indigo', label: 'Stats' },
];

export default function Login() {
  const { login, loading } = useAuth();

  const [form, setForm] = useState({ nombre: '', apellido: '', posicion: '' });
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const resetPin = () => { setShowPin(false); setPin(''); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.nombre.trim() || !form.apellido.trim() || !form.posicion) {
      setError('Por favor completa todos los campos');
      return;
    }

    const result = await login(
      form.nombre, form.apellido, form.posicion,
      showPin ? pin : undefined
    );

    if (!result.success) {
      if (result.requiresPin) {
        setShowPin(true);
        setError('Esta cuenta requiere un PIN de administrador');
      } else {
        setError(result.error);
      }
    }
  };

  return (
    <div className="login-bg">

      {/* ── PANEL IZQUIERDO — Imagen ── */}
      <div className="login-brand">
        <img src="/FC.jpg" alt="API Insight" className="login-brand-img" />
      </div>

      {/* ── PANEL DERECHO — Formulario ── */}
      <div className="login-form-panel">
        <div className="login-container">

          {/* Header */}
          <div className="login-header">
            <h1 className="login-title">Bienvenido</h1>
            <p className="login-subtitle">
              Ingresa tu nombre y posición para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">

            {/* Nombre */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-nombre">Nombre</label>
              <div className="input-wrap">
                <input
                  id="login-nombre"
                  type="text"
                  className="form-input"
                  placeholder="Tu nombre"
                  value={form.nombre}
                  onChange={(e) => { setForm({ ...form, nombre: e.target.value }); resetPin(); }}
                  autoComplete="given-name"
                />
                <span className="input-icon"><User size={15} /></span>
              </div>
            </div>

            {/* Apellido */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-apellido">Apellido</label>
              <div className="input-wrap">
                <input
                  id="login-apellido"
                  type="text"
                  className="form-input"
                  placeholder="Tu apellido"
                  value={form.apellido}
                  onChange={(e) => { setForm({ ...form, apellido: e.target.value }); resetPin(); }}
                  autoComplete="family-name"
                />
                <span className="input-icon"><User size={15} /></span>
              </div>
            </div>

            {/* Posición */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-posicion">Posición</label>
              <div className="input-wrap">
                <select
                  id="login-posicion"
                  className="form-input form-select"
                  value={form.posicion}
                  onChange={(e) => setForm({ ...form, posicion: e.target.value })}
                >
                  <option value="">Selecciona tu posición</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <span className="input-icon" style={{ left: 'auto', right: 13, pointerEvents: 'none' }}>
                  <ChevronDown size={14} />
                </span>
              </div>
            </div>

            {/* PIN — solo aparece cuando el backend lo requiere */}
            {showPin && (
              <div className="form-group pin-group">
                <label className="form-label pin-label" htmlFor="login-pin">
                  <Lock size={11} /> PIN de Administrador
                </label>
                <div className="input-wrap">
                  <input
                    id="login-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    className="form-input pin-input no-icon"
                    placeholder="• • • •"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="login-error" role="alert">
                <span style={{ flexShrink: 0 }}>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              className={`login-btn ${showPin ? 'pin-mode' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" /> Verificando...
                </span>
              ) : showPin ? (
                <span className="btn-loading">
                  <Lock size={15} /> Confirmar PIN
                </span>
              ) : (
                <span className="btn-loading">
                  Ingresar <ArrowRight size={15} />
                </span>
              )}
            </button>
          </form>

          <p className="login-note">
            Si no tienes cuenta, se registra automáticamente
            al ingresar por primera vez.
          </p>
        </div>
      </div>
    </div>
  );
}
