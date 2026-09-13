const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — Notificaciones del usuario autenticado
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();

  const notifications = db.prepare(`
    SELECT * FROM notificaciones
    WHERE usuario_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);

  const unreadCount = db.prepare(
    'SELECT COUNT(*) as count FROM notificaciones WHERE usuario_id = ? AND leida = 0'
  ).get(req.user.id).count;

  res.json({ notifications, unreadCount });
});

// PUT /api/notifications/read-all — Marcar todas como leídas
router.put('/read-all', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?').run(req.user.id);
  res.json({ message: 'Todas las notificaciones marcadas como leídas' });
});

// PUT /api/notifications/:id/read — Marcar una como leída
router.put('/:id/read', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare(
    'UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?'
  ).run(req.params.id, req.user.id);
  res.json({ message: 'Notificación marcada como leída' });
});

// DELETE /api/notifications/:id — Eliminar notificación
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare(
    'DELETE FROM notificaciones WHERE id = ? AND usuario_id = ?'
  ).run(req.params.id, req.user.id);
  res.json({ message: 'Notificación eliminada' });
});

module.exports = router;
