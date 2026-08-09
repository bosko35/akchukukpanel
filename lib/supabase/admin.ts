import { createClient } from '@supabase/supabase-js';

/**
 * SADECE SUNUCUDA kullanılır. RLS'i baypas eder.
 * Depolamaya imzalı yükleme/indirme linki üretmek ve log yazmak için.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export const BUCKET = process.env.SUPABASE_BUCKET || 'dosyalar';
