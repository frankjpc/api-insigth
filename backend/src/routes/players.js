const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/players — Lista de todos los jugadores
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();

  const players = db.prepare(`
    SELECT u.id, u.nombre, u.apellido, u.posicion, u.rol, u.created_at,
      COALESCE(SUM(CASE WHEN es.estado = 'aprobado' THEN es.goles ELSE 0 END), 0) as total_goles,
      COALESCE(SUM(CASE WHEN es.estado = 'aprobado' THEN es.asistencias ELSE 0 END), 0) as total_asistencias,
      COALESCE(SUM(CASE WHEN es.estado = 'aprobado' THEN es.atajadas ELSE 0 END), 0) as total_atajadas
    FROM usuarios u
    LEFT JOIN estadisticas_semanales es ON u.id = es.usuario_id
    WHERE u.rol = 'jugador'
    GROUP BY u.id
    ORDER BY u.apellido ASC
  `).all();

  res.json(players);
});

// PUT /api/players/:id/role — Cambiar rol de un usuario (admin only)
router.put('/:id/role', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;
  const db = getDb();

  if (!['admin', 'jugador'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, id);
  res.json({ message: `Rol actualizado a ${rol}` });
});

module.exports = router;
