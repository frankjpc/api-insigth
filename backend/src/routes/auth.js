const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'futsal_stats_secret_2024';

// POST /api/auth/login — Login o auto-registro
router.post('/login', (req, res) => {
  const { nombre, apellido, posicion, pin } = req.body;

  if (!nombre || !apellido || !posicion) {
    return res.status(400).json({ error: 'Nombre, apellido y posición son requeridos' });
  }

  const db = getDb();

  // Buscar si el usuario ya existe (por nombre + apellido)
  let usuario = db.prepare(
    'SELECT * FROM usuarios WHERE LOWER(nombre) = LOWER(?) AND LOWER(apellido) = LOWER(?)'
  ).get(nombre.trim(), apellido.trim());

  if (!usuario) {
    // ─── AUTO-REGISTRO: solo como jugador, nunca como admin ───────────────
    const result = db.prepare(
      'INSERT INTO usuarios (nombre, apellido, posicion, rol) VALUES (?, ?, ?, ?)'
    ).run(nombre.trim(), apellido.trim(), posicion.trim(), 'jugador');

    usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(result.lastInsertRowid);

    // Notificar a los admins del nuevo jugador
    const admins = db.prepare("SELECT id FROM usuarios WHERE rol = 'admin'").all();
    for (const admin of admins) {
      db.prepare(
        'INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES (?, ?, ?)'
      ).run(admin.id, 'nuevo_jugador', `Nuevo jugador registrado: ${usuario.nombre} ${usuario.apellido} (${usuario.posicion})`);
    }
  } else {
    // ─── LOGIN: usuario existente ─────────────────────────────────────────
    // Si la cuenta tiene PIN (admins), verificarlo obligatoriamente.
    // Usamos 200 + requiresPin:true para evitar que el interceptor de axios
    // captura el 401 y redirija antes de que el frontend pueda reaccionar.
    if (usuario.pin) {
      if (!pin) {
        return res.json({
          requiresPin: true,
          error: 'Esta cuenta requiere un PIN para acceder',
        });
      }
      if (String(pin).trim() !== String(usuario.pin).trim()) {
        return res.json({
          requiresPin: true,
          error: 'PIN incorrecto',
        });
      }
    }
  }

  const token = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      posicion: usuario.posicion,
      rol: usuario.rol,
    },
  });
});

module.exports = router;
