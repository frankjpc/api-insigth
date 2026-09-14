import { useState, useEffect, useCallback } from 'react';
import {
  Goal, HandHelping, Shield, Plus, CheckCircle,
  Clock, XCircle, Trophy, TrendingUp, Users, Medal
} from 'lucide-react';
import Navbar from '../components/Navbar';
import FCCard from '../components/FCCard';
import Sparkline from '../components/Sparkline';
import { useToast, ToastContainer } from '../components/Toast';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const SEMANAS = [1, 2, 3, 4, 5, 6];

const STATUS_META = {
  aprobado:  { label: 'Aprobado',  cls: 'status-aprobado',  Icon: CheckCircle },
  pendiente: { label: 'Pendiente', cls: 'status-pendiente', Icon: Clock },
  rechazado: { label: 'Rechazado', cls: 'status-rechazado', Icon: XCircle },
};

const RANK_STYLE = ['#CCFF00', '#06B6D4', '#818CF8'];  // oro, plata, bronce (colores)

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { toasts, addToast } = useToast();

  const [stats, setStats]           = useState({ semanas: [], totales: { goles: 0, asistencias: 0, atajadas: 0 } });
  const [leaderboard, setLeaderboard] = useState([]);
  const [allPow, setAllPow]         = useState([]);
  const [currentPow, setCurrentPow] = useState(null);   // jugador de la semana más reciente
  const [myPow, setMyPow]           = useState(null);   // si YO soy el jugador de la semana
  const [loading, setLoading]       = useState(true);

  const [modal, setModal]       = useState({ open: false, semana: null, existing: null });
  const [form, setForm]         = useState({ goles: '', asistencias: '', atajadas: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, leaderRes, powRes] = await Promise.all([
        client.get('/stats/me'),
        client.get('/stats/leaderboard'),
        client.get('/player-of-week'),
      ]);
      setStats(statsRes.data);
      setLeaderboard(leaderRes.data);

      const powList = Array.isArray(powRes.data) ? powRes.data : [];
      setAllPow(powList);

      // Jugador de la semana más reciente publicado
      if (powList.length > 0) {
        const sorted = [...powList].sort((a, b) => b.semana - a.semana);
        setCurrentPow(sorted[0]);
      }

      // ¿Soy yo el jugador de la semana de alguna semana?
      const mine = powList.find((p) => p.usuario_id === user.id);
      setMyPow(mine || null);
    } catch {
      addToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (semana) => {
    const existing = stats.semanas.find((s) => s.semana === semana);
    if (existing && existing.estado !== 'rechazado') return;
    setModal({ open: true, semana, existing: existing || null });
    setForm({ goles: existing?.goles ?? '', asistencias: existing?.asistencias ?? '', atajadas: existing?.atajadas ?? '' });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await client.post('/stats', {
        semana: modal.semana,
        goles: parseInt(form.goles) || 0,
        asistencias: parseInt(form.asistencias) || 0,
        atajadas: parseInt(form.atajadas) || 0,
      });
      addToast(`Stats Semana ${modal.semana} enviadas`, 'success');
      setModal({ open: false, semana: null, existing: null });
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al enviar', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getWeekData = (semana) => stats.semanas.find((s) => s.semana === semana) || null;

  const golesPerWeek = SEMANAS.map((s) => { const d = getWeekData(s); return d?.estado === 'aprobado' ? d.goles : 0; });
  const asistPerWeek = SEMANAS.map((s) => { const d = getWeekData(s); return d?.estado === 'aprobado' ? d.asistencias : 0; });
  const atajPerWeek  = SEMANAS.map((s) => { const d = getWeekData(s); return d?.estado === 'aprobado' ? d.atajadas : 0; });

  // Mi posición en el leaderboard
  const myRank = leaderboard.findIndex((p) => p.usuario_id === user.id) + 1;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dashboard">

        {/* ── Header ── */}
        <div className="page-header">
          <h1 className="page-title">Hola, {user.nombre}</h1>
          <div className="page-meta">
            <span>{user.posicion}</span>
            <span className="page-meta-dot">·</span>
            <span>SEP–DIC 2026</span>
            {myRank > 0 && (
              <>
                <span className="page-meta-dot">·</span>
                <span style={{ color: myRank <= 3 ? RANK_STYLE[myRank - 1] : 'var(--text-muted)', fontWeight: 700 }}>
                  #{myRank} en el ranking
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Banner: soy jugador de la semana ── */}
        {myPow && (() => {
          const TIPO_LABEL = {
            goleador:  '⚽ Goleador de la Semana',
            asistidor: '🎯 Asistidor de la Semana',
            portero:   '🧤 Mejor Portero de la Semana',
          };
          const TIPO_COLOR = {
            goleador:  'var(--data-goal)',
            asistidor: 'var(--data-assist)',
            portero:   'var(--data-save)',
          };
          const color = TIPO_COLOR[myPow.tipo] || 'var(--data-goal)';
          return (
            <div className="glass-card" style={{
              marginBottom: 24,
              borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
              background: `linear-gradient(120deg, color-mix(in srgb, ${color} 5%, transparent) 0%, rgba(15,21,35,0) 60%)`,
            }}>
              <div className="section-title" style={{ color }}>
                <Trophy size={14} /> {TIPO_LABEL[myPow.tipo] || 'Jugador de la Semana'} — Semana {myPow.semana}
              </div>
              {myPow.imagen_carta ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                  <img
                    src={myPow.imagen_carta}
                    alt="Carta FC"
                    style={{
                      maxHeight: 280,
                      borderRadius: 'var(--r-lg)',
                      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                      boxShadow: `0 0 32px color-mix(in srgb, ${color} 18%, transparent)`,
                    }}
                  />
                </div>
              ) : (
                <FCCard player={myPow} />
              )}
              {myPow.destacado && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', marginTop: 8 }}>
                  "{myPow.destacado}"
                </p>
              )}
            </div>
          );
        })()}

        {/* ── Layout 2 col: mis stats + jugador de la semana ── */}
        <div style={{ display: 'grid', gridTemplateColumns: currentPow ? '1fr 280px' : '1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>

          {/* Mis stats totales */}
          <div>
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <div className="stat-card goles">
                <div className="stat-card-header">
                  <div className="stat-card-icon"><Goal size={16} /></div>
                  <Sparkline data={golesPerWeek} color="var(--data-goal)" width={56} height={24} />
                </div>
                <div className="stat-card-val">{stats.totales.goles}</div>
                <div className="stat-card-label">Mis Goles</div>
                <div className="stat-card-accent" />
              </div>
              <div className="stat-card asistencias">
                <div className="stat-card-header">
                  <div className="stat-card-icon"><HandHelping size={16} /></div>
                  <Sparkline data={asistPerWeek} color="var(--data-assist)" width={56} height={24} />
                </div>
                <div className="stat-card-val">{stats.totales.asistencias}</div>
                <div className="stat-card-label">Asistencias</div>
                <div className="stat-card-accent" />
              </div>
              <div className="stat-card atajadas">
                <div className="stat-card-header">
                  <div className="stat-card-icon"><Shield size={16} /></div>
                  <Sparkline data={atajPerWeek} color="var(--data-save)" width={56} height={24} />
                </div>
                <div className="stat-card-val">{stats.totales.atajadas}</div>
                <div className="stat-card-label">Atajadas</div>
                <div className="stat-card-accent" />
              </div>
            </div>
          </div>

          {/* Jugador de la semana actual (panel lateral) */}
          {currentPow && !myPow && (() => {
            const TIPO_LABEL = {
              goleador:  '⚽ Goleador',
              asistidor: '🎯 Asistidor',
              portero:   '🧤 Portero',
            };
            const TIPO_COLOR = {
              goleador:  'var(--data-goal)',
              asistidor: 'var(--data-assist)',
              portero:   'var(--data-save)',
            };
            const color = TIPO_COLOR[currentPow.tipo] || 'var(--data-goal)';
            return (
              <div className="glass-card" style={{
                padding: '18px 16px',
                borderColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              }}>
                <div className="section-title" style={{ color, marginBottom: 12 }}>
                  <Trophy size={13} /> Sem {currentPow.semana} · {TIPO_LABEL[currentPow.tipo] || 'JDSEM'}
                </div>
                {currentPow.imagen_carta ? (
                  <img
                    src={currentPow.imagen_carta}
                    alt="Carta FC"
                    style={{
                      width: '100%',
                      borderRadius: 'var(--r-md)',
                      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                      boxShadow: `0 0 20px color-mix(in srgb, ${color} 15%, transparent)`,
                    }}
                  />
                ) : (
                  <FCCard player={currentPow} />
                )}
                {currentPow.destacado && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic', marginTop: 8 }}>
                    "{currentPow.destacado}"
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Tabla general (leaderboard) ── */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div className="section-title">
            <Users size={14} /> Tabla General — Stats Aprobadas
          </div>
          {leaderboard.length === 0 ? (
            <div className="empty-state">
              <Users size={36} />
              <p className="empty-msg">Aún no hay estadísticas aprobadas en el torneo</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th><Goal size={12} style={{ display:'inline', verticalAlign:'middle' }} /> Goles</th>
                  <th><HandHelping size={12} style={{ display:'inline', verticalAlign:'middle' }} /> Asist.</th>
                  <th><Shield size={12} style={{ display:'inline', verticalAlign:'middle' }} /> Ataj.</th>
                  <th>Jornadas</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => {
                  const isMe = p.usuario_id === user.id;
                  const rankColor = i < 3 ? RANK_STYLE[i] : 'var(--text-muted)';
                  return (
                    <tr
                      key={p.usuario_id}
                      style={isMe ? {
                        background: 'rgba(6,182,212,0.05)',
                        outline: '1px solid rgba(6,182,212,0.15)',
                      } : {}}
                    >
                      <td>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: rankColor,
                        }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </span>
                      </td>
                      <td>
                        <div className="player-cell">
                          <span className="player-name" style={isMe ? { color: 'var(--accent)' } : {}}>
                            {p.nombre} {p.apellido} {isMe && <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>(tú)</span>}
                          </span>
                          <span className="player-pos">{p.posicion}</span>
                        </div>
                      </td>
                      <td><span className="mono-num goal">{p.total_goles}</span></td>
                      <td><span className="mono-num assist">{p.total_asistencias}</span></td>
                      <td><span className="mono-num save">{p.total_atajadas}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.semanas_jugadas}/6</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Mis jornadas ── */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div className="section-title">
            <TrendingUp size={14} /> Mis Jornadas
          </div>
          <div className="weeks-grid">
            {SEMANAS.map((semana) => {
              const wd = getWeekData(semana);
              const status = wd?.estado || 'vacio';
              const StatusIcon = STATUS_META[status]?.Icon;
              const canClick = !wd || wd.estado === 'rechazado';

              return (
                <button
                  key={semana}
                  id={`week-btn-${semana}`}
                  className={`week-card week-card--${status} ${!canClick ? 'week-card--disabled' : ''}`}
                  onClick={() => canClick && openModal(semana)}
                >
                  <span className="week-card-num">Sem {semana}</span>
                  <div className="week-card-status-icon">
                    {status === 'vacio' ? <Plus size={14} /> : <StatusIcon size={13} />}
                  </div>
                  {wd ? (
                    <div className="week-card-mini-stats">
                      <span className="week-mini-val" style={{ color: 'var(--data-goal)' }}>{wd.goles}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>·</span>
                      <span className="week-mini-val" style={{ color: 'var(--data-assist)' }}>{wd.asistencias}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>·</span>
                      <span className="week-mini-val" style={{ color: 'var(--data-save)' }}>{wd.atajadas}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>—</span>
                  )}
                  {wd?.estado === 'aprobado' && (
                    <Sparkline data={[wd.goles, wd.asistencias, wd.atajadas]} color="var(--data-goal)" width={48} height={16} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tabla detalle mis jornadas */}
          {stats.semanas.length > 0 && (
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Goles</th>
                  <th>Asistencias</th>
                  <th>Atajadas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.semanas.map((s) => {
                  const meta = STATUS_META[s.estado];
                  return (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Sem {s.semana}</td>
                      <td><span className="mono-num goal">{s.goles}</span></td>
                      <td><span className="mono-num assist">{s.asistencias}</span></td>
                      <td><span className="mono-num save">{s.atajadas}</span></td>
                      <td>
                        <span className={`status-badge ${meta?.cls}`}>
                          {meta?.Icon && <meta.Icon size={11} />}
                          {meta?.label}
                        </span>
                        {s.estado === 'rechazado' && s.nota_admin && (
                          <div className="rejected-note">{s.nota_admin}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {stats.semanas.length === 0 && (
            <div className="empty-state">
              <TrendingUp size={36} />
              <p className="empty-msg">Sin estadísticas aún — selecciona una semana para comenzar</p>
            </div>
          )}
        </div>

        {/* ── Hall of Fame — todas las cartas ── */}
        {allPow.length > 0 && (
          <div className="glass-card">
            <div className="section-title">
              <Medal size={14} /> Hall of Fame — Jugadores de la Semana
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 8 }}>
              {[...allPow].sort((a, b) => a.semana - b.semana).map((p) => (
                <FCCard key={p.id} player={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal envío stats ── */}
      {modal.open && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setModal({ open: false, semana: null, existing: null })}
        >
          <div className="modal">
            <div className="modal-title">
              <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
              {modal.existing?.estado === 'rechazado' ? 'Reenviar' : 'Agregar'} — Semana {modal.semana}
            </div>
            {modal.existing?.estado === 'rechazado' && (
              <div className="rejected-note" style={{ marginBottom: 20 }}>
                <XCircle size={13} style={{ display: 'inline', marginRight: 5 }} />
                Rechazadas.{modal.existing.nota_admin ? ` Motivo: ${modal.existing.nota_admin}` : ' Puedes reenviar con los valores correctos.'}
              </div>
            )}
            <div className="num-input-row">
              {[
                { key: 'goles',       label: 'Goles',      color: 'var(--data-goal)',   id: 'input-goles'       },
                { key: 'asistencias', label: 'Asistencias', color: 'var(--data-assist)', id: 'input-asistencias' },
                { key: 'atajadas',    label: 'Atajadas',    color: 'var(--data-save)',   id: 'input-atajadas'    },
              ].map(({ key, label, color, id }) => (
                <div className="num-input-group" key={key}>
                  <label className="form-label" style={{ color }}>{label}</label>
                  <input
                    id={id}
                    type="number" min="0" max="99"
                    className="num-input"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal({ open: false, semana: null, existing: null })}>
                Cancelar
              </button>
              <button id="modal-submit" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <span className="spinner" /> : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </>
  );
}
