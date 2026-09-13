const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_KEY son requeridas en .env para ejecutar el seed.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  console.log('🌱 Poblando datos iniciales en Supabase...');

  // Usuarios iniciales
  const usuarios = [
    { nombre: 'Admin', apellido: 'Sistema', posicion: 'Ala', rol: 'admin', pin: '1234' },
    { nombre: 'Carlos', apellido: 'Rodríguez', posicion: 'Pívot', rol: 'jugador' },
    { nombre: 'Mateo', apellido: 'Fernández', posicion: 'Cierre', rol: 'jugador' },
    { nombre: 'Lucas', apellido: 'Gómez', posicion: 'Portero', rol: 'jugador' },
    { nombre: 'Santiago', apellido: 'López', posicion: 'Ala', rol: 'jugador' },
  ];

  for (const user of usuarios) {
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .ilike('nombre', user.nombre)
      .ilike('apellido', user.apellido)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('usuarios').insert([user]);
      if (error) {
        console.error(`Error insertando usuario ${user.nombre}:`, error.message);
      } else {
        console.log(`✅ Usuario creado: ${user.nombre} ${user.apellido} (${user.rol})`);
      }
    } else {
      console.log(`ℹ️ Usuario ya existente: ${user.nombre} ${user.apellido}`);
    }
  }

  console.log('🎉 Seed de Supabase completado con éxito.');
}

seed().catch((err) => {
  console.error('❌ Error general en seed:', err);
});
