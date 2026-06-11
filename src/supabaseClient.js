import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect if Supabase is fully configured
export const isSupabaseConfigured = 
  supabaseUrl.trim() !== '' && 
  supabaseAnonKey.trim() !== '' && 
  supabaseUrl !== 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co' &&
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

// Initialize client (or null if not configured)
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
