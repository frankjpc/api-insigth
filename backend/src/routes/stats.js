const express = require('express');
const { supabase } = require('../db/supabase');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const isSupabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// GET /api/stats/leaderboard — Tabla general pública
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data: stats, error } = await supabase
        .from('estadisticas_semanales')
        .select('usuario_id, goles, asistencias, atajadas, semana, usuarios (nombre, apellido, posicion)')
        .eq('estado', 'aprobado');

      if (error) throw error;

      const userMap = {};
      (stats || []).forEach((row) => {
        const uId = row.usuario_id;
        const u = row.usuarios || {};
        if (!userMap[uId]) {
          userMap[uId] = {
            usuario_id: uId,
            nombre: u.nombre || '',
            apellido: u.apellido || '',
            posicion: u.posicion || '',
            total_goles: 0,
            total_asistencias: 0,
            total_atajadas: 0,
            semanas_set: new Set(),
          };
        }
        userMap[uId].total_goles += row.goles || 0;
        userMap[uId].total_asistencias += row.asistencias || 0;
        userMap[uId].total_atajadas += row.atajadas || 0;
        if (row.semana) userMap[uId].semanas_set.add(row.semana);
      });

      const result = Object.values(userMap).map((u) => ({
        usuario_id: u.usuario_id,
        nombre: u.nombre,
        apellido: u.apellido,
        posicion: u.posicion,
        total_goles: u.total_goles,
        total_asistencias: u.total_asistencias,
        total_atajadas: u.total_atajadas,
        semanas_jugadas: u.semanas_set.size,
      })).sort((a, b) => b.total_goles - a.total_goles || b.total_asistencias - a.total_asistencias || b.total_atajadas - a.total_atajadas);

      return res.json(result);
    }

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
  } catch (err) {
    console.error('Error leaderboard:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/me — Estadísticas propias del jugador
router.get('/me', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    if (isSupabaseConfigured()) {
      const { data: stats, error } = await supabase
        .from('estadisticas_semanales')
        .select('*')
        .eq('usuario_id', userId)
        .order('semana', { ascending: true });

      if (error) throw error;

      const aprobadas = (stats || []).filter((s) => s.estado === 'aprobado');
      const totales = {
        goles: aprobadas.reduce((sum, s) => sum + (s.goles || 0), 0),
        asistencias: aprobadas.reduce((sum, s) => sum + (s.asistencias || 0), 0),
        atajadas: aprobadas.reduce((sum, s) => sum + (s.atajadas || 0), 0),
      };

      return res.json({ semanas: stats || [], totales });
    }

    const db = getDb();
    const stats = db.prepare(`
      SELECT * FROM estadisticas_semanales 
      WHERE usuario_id = ? 
      ORDER BY semana ASC
    `).all(userId);

    const totales = db.prepare(`
      SELECT 
        COALESCE(SUM(goles), 0) as goles,
        COALESCE(SUM(asistencias), 0) as asistencias,
        COALESCE(SUM(atajadas), 0) as atajadas
      FROM estadisticas_semanales 
      WHERE usuario_id = ? AND estado = 'aprobado'
    `).get(userId);

    res.json({ semanas: stats, totales });
  } catch (err) {
    console.error('Error stats me:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stats — Jugador envía sus estadísticas de una semana
router.post('/', authenticateToken, async (req, res) => {
  const { semana, goles, asistencias, atajadas } = req.body;
  const userId = req.user.id;

  if (!semana || semana < 1 || semana > 6) {
    return res.status(400).json({ error: 'Semana inválida (1-6)' });
  }

  try {
    if (isSupabaseConfigured()) {
      const { data: existing } = await supabase
        .from('estadisticas_semanales')
        .select('*')
        .eq('usuario_id', userId)
        .eq('semana', semana)
        .maybeSingle();

      if (existing) {
        if (existing.estado === 'aprobado') {
          return res.status(400).json({ error: 'Las estadísticas de esta semana ya fueron aprobadas' });
        }
        await supabase
          .from('estadisticas_semanales')
          .update({
            goles: goles || 0,
            asistencias: asistencias || 0,
            atajadas: atajadas || 0,
            estado: 'pendiente',
            nota_admin: null,
            updated_at: new Date().toISOString(),
          })
          .eq('usuario_id', userId)
          .eq('semana', semana);
      } else {
        await supabase.from('estadisticas_semanales').insert([{
          usuario_id: userId,
          semana,
          goles: goles || 0,
          asistencias: asistencias || 0,
          atajadas: atajadas || 0,
          estado: 'pendiente',
        }]);
      }

      // Notificar a todos los admins
      const { data: admins } = await supabase.from('usuarios').select('id').eq('rol', 'admin');
      const { data: usuario } = await supabase.from('usuarios').select('nombre, apellido').eq('id', userId).single();

      if (admins && admins.length > 0 && usuario) {
        const notifs = admins.map((a) => ({
          usuario_id: a.id,
          tipo: 'estadistica_pendiente',
          mensaje: `${usuario.nombre} ${usuario.apellido} envió estadísticas de la Semana ${semana}`,
        }));
        await supabase.from('notificaciones').insert(notifs);
      }

      return res.json({ message: 'Estadísticas enviadas. Pendiente de aprobación.' });
    }

    const db = getDb();
    const existing = db.prepare(
      'SELECT * FROM estadisticas_semanales WHERE usuario_id = ? AND semana = ?'
    ).get(userId, semana);

    if (existing) {
      if (existing.estado === 'aprobado') {
        return res.status(400).json({ error: 'Las estadísticas de esta semana ya fueron aprobadas' });
      }
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
  } catch (err) {
    console.error('Error enviando estadísticas:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/pending — Admin: lista de pendientes
router.get('/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data: pending, error } = await supabase
        .from('estadisticas_semanales')
        .select('*, usuarios (nombre, apellido, posicion)')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (pending || []).map((es) => ({
        ...es,
        nombre: es.usuarios?.nombre,
        apellido: es.usuarios?.apellido,
        posicion: es.usuarios?.posicion,
      }));

      return res.json(formatted);
    }

    const db = getDb();
    const pending = db.prepare(`
      SELECT es.*, u.nombre, u.apellido, u.posicion
      FROM estadisticas_semanales es
      JOIN usuarios u ON es.usuario_id = u.id
      WHERE es.estado = 'pendiente'
      ORDER BY es.created_at DESC
    `).all();

    res.json(pending);
  } catch (err) {
    console.error('Error stats pending:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/all — Admin: todas las estadísticas aprobadas
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  const { semana } = req.query;

  try {
    if (isSupabaseConfigured()) {
      let query = supabase
        .from('estadisticas_semanales')
        .select('*, usuarios (nombre, apellido, posicion)')
        .eq('estado', 'aprobado');

      if (semana) {
        query = query.eq('semana', parseInt(semana));
      }

      const { data: rawStats, error } = await query;
      if (error) throw error;

      const stats = (rawStats || []).map((es) => ({
        ...es,
        nombre: es.usuarios?.nombre,
        apellido: es.usuarios?.apellido,
        posicion: es.usuarios?.posicion,
      })).sort((a, b) => (a.apellido || '').localeCompare(b.apellido || '') || a.semana - b.semana);

      // Totales por jugador
      const userTotalsMap = {};
      (rawStats || []).forEach((es) => {
        const uId = es.usuario_id;
        const u = es.usuarios || {};
        if (!userTotalsMap[uId]) {
          userTotalsMap[uId] = {
            usuario_id: uId,
            nombre: u.nombre || '',
            apellido: u.apellido || '',
            posicion: u.posicion || '',
            total_goles: 0,
            total_asistencias: 0,
            total_atajadas: 0,
          };
        }
        userTotalsMap[uId].total_goles += es.goles || 0;
        userTotalsMap[uId].total_asistencias += es.asistencias || 0;
        userTotalsMap[uId].total_atajadas += es.atajadas || 0;
      });

      const totalesPorJugador = Object.values(userTotalsMap).sort((a, b) => b.total_goles - a.total_goles);

      return res.json({ stats, totalesPorJugador });
    }

    const db = getDb();
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
  } catch (err) {
    console.error('Error stats all:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stats/:id/approve — Admin aprueba (y opcionalmente edita)
router.put('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { goles, asistencias, atajadas } = req.body;

  try {
    if (isSupabaseConfigured()) {
      const { data: stat } = await supabase.from('estadisticas_semanales').select('*').eq('id', id).single();
      if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

      const updates = {
        estado: 'aprobado',
        updated_at: new Date().toISOString(),
      };
      if (goles !== undefined) updates.goles = goles;
      if (asistencias !== undefined) updates.asistencias = asistencias;
      if (atajadas !== undefined) updates.atajadas = atajadas;

      await supabase.from('estadisticas_semanales').update(updates).eq('id', id);

      await supabase.from('notificaciones').insert([{
        usuario_id: stat.usuario_id,
        tipo: 'estadistica_aprobada',
        mensaje: `✅ Tus estadísticas de la Semana ${stat.semana} fueron aprobadas`,
      }]);

      return res.json({ message: 'Estadísticas aprobadas' });
    }

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

    db.prepare(
      'INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES (?, ?, ?)'
    ).run(
      stat.usuario_id,
      'estadistica_aprobada',
      `✅ Tus estadísticas de la Semana ${stat.semana} fueron aprobadas`
    );

    res.json({ message: 'Estadísticas aprobadas' });
  } catch (err) {
    console.error('Error al aprobar estadística:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stats/:id/reject — Admin rechaza con nota
router.put('/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nota } = req.body;

  try {
    if (isSupabaseConfigured()) {
      const { data: stat } = await supabase.from('estadisticas_semanales').select('*').eq('id', id).single();
      if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

      await supabase.from('estadisticas_semanales').update({
        estado: 'rechazado',
        nota_admin: nota || null,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      await supabase.from('notificaciones').insert([{
        usuario_id: stat.usuario_id,
        tipo: 'estadistica_rechazada',
        mensaje: `❌ Tus estadísticas de la Semana ${stat.semana} fueron rechazadas${nota ? ': ' + nota : '. Puedes volver a enviarlas.'}`,
      }]);

      return res.json({ message: 'Estadísticas rechazadas' });
    }

    const db = getDb();
    const stat = db.prepare('SELECT * FROM estadisticas_semanales WHERE id = ?').get(id);
    if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

    db.prepare(`
      UPDATE estadisticas_semanales
      SET estado = 'rechazado', nota_admin = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nota || null, id);

    db.prepare(
      'INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES (?, ?, ?)'
    ).run(
      stat.usuario_id,
      'estadistica_rechazada',
      `❌ Tus estadísticas de la Semana ${stat.semana} fueron rechazadas${nota ? ': ' + nota : '. Puedes volver a enviarlas.'}`
    );

    res.json({ message: 'Estadísticas rechazadas' });
  } catch (err) {
    console.error('Error al rechazar estadística:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stats/:id — Admin edita estadísticas directamente
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { goles, asistencias, atajadas, estado } = req.body;

  try {
    if (isSupabaseConfigured()) {
      const updates = { updated_at: new Date().toISOString() };
      if (goles !== undefined) updates.goles = goles;
      if (asistencias !== undefined) updates.asistencias = asistencias;
      if (atajadas !== undefined) updates.atajadas = atajadas;
      if (estado !== undefined) updates.estado = estado;

      await supabase.from('estadisticas_semanales').update(updates).eq('id', id);
      return res.json({ message: 'Estadística actualizada' });
    }

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
  } catch (err) {
    console.error('Error al actualizar estadística:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stats/:id — Admin elimina estadística
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    if (isSupabaseConfigured()) {
      await supabase.from('estadisticas_semanales').delete().eq('id', id);
      return res.json({ message: 'Estadística eliminada' });
    }

    const db = getDb();
    const stat = db.prepare('SELECT * FROM estadisticas_semanales WHERE id = ?').get(id);
    if (!stat) return res.status(404).json({ error: 'Estadística no encontrada' });

    db.prepare('DELETE FROM estadisticas_semanales WHERE id = ?').run(id);

    res.json({ message: 'Estadística eliminada' });
  } catch (err) {
    console.error('Error al eliminar estadística:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
