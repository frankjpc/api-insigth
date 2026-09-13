import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, LogOut, Activity, CheckCircle, XCircle, Trophy, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const NOTIF_ICONS = {
  estadistica_pendiente: <UserPlus size={14} />,
  estadistica_aprobada:  <CheckCircle size={14} />,
  estadistica_rechazada: <XCircle size={14} />,
  jugador_semana:        <Trophy size={14} />,
  nuevo_jugador:         <UserPlus size={14} />,
  default:               <Bell size={14} />,
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await client.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch { }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleReadAll = async () => {
    await client.put('/notifications/read-all');
    fetchNotifications();
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-brand-icon">
          <Activity size={16} />
        </div>
        <span>API Insight</span>
      </div>

      <div className="navbar-right">
        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            id="notif-btn"
            className="notif-btn"
            onClick={() => setShowNotif(!showNotif)}
            aria-label="Notificaciones"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <div className="notif-panel">
              <div className="notif-panel-header">
                <span className="notif-panel-title">Notificaciones</span>
                {unreadCount > 0 && (
                  <button className="notif-read-all" onClick={handleReadAll}>
                    Marcar todo leído
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">Sin notificaciones</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${!n.leida ? 'unread' : ''}`}
                      onClick={() => {
                        client.put(`/notifications/${n.id}/read`);
                        fetchNotifications();
                      }}
                    >
                      <div className="notif-icon-wrap">
                        {NOTIF_ICONS[n.tipo] || NOTIF_ICONS.default}
                      </div>
                      <div className="notif-content">
                        <div className="notif-msg">{n.mensaje}</div>
                        <div className="notif-time">{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="navbar-user">
          <span className="navbar-name">{user?.nombre} {user?.apellido}</span>
          <span className={`navbar-role ${user?.rol === 'admin' ? 'role-admin' : 'role-jugador'}`}>
            {user?.rol === 'admin' ? 'Admin' : user?.posicion}
          </span>
        </div>

        <button id="logout-btn" className="logout-btn" onClick={logout}>
          <LogOut size={14} />
          Salir
        </button>
      </div>
    </nav>
  );
}
