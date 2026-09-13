const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Multer — solo imagen_carta
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `carta_sem${req.body.semana || 'x'}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
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
router.get('/', (req, res) => {
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
});

// GET /api/player-of-week/:semana
router.get('/:semana', (req, res) => {
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
  `).get(parseInt(req.params.semana));
  res.json(record || null);
});

// POST /api/player-of-week — Admin publica carta (semana + tipo + imagen)
router.post('/', authenticateToken, requireAdmin, upload.single('imagen_carta'), (req, res) => {
  const { semana, tipo } = req.body;
  const db = getDb();

  if (!semana) {
    return res.status(400).json({ error: 'La semana es requerida' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'La imagen de la carta es requerida' });
  }

  const imagenCarta = `/uploads/${req.file.filename}`;
  const tipoFinal   = tipo || 'goleador';

  // Deshabilitar FK temporalmente — la tabla legacy tiene FK en usuario_id
  // pero ya no lo necesitamos (carta sin jugador vinculado)
  db.pragma('foreign_keys = OFF');
  try {
    const existing = db.prepare('SELECT id FROM jugador_semana WHERE semana = ?').get(parseInt(semana));

    if (existing) {
      db.prepare(`
        UPDATE jugador_semana
        SET imagen_carta = ?, tipo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE semana = ?
      `).run(imagenCarta, tipoFinal, parseInt(semana));
    } else {
      db.prepare(`
        INSERT INTO jugador_semana (semana, usuario_id, imagen_carta, tipo)
        VALUES (?, NULL, ?, ?)
      `).run(parseInt(semana), imagenCarta, tipoFinal);
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }

  res.json({ message: `Carta de la Semana ${semana} publicada correctamente` });
});

// DELETE /api/player-of-week/:semana
router.delete('/:semana', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM jugador_semana WHERE semana = ?').run(parseInt(req.params.semana));
  res.json({ message: 'Carta eliminada' });
});

module.exports = router;
