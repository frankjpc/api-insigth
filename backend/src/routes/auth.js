const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabase');
const { getDb } = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'futsal_stats_secret_2024';

const isSupabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// POST /api/auth/login — Login o auto-registro
router.post('/login', async (req, res) => {
  const { nombre, apellido, posicion, pin } = req.body || {};

  if (!nombre || !apellido || !posicion) {
    return res.status(400).json({ error: 'Nombre, apellido y posición son requeridos' });
  }

  const cleanNombre = nombre.trim();
  const cleanApellido = apellido.trim();
  const cleanPosicion = posicion.trim();

  try {
    let usuario = null;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('nombre', cleanNombre)
        .ilike('apellido', cleanApellido)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error al buscar usuario en Supabase:', error);
      }
      usuario = data;

      if (!usuario) {
        const { data: newUser, error: insertError } = await supabase
          .from('usuarios')
          .insert([{ nombre: cleanNombre, apellido: cleanApellido, posicion: cleanPosicion, rol: 'jugador' }])
          .select()
          .single();

        if (insertError) {
          throw new Error('Error al registrar usuario en Supabase: ' + insertError.message);
        }
        usuario = newUser;

        const { data: admins } = await supabase.from('usuarios').select('id').eq('rol', 'admin');
        if (admins && admins.length > 0) {
          const notifs = admins.map((admin) => ({
            usuario_id: admin.id,
            tipo: 'nuevo_jugador',
            mensaje: `Nuevo jugador registrado: ${usuario.nombre} ${usuario.apellido} (${usuario.posicion})`,
          }));
          await supabase.from('notificaciones').insert(notifs);
        }
      } else {
        if (usuario.pin) {
          if (!pin) {
            return res.json({ requiresPin: true, error: 'Esta cuenta requiere un PIN para acceder' });
          }
          if (String(pin).trim() !== String(usuario.pin).trim()) {
            return res.json({ requiresPin: true, error: 'PIN incorrecto' });
          }
        }
      }
    } else {
      const db = getDb();
      usuario = db.prepare(
        'SELECT * FROM usuarios WHERE LOWER(nombre) = LOWER(?) AND LOWER(apellido) = LOWER(?)'
      ).get(cleanNombre, cleanApellido);

      if (!usuario) {
        const result = db.prepare(
          'INSERT INTO usuarios (nombre, apellido, posicion, rol) VALUES (?, ?, ?, ?)'
        ).run(cleanNombre, cleanApellido, cleanPosicion, 'jugador');

        usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(result.lastInsertRowid);

        const admins = db.prepare("SELECT id FROM usuarios WHERE rol = 'admin'").all();
        for (const admin of admins) {
          db.prepare(
            'INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES (?, ?, ?)'
          ).run(admin.id, 'nuevo_jugador', `Nuevo jugador registrado: ${usuario.nombre} ${usuario.apellido} (${usuario.posicion})`);
        }
      } else {
        if (usuario.pin) {
          if (!pin) {
            return res.json({ requiresPin: true, error: 'Esta cuenta requiere un PIN para acceder' });
          }
          if (String(pin).trim() !== String(usuario.pin).trim()) {
            return res.json({ requiresPin: true, error: 'PIN incorrecto' });
          }
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
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ error: err.message || 'Error al iniciar sesión' });
  }
});

module.exports = router;
