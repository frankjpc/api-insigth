const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeTables();
    migrateColumns();
  }
  return db;
}

function initializeTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      posicion TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'jugador',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS estadisticas_semanales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      semana INTEGER NOT NULL CHECK(semana BETWEEN 1 AND 6),
      goles INTEGER DEFAULT 0,
      asistencias INTEGER DEFAULT 0,
      atajadas INTEGER DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobado','rechazado')),
      nota_admin TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      UNIQUE(usuario_id, semana)
    );

    CREATE TABLE IF NOT EXISTS jugador_semana (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semana INTEGER NOT NULL,
      usuario_id INTEGER DEFAULT 0,
      imagen_url TEXT,
      imagen_carta TEXT,
      tipo TEXT DEFAULT 'goleador',
      destacado TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(semana, tipo)
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      leida INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `);
}

function migrateColumns() {
  const migrations = [
    { table: 'jugador_semana', column: 'imagen_carta', def: 'TEXT' },
    { table: 'jugador_semana', column: 'tipo',         def: "TEXT DEFAULT 'goleador'" },
    { table: 'jugador_semana', column: 'updated_at',   def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    { table: 'estadisticas_semanales', column: 'updated_at', def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    { table: 'usuarios',       column: 'pin',          def: 'TEXT' },
  ];
  for (const { table, column, def } of migrations) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    } catch { /* columna ya existe */ }
  }

  // Eliminar la restricción NOT NULL y FOREIGN KEY de usuario_id en jugador_semana
  // (SQLite no soporta DROP CONSTRAINT, así que se recrea la tabla)
  migrateJugadorSemana();
}

function migrateJugadorSemana() {
  // Verificar si la columna tiene NOT NULL comprobando el schema
  const tableInfo = db.prepare("PRAGMA table_info(jugador_semana)").all();
  const col = tableInfo.find(c => c.name === 'usuario_id');

  // Si notnull = 1, necesitamos reconstruir la tabla
  if (col && col.notnull === 1) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      BEGIN TRANSACTION;

      -- Crear tabla nueva sin restricciones en usuario_id
      CREATE TABLE jugador_semana_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        semana      INTEGER NOT NULL UNIQUE,
        usuario_id  INTEGER DEFAULT NULL,
        imagen_url  TEXT,
        imagen_carta TEXT,
        tipo        TEXT DEFAULT 'goleador',
        destacado   TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Copiar datos existentes
      INSERT INTO jugador_semana_new
        SELECT id, semana, usuario_id, imagen_url,
               imagen_carta, tipo, destacado, created_at, updated_at
        FROM jugador_semana;

      -- Reemplazar
      DROP TABLE jugador_semana;
      ALTER TABLE jugador_semana_new RENAME TO jugador_semana;

      COMMIT;
    `);
    db.pragma('foreign_keys = ON');
  }
}

module.exports = { getDb };
