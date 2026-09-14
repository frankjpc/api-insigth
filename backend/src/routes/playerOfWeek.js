const express = require('express');
const { supabase } = require('../db/supabase');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const isSupabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

// La imagen llega como base64 desde el frontend (data:image/...;base64,...)
// o como texto vacío/null. No usamos Supabase Storage — la guardamos en la BD.
function extractBase64(rawImg) {
  if (!rawImg) return null;
  // Si ya viene con prefijo data:..., lo devolvemos tal cual
  if (rawImg.startsWith('data:')) return rawImg;
  return rawImg;
}

// GET /api/player-of-week — Todos los jugadores de la semana
router.get('/', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('jugador_semana')
        .select('*')
        .order('semana', { ascending: true });

      if (error) throw error;

      // Para cada carta, buscar el usuario por separado si tiene usuario_id
      const records = await Promise.all((data || []).map(async (js) => {
        let nombre = '', apellido = '', posicion = '';
        if (js.usuario_id) {
          const { data: u } = await supabase
            .from('usuarios')
            .select('nombre, apellido, posicion')
            .eq('id', js.usuario_id)
            .maybeSingle();
          if (u) { nombre = u.nombre; apellido = u.apellido; posicion = u.posicion; }
        }
        return { ...js, nombre, apellido, posicion, total_goles: 0, total_asistencias: 0, total_atajadas: 0 };
      }));

      return res.json(records);
    }

    const db = getDb();
    const records = db.prepare(`
      SELECT js.*,
        COALESCE(u.nombre, '') as nombre,
        COALESCE(u.apellido, '') as apellido,
        COALESCE(u.posicion, '') as posicion,
        0 as total_goles, 0 as total_asistencias, 0 as total_atajadas
      FROM jugador_semana js
      LEFT JOIN usuarios u ON js.usuario_id = u.id
      ORDER BY js.semana ASC
    `).all();
    res.json(records);
  } catch (err) {
    console.error('Error GET player-of-week:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/player-of-week/:semana
router.get('/:semana', async (req, res) => {
  const semana = parseInt(req.params.semana);
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('jugador_semana')
        .select('*')
        .eq('semana', semana)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return res.json(null);

      let nombre = '', apellido = '', posicion = '';
      if (data.usuario_id) {
        const { data: u } = await supabase
          .from('usuarios')
          .select('nombre, apellido, posicion')
          .eq('id', data.usuario_id)
          .maybeSingle();
        if (u) { nombre = u.nombre; apellido = u.apellido; posicion = u.posicion; }
      }

      return res.json({
        ...data,
        nombre,
        apellido,
        posicion,
        total_goles: 0,
        total_asistencias: 0,
        total_atajadas: 0,
      });
    }

    const db = getDb();
    const record = db.prepare(`
      SELECT js.*,
        COALESCE(u.nombre, '') as nombre,
        COALESCE(u.apellido, '') as apellido,
        COALESCE(u.posicion, '') as posicion,
        0 as total_goles, 0 as total_asistencias, 0 as total_atajadas
      FROM jugador_semana js
      LEFT JOIN usuarios u ON js.usuario_id = u.id
      WHERE js.semana = ?
    `).get(semana);
    res.json(record || null);
  } catch (err) {
    console.error('Error GET player-of-week por semana:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/player-of-week — Admin publica carta (imagen como base64 en JSON)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { semana, tipo, imagen_carta } = req.body || {};

  if (!semana) {
    return res.status(400).json({ error: 'La semana es requerida' });
  }
  if (!imagen_carta) {
    return res.status(400).json({ error: 'La imagen de la carta es requerida' });
  }

  const numSemana = parseInt(semana);
  const tipoFinal = tipo || 'goleador';
  const imagenBase64 = extractBase64(imagen_carta);

  try {
    if (isSupabaseConfigured()) {
      // Verificar si ya existe una carta para esta semana
      const { data: existing } = await supabase
        .from('jugador_semana')
        .select('id')
        .eq('semana', numSemana)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from('jugador_semana')
          .update({
            imagen_carta: imagenBase64,
            tipo: tipoFinal,
            updated_at: new Date().toISOString(),
          })
          .eq('semana', numSemana);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('jugador_semana').insert([{
          semana: numSemana,
          usuario_id: null,
          imagen_carta: imagenBase64,
          tipo: tipoFinal,
        }]);
        if (insErr) throw insErr;
      }
    } else {
      const db = getDb();
      db.pragma('foreign_keys = OFF');
      try {
        const existing = db.prepare('SELECT id FROM jugador_semana WHERE semana = ?').get(numSemana);
        if (existing) {
          db.prepare(`
            UPDATE jugador_semana
            SET imagen_carta = ?, tipo = ?, updated_at = CURRENT_TIMESTAMP
            WHERE semana = ?
          `).run(imagenBase64, tipoFinal, numSemana);
        } else {
          db.prepare(`
            INSERT INTO jugador_semana (semana, usuario_id, imagen_carta, tipo)
            VALUES (?, NULL, ?, ?)
          `).run(numSemana, imagenBase64, tipoFinal);
        }
      } finally {
        db.pragma('foreign_keys = ON');
      }
    }

    res.json({ message: `Carta de la Semana ${numSemana} publicada correctamente` });
  } catch (err) {
    console.error('Error publicando carta:', err);
    res.status(500).json({ error: err.message || 'Error al publicar carta' });
  }
});

// DELETE /api/player-of-week/:semana
router.delete('/:semana', authenticateToken, requireAdmin, async (req, res) => {
  const numSemana = parseInt(req.params.semana);
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('jugador_semana').delete().eq('semana', numSemana);
      return res.json({ message: 'Carta eliminada' });
    }

    const db = getDb();
    db.prepare('DELETE FROM jugador_semana WHERE semana = ?').run(numSemana);
    res.json({ message: 'Carta eliminada' });
  } catch (err) {
    console.error('Error eliminando carta:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
