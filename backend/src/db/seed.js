const { getDb } = require('./database');

function seed() {
  const db = getDb();

  // Crear admin por defecto
  const existing = db.prepare('SELECT * FROM usuarios WHERE nombre = ? AND apellido = ?').get('Admin', 'Sistema');
  if (!existing) {
    db.prepare(`
      INSERT INTO usuarios (nombre, apellido, posicion, rol) VALUES (?, ?, ?, ?)
    `).run('Admin', 'Sistema', 'Administrador', 'admin');
    console.log('✅ Admin creado: "Admin Sistema" - posición: Administrador');
  } else {
    console.log('ℹ️  Admin ya existe');
  }

  console.log('✅ Base de datos inicializada correctamente');
}

seed();
