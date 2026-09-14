import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Calendar, Clock, Trophy,
  CheckCircle, XCircle, Pencil, Trash2,
  Goal, HandHelping, Shield, TrendingUp, Users
} from 'lucide-react';
import Navbar from '../components/Navbar';
import FCCard from '../components/FCCard';
import { useToast, ToastContainer } from '../components/Toast';
import client from '../api/client';

const SEMANAS = [1, 2, 3, 4, 5, 6];

export default function AdminDashboard() {
  const { toasts, addToast } = useToast();
  const [tab, setTab] = useState('general');
  const [weekFilter, setWeekFilter] = useState('all');

  const [players, setPlayers] = useState([]);
  const [allStats, setAllStats] = useState({ stats: [], totalesPorJugador: [] });
  const [pending, setPending] = useState([]);
  const [playerOfWeek, setPlayerOfWeek] = useState([]);

  const [editModal, setEditModal] = useState({ open: false, stat: null });
  const [editForm, setEditForm] = useState({ goles: '', asistencias: '', atajadas: '' });
  const [rejectModal, setRejectModal] = useState({ open: false, stat: null, nota: '' });
  const [powForm, setPowForm] = useState({
    semana: '', tipo: 'goleador', fileCarta: null, previewCarta: null,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [playersRes, statsRes, pendingRes, powRes] = await Promise.all([
        client.get('/players'),
        client.get('/stats/all'),
        client.get('/stats/pending'),
        client.get('/player-of-week'),
      ]);
      setPlayers(playersRes.data);
      setAllStats(statsRes.data);
      setPending(pendingRes.data);
      setPlayerOfWeek(Array.isArray(powRes.data) ? powRes.data : []);
    } catch {
      addToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleApprove = async (stat) => {
    try {
      await client.put(`/stats/${stat.id}/approve`);
      addToast(`${stat.nombre} ${stat.apellido} — S${stat.semana} aprobada`, 'success');
      fetchAll();
    } catch { addToast('Error al aprobar', 'error'); }
  };

  const handleRejectSubmit = async () => {
    setSubmitting(true);
    try {
      await client.put(`/stats/${rejectModal.stat.id}/reject`, { nota: rejectModal.nota });
      addToast('Estadísticas rechazadas', 'info');
      setRejectModal({ open: false, stat: null, nota: '' });
      fetchAll();
    } catch { addToast('Error', 'error'); }
    setSubmitting(false);
  };

  const handleEditSave = async () => {
    setSubmitting(true);
    try {
      await client.put(`/stats/${editModal.stat.id}`, {
        goles: parseInt(editForm.goles),
        asistencias: parseInt(editForm.asistencias),
        atajadas: parseInt(editForm.atajadas),
      });
      addToast('Estadísticas actualizadas', 'success');
      setEditModal({ open: false, stat: null });
      fetchAll();
    } catch { addToast('Error', 'error'); }
    setSubmitting(false);
  };

  const handleEditAndApprove = async () => {
    setSubmitting(true);
    try {
      await client.put(`/stats/${editModal.stat.id}/approve`, {
        goles: parseInt(editForm.goles),
        asistencias: parseInt(editForm.asistencias),
        atajadas: parseInt(editForm.atajadas),
      });
      addToast('Editado y aprobado', 'success');
      setEditModal({ open: false, stat: null });
      fetchAll();
    } catch { addToast('Error', 'error'); }
    setSubmitting(false);
  };

  const handleDelete = async (statId) => {
    if (!confirm('¿Eliminar esta estadística?')) return;
    try {
      await client.delete(`/stats/${statId}`);
      addToast('Estadística eliminada', 'info');
      fetchAll();
    } catch { addToast('Error', 'error'); }
  };

  const handlePowSubmit = async () => {
    if (!powForm.fileCarta) {
      addToast('Debes seleccionar la imagen de la carta', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // Comprimir y convertir la imagen a base64 usando canvas
      // Esto reduce el tamaño de la imagen manteniendo buena calidad visual
      const compressImage = (file, maxPx = 900, quality = 0.82) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            // Calcular nuevas dimensiones manteniendo la proporción
            let { width, height } = img;
            if (width > maxPx || height > maxPx) {
              if (width > height) { height = Math.round((height / width) * maxPx); width = maxPx; }
              else { width = Math.round((width / height) * maxPx); height = maxPx; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = reject;
          img.src = url;
        });

      const base64Image = await compressImage(powForm.fileCarta);

      await client.post('/player-of-week', {
        semana:       powForm.semana,
        tipo:         powForm.tipo,
        imagen_carta: base64Image,
      });
      addToast('Carta publicada correctamente', 'success');
      setPowForm({ semana: '', tipo: 'goleador', fileCarta: null, previewCarta: null });
      fetchAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al publicar', 'error');
    }
    setSubmitting(false);
  };


  const filteredStats = weekFilter === 'all'
    ? allStats.stats
    : allStats.stats.filter((s) => s.semana === parseInt(weekFilter));

  const TABS = [
    { id: 'general',  label: 'General',    Icon: BarChart2 },
    { id: 'semanales',label: 'Semanales',   Icon: Calendar  },
    { id: 'pending',  label: 'Pendientes', Icon: Clock, count: pending.length },
    { id: 'pow',      label: 'Jugador Sem.',Icon: Trophy },
  ];

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

        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Panel de Administrador</h1>
          <div className="page-meta">
            <Users size={13} />
            <span>{players.length} jugadores registrados</span>
            {pending.length > 0 && (
              <>
                <span className="page-meta-dot">·</span>
                <span style={{ color: 'var(--data-warn)' }}>{pending.length} pendientes</span>
              </>
            )}
          </div>
        </div>

        {/* Pending alert */}
        {pending.length > 0 && (
          <div className="alert-banner">
            <Clock size={16} />
            <span><strong>{pending.length}</strong> estadística{pending.length > 1 ? 's' : ''} esperando aprobación</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setTab('pending')}
            >
              Revisar
            </button>
          </div>
        )}

        {/* Segmented Tabs */}
        <div className="seg-tabs">
          {TABS.map(({ id, label, Icon, count }) => (
            <button
              key={id}
              id={`tab-${id}`}
              className={`seg-tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={14} />
              {label}
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          ))}
        </div>

        {/* ===== TAB: GENERAL ===== */}
        {tab === 'general' && (
          <div className="glass-card">
            <div className="section-title">
              <BarChart2 size={14} /> Estadísticas Generales — Solo Aprobadas
            </div>
            {allStats.totalesPorJugador.length === 0 ? (
              <div className="empty-state">
                <BarChart2 size={36} />
                <p className="empty-msg">No hay estadísticas aprobadas aún</p>
              </div>
            ) : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th><Goal size={12} style={{ display: 'inline' }} /> Goles</th>
                    <th><HandHelping size={12} style={{ display: 'inline' }} /> Asist.</th>
                    <th><Shield size={12} style={{ display: 'inline' }} /> Ataj.</th>
                  </tr>
                </thead>
                <tbody>
                  {allStats.totalesPorJugador.map((p) => (
                    <tr key={p.usuario_id}>
                      <td>
                        <div className="player-cell">
                          <span className="player-name">{p.nombre} {p.apellido}</span>
                          <span className="player-pos">{p.posicion}</span>
                        </div>
                      </td>
                      <td><span className="mono-num goal">{p.total_goles}</span></td>
                      <td><span className="mono-num assist">{p.total_asistencias}</span></td>
                      <td><span className="mono-num save">{p.total_atajadas}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: SEMANALES ===== */}
        {tab === 'semanales' && (
          <div className="glass-card">
            <div className="section-title"><Calendar size={14} /> Por Semana</div>
            <div className="week-filter">
              <button
                id="week-filter-all"
                className={`week-pill ${weekFilter === 'all' ? 'active' : ''}`}
                onClick={() => setWeekFilter('all')}
              >
                Todas
              </button>
              {SEMANAS.map((s) => (
                <button
                  key={s}
                  id={`week-filter-${s}`}
                  className={`week-pill ${weekFilter === String(s) ? 'active' : ''}`}
                  onClick={() => setWeekFilter(String(s))}
                >
                  Sem {s}
                </button>
              ))}
            </div>
            {filteredStats.length === 0 ? (
              <div className="empty-state">
                <Calendar size={36} />
                <p className="empty-msg">Sin estadísticas para este filtro</p>
              </div>
            ) : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Sem</th>
                    <th>Goles</th>
                    <th>Asist.</th>
                    <th>Ataj.</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="player-cell">
                          <span className="player-name">{s.nombre} {s.apellido}</span>
                          <span className="player-pos">{s.posicion}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>S{s.semana}</td>
                      <td><span className="mono-num goal">{s.goles}</span></td>
                      <td><span className="mono-num assist">{s.asistencias}</span></td>
                      <td><span className="mono-num save">{s.atajadas}</span></td>
                      <td>
                        <div className="actions-cell">
                          <button
                            id={`edit-stat-${s.id}`}
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditModal({ open: true, stat: s });
                              setEditForm({ goles: s.goles, asistencias: s.asistencias, atajadas: s.atajadas });
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            id={`delete-stat-${s.id}`}
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(s.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: PENDING ===== */}
        {tab === 'pending' && (
          <div className="glass-card">
            <div className="section-title"><Clock size={14} /> Pendientes de Aprobación</div>
            {pending.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={36} />
                <p className="empty-msg">Todo al día — sin pendientes</p>
              </div>
            ) : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Semana</th>
                    <th>Goles</th>
                    <th>Asist.</th>
                    <th>Ataj.</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="player-cell">
                          <span className="player-name">{s.nombre} {s.apellido}</span>
                          <span className="player-pos">{s.posicion}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--data-warn)', fontWeight: 600 }}>
                          Sem {s.semana}
                        </span>
                      </td>
                      <td><span className="mono-num goal">{s.goles}</span></td>
                      <td><span className="mono-num assist">{s.asistencias}</span></td>
                      <td><span className="mono-num save">{s.atajadas}</span></td>
                      <td>
                        <div className="actions-cell">
                          <button
                            id={`approve-${s.id}`}
                            className="btn btn-success btn-sm"
                            onClick={() => handleApprove(s)}
                          >
                            <CheckCircle size={13} /> Aprobar
                          </button>
                          <button
                            id={`edit-approve-${s.id}`}
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditModal({ open: true, stat: s });
                              setEditForm({ goles: s.goles, asistencias: s.asistencias, atajadas: s.atajadas });
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            id={`reject-${s.id}`}
                            className="btn btn-danger btn-sm"
                            onClick={() => setRejectModal({ open: true, stat: s, nota: '' })}
                          >
                            <XCircle size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: PLAYER OF WEEK ===== */}
        {tab === 'pow' && (
          <div className="pow-grid">

            {/* ── Formulario simplificado: 3 campos ── */}
            <div className="glass-card">
              <div className="section-title"><Trophy size={14} /> Publicar Carta de la Semana</div>
              <div className="pow-form">

                {/* Semana */}
                <div className="form-group">
                  <label className="form-label">Semana</label>
                  <select
                    id="pow-semana"
                    className="player-select"
                    value={powForm.semana}
                    onChange={(e) => setPowForm({ ...powForm, semana: e.target.value })}
                  >
                    <option value="">Seleccionar semana...</option>
                    {SEMANAS.map((s) => <option key={s} value={s}>Semana {s}</option>)}
                  </select>
                </div>

                {/* Distinción */}
                <div className="form-group">
                  <label className="form-label">Distinción</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { val: 'goleador',  label: '⚽ Goleador',  color: 'var(--data-goal)' },
                      { val: 'asistidor', label: '🎯 Asistidor', color: 'var(--data-assist)' },
                      { val: 'portero',   label: '🧤 Portero',   color: 'var(--data-save)' },
                    ].map(({ val, label, color }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPowForm({ ...powForm, tipo: val })}
                        style={{
                          padding: '7px 16px',
                          borderRadius: 'var(--r-sm)',
                          border: `1px solid ${powForm.tipo === val ? color : 'var(--border)'}`,
                          background: powForm.tipo === val
                            ? `color-mix(in srgb, ${color} 15%, transparent)`
                            : 'var(--bg-pill)',
                          color: powForm.tipo === val ? color : 'var(--text-muted)',
                          fontFamily: 'Space Grotesk, sans-serif',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Imagen de la carta */}
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--data-goal)' }}>
                    Imagen de la Carta
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>jpg · png · webp</span>
                  </label>
                  <input
                    id="pow-imagen-carta"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="form-input"
                    style={{ paddingTop: 8, cursor: 'pointer' }}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) {
                        setPowForm({ ...powForm, fileCarta: f, previewCarta: URL.createObjectURL(f) });
                      }
                    }}
                  />
                  {powForm.previewCarta && (
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                      <img
                        src={powForm.previewCarta}
                        alt="Vista previa"
                        style={{
                          maxHeight: 240,
                          maxWidth: '100%',
                          borderRadius: 'var(--r-md)',
                          border: '1px solid rgba(204,255,0,0.3)',
                          boxShadow: '0 0 24px rgba(204,255,0,0.12)',
                        }}
                      />
                    </div>
                  )}
                </div>

                <button
                  id="pow-submit"
                  className="btn btn-gold"
                  style={{ marginTop: 4 }}
                  onClick={handlePowSubmit}
                  disabled={submitting || !powForm.semana || !powForm.fileCarta}
                >
                  {submitting
                    ? <span className="spinner" />
                    : <><Trophy size={14} /> Publicar Carta</>}
                </button>
              </div>
            </div>

            {/* ── Cartas publicadas ── */}
            <div className="glass-card">
              <div className="section-title"><TrendingUp size={14} /> Cartas Publicadas</div>
              {playerOfWeek.length > 0 ? (
                <div className="pow-cards-list">
                  {playerOfWeek.map((p) => {
                    const TIPO_LABEL = {
                      goleador:  '⚽ Goleador de la Semana',
                      asistidor: '🎯 Asistidor de la Semana',
                      portero:   '🧤 Mejor Portero',
                    };
                    const TIPO_COLOR = {
                      goleador:  'var(--data-goal)',
                      asistidor: 'var(--data-assist)',
                      portero:   'var(--data-save)',
                    };
                    const color = TIPO_COLOR[p.tipo] || 'var(--data-goal)';
                    return (
                      <div key={p.id} className="pow-card-row" style={{ alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: '0.63rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.8px',
                            color,
                          }}>
                            Sem {p.semana} · {TIPO_LABEL[p.tipo] || 'Carta'}
                          </span>
                          {p.imagen_carta ? (
                            <img
                              src={p.imagen_carta}
                              alt="Carta FC"
                              style={{
                                width: 150,
                                borderRadius: 'var(--r-md)',
                                border: `1px solid ${color}33`,
                                boxShadow: `0 0 18px ${color}25`,
                              }}
                            />
                          ) : (
                            <FCCard player={p} />
                          )}
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ marginTop: 28 }}
                          onClick={async () => {
                            await client.delete(`/player-of-week/${p.semana}`);
                            addToast('Carta eliminada', 'info');
                            fetchAll();
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <Trophy size={36} />
                  <p className="empty-msg">No hay cartas publicadas aún</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Editar */}
      {editModal.open && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setEditModal({ open: false, stat: null })}
        >
          <div className="modal">
            <div className="modal-title">
              <Pencil size={16} style={{ color: 'var(--accent)' }} />
              Editar — {editModal.stat?.nombre} {editModal.stat?.apellido} · Sem {editModal.stat?.semana}
            </div>
            <div className="num-input-row">
              <div className="num-input-group">
                <label className="form-label" style={{ color: 'var(--data-goal)' }}>Goles</label>
                <input id="edit-goles" type="number" min="0" className="num-input"
                  value={editForm.goles}
                  onChange={(e) => setEditForm({ ...editForm, goles: e.target.value })} />
              </div>
              <div className="num-input-group">
                <label className="form-label" style={{ color: 'var(--data-assist)' }}>Asist.</label>
                <input id="edit-asistencias" type="number" min="0" className="num-input"
                  value={editForm.asistencias}
                  onChange={(e) => setEditForm({ ...editForm, asistencias: e.target.value })} />
              </div>
              <div className="num-input-group">
                <label className="form-label" style={{ color: 'var(--data-save)' }}>Ataj.</label>
                <input id="edit-atajadas" type="number" min="0" className="num-input"
                  value={editForm.atajadas}
                  onChange={(e) => setEditForm({ ...editForm, atajadas: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditModal({ open: false, stat: null })}>
                Cancelar
              </button>
              <button id="edit-save" className="btn btn-ghost" onClick={handleEditSave} disabled={submitting}>
                {submitting ? <span className="spinner" /> : <><Pencil size={13} /> Guardar</>}
              </button>
              {editModal.stat?.estado === 'pendiente' && (
                <button id="edit-and-approve" className="btn btn-success" onClick={handleEditAndApprove} disabled={submitting}>
                  {submitting ? <span className="spinner" /> : <><CheckCircle size={13} /> Guardar y Aprobar</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazar */}
      {rejectModal.open && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setRejectModal({ open: false, stat: null, nota: '' })}
        >
          <div className="modal">
            <div className="modal-title">
              <XCircle size={16} style={{ color: 'var(--data-err)' }} />
              Rechazar — {rejectModal.stat?.nombre} {rejectModal.stat?.apellido} · Sem {rejectModal.stat?.semana}
            </div>
            <div className="form-group">
              <label className="form-label">Motivo (opcional)</label>
              <input
                id="reject-nota"
                type="text"
                className="form-input"
                placeholder="Ej: Números no coinciden con el acta"
                value={rejectModal.nota}
                onChange={(e) => setRejectModal({ ...rejectModal, nota: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRejectModal({ open: false, stat: null, nota: '' })}>
                Cancelar
              </button>
              <button id="reject-confirm" className="btn btn-danger" onClick={handleRejectSubmit} disabled={submitting}>
                {submitting ? <span className="spinner" /> : <><XCircle size={13} /> Rechazar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </>
  );
}
