import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Yükleme tamamlandıktan sonra dosya kaydını oluşturur. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });
  }

  const govde = (await request.json()) as {
    ad: string;
    storage_path: string;
    boyut?: number;
    mime?: string;
    klasor?: string;
    yol?: string | null;
    aciklama?: string;
    gizli?: boolean;
    alan_sahibi?: string | null;
    izinliler?: string[];
  };

  if (!govde.ad || !govde.storage_path) {
    return NextResponse.json({ hata: 'Eksik bilgi' }, { status: 400 });
  }

  // Kullanıcı sadece kendi klasörüne yükleyebilir
  if (!govde.storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ hata: 'Geçersiz yol' }, { status: 403 });
  }

  const { data: dosya, error } = await supabase
    .from('dosyalar')
    .insert({
      ad: govde.ad,
      storage_path: govde.storage_path,
      boyut: govde.boyut ?? null,
      mime: govde.mime ?? null,
      klasor: (govde.klasor || 'Genel').trim() || 'Genel',
      yol: govde.yol?.trim() || null,
      aciklama: govde.aciklama?.trim() || null,
      gizli: !!govde.gizli,
      alan_sahibi: govde.alan_sahibi || null,
      sahip_id: user.id,
    })
    .select()
    .single();

  if (error || !dosya) {
    return NextResponse.json(
      { hata: error?.message || 'Kayıt oluşturulamadı' },
      { status: 500 }
    );
  }

  const izinliler = (govde.izinliler || []).filter((id) => id !== user.id);
  if (govde.gizli && izinliler.length) {
    await supabase.from('dosya_izinleri').insert(
      izinliler.map((kullanici_id) => ({
        dosya_id: dosya.id,
        kullanici_id,
      }))
    );
  }

  await createAdminClient()
    .from('erisim_log')
    .insert({ dosya_id: dosya.id, kullanici_id: user.id, eylem: 'yukleme' });

  return NextResponse.json({ dosya });
}
