const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

let rawUrl = (process.env.SUPABASE_URL || '').trim();
// Limpiar '/rest/v1/' o slashes finales si fueron pegados accidentalmente
rawUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const SUPABASE_URL = rawUrl;
const SUPABASE_KEY = (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_KEY no están definidas en las variables de entorno.');
}

const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder'
);

module.exports = { supabase };
