const express = require('express');
const { supabase } = require('../db/supabase');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const isSupabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// GET /api/notifications — Notificaciones del usuario autenticado
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    if (isSupabaseConfigured()) {
      const { data: notifications, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const { count, error: countErr } = await supabase
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', userId)
        .eq('leida', 0);

      if (countErr) throw countErr;

      return res.json({ notifications: notifications || [], unreadCount: count || 0 });
    }

    const db = getDb();
    const notifications = db.prepare(`
      SELECT * FROM notificaciones
      WHERE usuario_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM notificaciones WHERE usuario_id = ? AND leida = 0'
    ).get(userId).count;

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Error GET notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all — Marcar todas como leídas
router.put('/read-all', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('notificaciones').update({ leida: 1 }).eq('usuario_id', userId);
      return res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    }

    const db = getDb();
    db.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?').run(userId);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    console.error('Error read-all notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read — Marcar una como leída
router.put('/:id/read', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('notificaciones').update({ leida: 1 }).eq('id', id).eq('usuario_id', userId);
      return res.json({ message: 'Notificación marcada como leída' });
    }

    const db = getDb();
    db.prepare('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?').run(id, userId);
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('Error read notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id — Eliminar notificación
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('notificaciones').delete().eq('id', id).eq('usuario_id', userId);
      return res.json({ message: 'Notificación eliminada' });
    }

    const db = getDb();
    db.prepare('DELETE FROM notificaciones WHERE id = ? AND usuario_id = ?').run(id, userId);
    res.json({ message: 'Notificación eliminada' });
  } catch (err) {
    console.error('Error delete notification:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
