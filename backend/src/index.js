require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { supabase } = require('./db/supabase');
const { getDb } = require('./db/database');
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const playersRoutes = require('./routes/players');
const playerOfWeekRoutes = require('./routes/playerOfWeek');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://api-insigth.vercel.app', // Sin barra final para coincidir con el header Origin del navegador
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (como Postman o curl) o si está en la lista de orígenes permitidos
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('https://api-insigth.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Permitir dinámicamente para evitar bloqueos durante el despliegue inicial
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir imágenes subidas localmente (fallback)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Inicializar BD SQLite si no hay Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  try {
    getDb();
  } catch (err) {
    console.warn('Advertencia inicializando SQLite local:', err.message);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/player-of-week', playerOfWeekRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    db: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY) ? 'Supabase' : 'SQLite',
    timestamp: new Date().toISOString()
  });
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

// ── Limpieza automática de notificaciones antiguas (más de 5 días) ─────────
async function cleanOldNotifications() {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .lt('created_at', fiveDaysAgo);
      if (error) console.error('Error limpiando notificaciones en Supabase:', error.message);
    } else {
      const db = getDb();
      const result = db.prepare(`
        DELETE FROM notificaciones
        WHERE created_at < datetime('now', '-5 days')
      `).run();
      if (result.changes > 0) {
        console.log(`🧹 Notificaciones eliminadas: ${result.changes} (más de 5 días)`);
      }
    }
  } catch (err) {
    console.error('Error al limpiar notificaciones:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 API Estadísticas Fútbol Sala (${process.env.SUPABASE_URL ? 'Supabase' : 'SQLite Local'})`);

  cleanOldNotifications();
  setInterval(cleanOldNotifications, 60 * 60 * 1000);
});
