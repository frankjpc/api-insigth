require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { getDb } = require('./db/database');
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const playersRoutes = require('./routes/players');
const playerOfWeekRoutes = require('./routes/playerOfWeek');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir imágenes subidas
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Inicializar BD
getDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/player-of-week', playerOfWeekRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

// ── Limpieza automática de notificaciones antiguas ──────────────────────────
function cleanOldNotifications() {
  try {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM notificaciones
      WHERE created_at < datetime('now', '-5 days')
    `).run();
    if (result.changes > 0) {
      console.log(`🧹 Notificaciones eliminadas: ${result.changes} (más de 5 días)`);
    }
  } catch (err) {
    console.error('Error al limpiar notificaciones:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 API Estadísticas Fútbol Sala`);

  // Limpiar al arrancar
  cleanOldNotifications();

  // Limpiar cada hora
  setInterval(cleanOldNotifications, 60 * 60 * 1000);
});
