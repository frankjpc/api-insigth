const express = require('express');
const multer = require('multer');
const path = require('path');
const { supabase } = require('../db/supabase');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const isSupabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// Memory storage for Supabase upload, Disk storage for local fallback
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
    }
  },
});

// GET /api/player-of-week — Todos los jugadores de la semana
router.get('/', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      // Fetch sin join automático para evitar error PGRST200 cuando la FK no está en el schema cache
      const { data, error } = await supabase
        .from('jugador_semana')
        .select('*')
        .order('semana', { ascending: true });

      if (error) throw error;

      // Para cada carta, buscar el usuario por separado si tiene usuario_id
      const records = await Promise.all((data || []).map(async (js) => {
        let nombre = '', apellido = '', posicion = '';
        if (js.usuario_id) {
          const { data: u } = await supabase.from('usuarios').select('nombre, apellido, posicion').eq('id', js.usuario_id).maybeSingle();
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
      // Fetch sin join automático para evitar error PGRST200
      const { data, error } = await supabase
        .from('jugador_semana')
        .select('*')
        .eq('semana', semana)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return res.json(null);

      let nombre = '', apellido = '', posicion = '';
      if (data.usuario_id) {
        const { data: u } = await supabase.from('usuarios').select('nombre, apellido, posicion').eq('id', data.usuario_id).maybeSingle();
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

// POST /api/player-of-week — Admin publica carta
router.post('/', authenticateToken, requireAdmin, upload.single('imagen_carta'), async (req, res) => {
  const { semana, tipo } = req.body;
  if (!semana) {
    return res.status(400).json({ error: 'La semana es requerida' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'La imagen de la carta es requerida' });
  }

  const numSemana = parseInt(semana);
  const tipoFinal = tipo || 'goleador';

  try {
    let imagenCartaUrl = '';

    if (isSupabaseConfigured()) {
      const ext = path.extname(req.file.originalname) || '.png';
      const fileName = `carta_sem${numSemana}_${Date.now()}${ext}`;

      // Upload file buffer to Supabase Storage bucket 'cartas'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cartas')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        console.error('Error subiendo imagen a Supabase Storage:', uploadError);
        throw new Error('No se pudo subir la imagen a Supabase Storage: ' + uploadError.message);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage.from('cartas').getPublicUrl(fileName);
      imagenCartaUrl = publicUrlData.publicUrl;

      // Upsert into Supabase DB
      const { data: existing } = await supabase
        .from('jugador_semana')
        .select('id')
        .eq('semana', numSemana)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('jugador_semana')
          .update({
            imagen_carta: imagenCartaUrl,
            tipo: tipoFinal,
            updated_at: new Date().toISOString(),
          })
          .eq('semana', numSemana);
      } else {
        await supabase.from('jugador_semana').insert([{
          semana: numSemana,
          usuario_id: null,
          imagen_carta: imagenCartaUrl,
          tipo: tipoFinal,
        }]);
      }
    } else {
      // Local fallback: guardar en /uploads
      const fs = require('fs');
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const ext = path.extname(req.file.originalname) || '.png';
      const fileName = `carta_sem${numSemana}_${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);

      imagenCartaUrl = `/uploads/${fileName}`;

      const db = getDb();
      db.pragma('foreign_keys = OFF');
      try {
        const existing = db.prepare('SELECT id FROM jugador_semana WHERE semana = ?').get(numSemana);
        if (existing) {
          db.prepare(`
            UPDATE jugador_semana
            SET imagen_carta = ?, tipo = ?, updated_at = CURRENT_TIMESTAMP
            WHERE semana = ?
          `).run(imagenCartaUrl, tipoFinal, numSemana);
        } else {
          db.prepare(`
            INSERT INTO jugador_semana (semana, usuario_id, imagen_carta, tipo)
            VALUES (?, NULL, ?, ?)
          `).run(numSemana, imagenCartaUrl, tipoFinal);
        }
      } finally {
        db.pragma('foreign_keys = ON');
      }
    }

    res.json({ message: `Carta de la Semana ${numSemana} publicada correctamente`, imagen_carta: imagenCartaUrl });
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
