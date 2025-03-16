import 'dotenv/config';
import { createClient } from '@supabase/supabase-js'
import { FIXTURES_TABLE } from './schema/fixtures';

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL is not defined');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
}
if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY is not defined');
}

// Create admin client for API operations
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Export schema and clients
export { FIXTURES_TABLE };
export { supabase as db };  