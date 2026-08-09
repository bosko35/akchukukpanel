import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, BUCKET } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

/** Gizlilik ve kişi izinlerini günceller. Sadece dosya sahibi veya yönetici. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });

  const { gizli, izinliler, klasor, aciklama, alan_sahibi } =
    (await request.json()) as {
      gizli?: boolean;
      izinliler?: string[];
      klasor?: string;
      aciklama?: string;
      alan_sahibi?: string | null;
    };

  const guncelleme: Record<string, unknown> = {};
  if (typeof gizli === 'boolean') guncelleme.gizli = gizli;
  if (typeof klasor === 'string') guncelleme.klasor = klasor.trim() || 'Genel';
  if (typeof aciklama === 'string')
    guncelleme.aciklama = aciklama.trim() || null;
  if (alan_sahibi !== undefined) guncelleme.alan_sahibi = alan_sahibi || null;

  if (Object.keys(guncelleme).length) {
    // RLS zaten sadece sahibi/yöneticiye izin verir
    const { error } = await supabase
      .from('dosyalar')
      .update(guncelleme)
      .eq('id', id);
    if (error)
      return NextResponse.json({ hata: error.message }, { status: 403 });
  }

  if (Array.isArray(izinliler)) {
    await supabase.from('dosya_izinleri').delete().eq('dosya_id', id);
    const temiz = izinliler.filter((x) => x && x !== user.id);
    if (temiz.length) {
      const { error } = await supabase.from('dosya_izinleri').insert(
        temiz.map((kullanici_id) => ({ dosya_id: id, kullanici_id }))
      );
      if (error)
        return NextResponse.json({ hata: error.message }, { status: 403 });
    }
  }

  return NextResponse.json({ tamam: true });
}

/** Dosyayı hem kayıttan hem depolamadan siler. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });

  const { data: dosya } = await supabase
    .from('dosyalar')
    .select('id, storage_path')
    .eq('id', id)
    .single();

  if (!dosya)
    return NextResponse.json({ hata: 'Dosya bulunamadı' }, { status: 404 });

  const { error } = await supabase.from('dosyalar').delete().eq('id', id);
  if (error)
    return NextResponse.json(
      { hata: 'Bu dosyayı silme yetkiniz yok' },
      { status: 403 }
    );

  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([dosya.storage_path]);
  await admin
    .from('erisim_log')
    .insert({ dosya_id: null, kullanici_id: user.id, eylem: 'silme' });

  return NextResponse.json({ tamam: true });
}
