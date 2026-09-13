const express = require('express');
const { supabase } = require('../db/supabase');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const isSupabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// GET /api/players — Lista de todos los jugadores
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select(`
          id, nombre, apellido, posicion, rol, created_at,
          estadisticas_semanales ( goles, asistencias, atajadas, estado )
        `)
        .eq('rol', 'jugador')
        .order('apellido', { ascending: true });

      if (error) throw error;

      const players = (usuarios || []).map((u) => {
        const aprobadas = (u.estadisticas_semanales || []).filter((es) => es.estado === 'aprobado');
        const total_goles = aprobadas.reduce((sum, s) => sum + (s.goles || 0), 0);
        const total_asistencias = aprobadas.reduce((sum, s) => sum + (s.asistencias || 0), 0);
        const total_atajadas = aprobadas.reduce((sum, s) => sum + (s.atajadas || 0), 0);
        return {
          id: u.id,
          nombre: u.nombre,
          apellido: u.apellido,
          posicion: u.posicion,
          rol: u.rol,
          created_at: u.created_at,
          total_goles,
          total_asistencias,
          total_atajadas,
        };
      });

      return res.json(players);
    }

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
  } catch (err) {
    console.error('Error al obtener jugadores:', err);
    res.status(500).json({ error: err.message || 'Error al obtener la lista de jugadores' });
  }
});

// PUT /api/players/:id/role — Cambiar rol de un usuario (admin only)
router.put('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;

  if (!['admin', 'jugador'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('usuarios').update({ rol }).eq('id', id);
      if (error) throw error;
      return res.json({ message: `Rol actualizado a ${rol}` });
    }

    const db = getDb();
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, id);
    res.json({ message: `Rol actualizado a ${rol}` });
  } catch (err) {
    console.error('Error al actualizar rol:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar el rol' });
  }
});

module.exports = router;
