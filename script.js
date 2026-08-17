import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('main_modules').select('*').ilike('module_name', '%Return%');
  console.log(JSON.stringify(data, null, 2));
}
run();
