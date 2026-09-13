const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats/leaderboard — Tabla general pública (cualquier jugador autenticado)
router.get('/leaderboard', authenticateToken, (req, res) => {
  const db = getDb();

  const totales = db.prepare(`
    SELECT
      es.usuario_id,
      u.nombre, u.apellido, u.posicion,
      COALESCE(SUM(es.goles), 0)        as total_goles,
      COALESCE(SUM(es.asistencias), 0)  as total_asistencias,
      COALESCE(SUM(es.atajadas), 0)     as total_atajadas,
      COUNT(DISTINCT es.semana)         as semanas_jugadas
    FROM estadisticas_semanales es
    JOIN usuarios u ON es.usuario_id = u.id
    WHERE es.estado = 'aprobado'
    GROUP BY es.usuario_id
    ORDER BY total_goles DESC, total_asistencias DESC, total_atajadas DESC
  `).all();

  res.json(totales);
});

// GET /api/stats/me — Estadísticas propias del jugador
router.get('/me', authenticateToken, (req, res) => {

  const db = getDb();
  const userId = req.user.id;

  const stats = db.prepare(`
    SELECT * FROM estadisticas_semanales 
    WHERE usuario_id = ? 
    ORDER BY semana ASC
  `).all(userId);

  // Totales solo de aprobados
  const totales = db.prepare(`
    SELECT 
      COALESCE(SUM(goles), 0) as goles,
      COALESCE(SUM(asistencias), 0) as asistencias,
      COALESCE(SUM(atajadas), 0) as atajadas
    FROM estadisticas_semanales 
    WHERE usuario_id = ? AND estado = 'aprobado'
  `).get(userId);

  res.json({ semanas: stats, totales });
});

// POST /api/stats — Jugador envía sus estadísticas de una semana
router.post('/', authenticateToken, (req, res) => {
  const { semana, goles, asistencias, atajadas } = req.body;
  const userId = req.user.id;

  if (!semana || semana < 1 || semana > 6) {
    return res.status(400).json({ error: 'Semana inválida (1-6)' });
  }

  const db = getDb();

  // Verificar si ya tiene stats para esa semana
  const existing = db.prepare(
    'SELECT * FROM estadisticas_semanales WHERE usuario_id = ? AND semana = ?'
  ).get(userId, semana);

  if (existing) {
    if (existing.estado === 'aprobado') {
      return res.status(400).json({ error: 'Las estadísticas de esta semana ya fueron aprobadas' });
    }
    // Si estaba rechazado o pendiente, actualizar
    db.prepare(`
      UPDATE estadisticas_semanales 
      SET goles = ?, asistencias = ?, atajadas = ?, estado = 'pendiente', nota_admin = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE usuario_id = ? AND semana = ?
    `).run(goles || 0, asistencias || 0, atajadas || 0, userId, semana);
  } else {
    db.prepare(`
      INSERT INTO estadisticas_semanales (usuario_id, semana, goles, asistencias, atajadas, estado)
      VALUES (?, ?, ?, ?, ?, 'pendiente')
    `).run(userId, semana, goles || 0, asistencias || 0, atajadas || 0);
  }

  // Notificar a todos los admins
  const admins = db.prepare("SELECT id FROM usuarios WHERE rol = 'admin'").all();
  const usuario = db.prepare('SELECT nombre, apellido FROM usuarios WHERE id = ?').get(userId);

  for (const admin of admins) {
    db.prepare(
      'INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES (?, ?, ?)'
    ).run(
      admin.id,
      'estadistica_pendiente',
      `${usuario.nombre} ${usuario.apellido} envió estadísticas de la Semana ${semana}`
    );
  }

  res.json({ message: 'Estadísticas enviadas. Pendiente de aprobación.' });
});

// GET /api/stats/pending — Admin: lista de pendientes
router.get('/pending', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();

  const pending = db.prepare(`
    SELECT es.*, u.nombre, u.apellido, u.posicion
    FROM estadisticas_semanales es
    JOIN usuarios u ON es.usuario_id = u.id
    WHERE es.estado = 'pendiente'
    ORDER BY es.created_at DESC
  `).all();

  res.json(pending);
});

// GET /api/stats/all — Admin: todas las estadísticas aprobadas
router.get('/all', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const { semana } = req.query;

  let query = `
    SELECT es.*, u.nombre, u.apellido, u.posicion
    FROM estadisticas_semanales es
    JOIN usuarios u ON es.usuario_id = u.id
    WHERE es.estado = 'aprobado'
  `;
  const params = [];

  if (semana) {
    query += ' AND es.semana = ?';
    params.push(parseInt(semana));
  }

  query += ' ORDER BY u.apellido ASC, es.semana ASC';

  const stats = db.prepare(query).all(...params);

  // Totales por jugador
  const totalesPorJugador = db.prepare(`
    SELECT 
      es.usuario_id,
      u.nombre, u.apellido, u.posicion,
      COALESCE(SUM(es.goles), 0) as total_goles,
      COALESCE(SUM(es.asistencias), 0) as total_asistencias,
      COALESCE(SUM(es.atajadas), 0) as total_atajadas
    FROM estadisticas_semanales es
    JOIN usuarios u ON es.usuario_id = u.id
    WHERE es.estado = 'aprobado'
    GROUP BY es.usuario_id
    ORDER BY total_goles DESC
  `).all();

  res.json({ stats, totalesPorJugador });
});

// PUT /api/stats/:id/approve — Admin aprueba (y opcionalmente edita)
router.put('/:id/approve', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { goles, asistencias, atajadas } = req.body;
  const db = getDb();

  const stat = db.prepare('SELECT * FROM estadisticas_semanales WHERE id = ?').get(id);
  if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

  db.prepare(`
    UPDATE estadisticas_semanales
    SET estado = 'aprobado',
        goles = COALESCE(?, goles),
        asistencias = COALESCE(?, asistencias),
        atajadas = COALESCE(?, atajadas),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    goles !== undefined ? goles : null,
    asistencias !== undefined ? asistencias : null,
    atajadas !== undefined ? atajadas : null,
    id
  );

  // Notificar al jugador
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(stat.usuario_id);
  db.prepare(
    'INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES (?, ?, ?)'
  ).run(
    stat.usuario_id,
    'estadistica_aprobada',
    `✅ Tus estadísticas de la Semana ${stat.semana} fueron aprobadas`
  );

  res.json({ message: 'Estadísticas aprobadas' });
});

// PUT /api/stats/:id/reject — Admin rechaza con nota
router.put('/:id/reject', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { nota } = req.body;
  const db = getDb();

  const stat = db.prepare('SELECT * FROM estadisticas_semanales WHERE id = ?').get(id);
  if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

  db.prepare(`
    UPDATE estadisticas_semanales
    SET estado = 'rechazado', nota_admin = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nota || null, id);

  // Notificar al jugador
  db.prepare(
    'INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES (?, ?, ?)'
  ).run(
    stat.usuario_id,
    'estadistica_rechazada',
    `❌ Tus estadísticas de la Semana ${stat.semana} fueron rechazadas${nota ? ': ' + nota : '. Puedes volver a enviarlas.'}`
  );

  res.json({ message: 'Estadísticas rechazadas' });
});

// PUT /api/stats/:id — Admin edita estadísticas directamente
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { goles, asistencias, atajadas, estado } = req.body;
  const db = getDb();

  const stat = db.prepare('SELECT * FROM estadisticas_semanales WHERE id = ?').get(id);
  if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

  db.prepare(`
    UPDATE estadisticas_semanales
    SET goles = COALESCE(?, goles),
        asistencias = COALESCE(?, asistencias),
        atajadas = COALESCE(?, atajadas),
        estado = COALESCE(?, estado),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    goles !== undefined ? goles : null,
    asistencias !== undefined ? asistencias : null,
    atajadas !== undefined ? atajadas : null,
    estado || null,
    id
  );

  res.json({ message: 'Estadística actualizada' });
});

// DELETE /api/stats/:id — Admin elimina estadística
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const stat = db.prepare('SELECT * FROM estadisticas_semanales WHERE id = ?').get(id);
  if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

  db.prepare('DELETE FROM estadisticas_semanales WHERE id = ?').run(id);

  res.json({ message: 'Estadística eliminada' });
});

module.exports = router;
