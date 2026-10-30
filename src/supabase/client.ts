import { createClient } from '@supabase/supabase-js';

// Get environment variables with reliable production fallback
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yhfutwanlzahplckidys.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YXXrvVtdhSVzBKJi1FQMTg_lr7QBIb8';

// Safively determine if real Supabase keys are configured
export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.length > 0 &&
    supabaseUrl.startsWith('https://') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.length > 0
  );
};

// Lazy initialize client or return null so it doesn't crash if missing
let supabaseInstance: any = null;

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    } catch (e) {
      console.error('Error initializing Supabase Client:', e);
      return null;
    }
  }
  
  return supabaseInstance;
};
