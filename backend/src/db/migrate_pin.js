const { getDb } = require('./database');
const db = getDb();

// 1. Agregar columna pin si no existe
try {
  db.prepare('ALTER TABLE usuarios ADD COLUMN pin TEXT DEFAULT NULL').run();
  console.log('✅ Columna pin agregada a usuarios');
} catch (e) {
  console.log('ℹ️  Columna pin ya existe');
}

// 2. Asignar PIN por defecto al admin — CÁMBIALO después
const DEFAULT_ADMIN_PIN = '1234';
const result = db.prepare(
  "UPDATE usuarios SET pin = ? WHERE rol = 'admin'"
).run(DEFAULT_ADMIN_PIN);

console.log(`✅ PIN asignado a ${result.changes} admin(s)`);

// 3. Mostrar estado
const admins = db.prepare("SELECT id, nombre, apellido, posicion, rol, pin FROM usuarios WHERE rol = 'admin'").all();
console.log('Admins:', JSON.stringify(admins, null, 2));

console.log('\n⚠️  PIN por defecto: 1234 — Cámbialo con:');
console.log("   UPDATE usuarios SET pin='NUEVO_PIN' WHERE rol='admin'");
