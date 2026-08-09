import { createClient } from '@/lib/supabase/server';
import type { Profil } from '@/lib/types';

/**
 * Çağıranın yönetici olup olmadığını doğrular.
 * Yöneticiyse kullanıcı id'sini, değilse null döner.
 */
export async function yoneticiMi(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiller')
    .select('id, rol, aktif, onay_durumu')
    .eq('id', user.id)
    .single();

  const p = data as Pick<Profil, 'id' | 'rol' | 'aktif' | 'onay_durumu'> | null;
  if (!p || p.rol !== 'yonetici' || !p.aktif || p.onay_durumu !== 'onayli') {
    return null;
  }
  return p.id;
}
