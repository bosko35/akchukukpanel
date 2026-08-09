import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, BUCKET } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Dosyanın içeriğini yeni sürümle değiştirir (üzerine yazma).
 * Yeni dosya önce imzalı linkle depolamaya yüklenir, sonra bu uç çağrılır.
 * Kayıt güncellenir ve eski depolama nesnesi silinir.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });

  const govde = (await request.json()) as {
    storage_path: string;
    ad: string;
    boyut?: number;
    mime?: string;
  };

  if (!govde.storage_path || !govde.ad) {
    return NextResponse.json({ hata: 'Eksik bilgi' }, { status: 400 });
  }

  if (!govde.storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ hata: 'Geçersiz yol' }, { status: 403 });
  }

  // Eski yolu al (RLS: göremediğin dosya null döner)
  const { data: eski } = await supabase
    .from('dosyalar')
    .select('id, storage_path')
    .eq('id', id)
    .single();

  if (!eski) {
    return NextResponse.json({ hata: 'Dosya bulunamadı' }, { status: 404 });
  }

  // RLS sadece sahibi/yöneticiye güncelleme izni verir
  const { data: guncel, error } = await supabase
    .from('dosyalar')
    .update({
      ad: govde.ad,
      storage_path: govde.storage_path,
      boyut: govde.boyut ?? null,
      mime: govde.mime ?? null,
      guncelleme_at: new Date().toISOString(),
      guncelleyen_id: user.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !guncel) {
    // Güncelleme başarısızsa yeni yüklenen dosyayı geri al
    await createAdminClient().storage.from(BUCKET).remove([govde.storage_path]);
    return NextResponse.json(
      { hata: 'Bu dosyayı değiştirme yetkiniz yok' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  if (eski.storage_path !== govde.storage_path) {
    await admin.storage.from(BUCKET).remove([eski.storage_path]);
  }
  await admin
    .from('erisim_log')
    .insert({ dosya_id: id, kullanici_id: user.id, eylem: 'degistirme' });

  return NextResponse.json({ dosya: guncel });
}
