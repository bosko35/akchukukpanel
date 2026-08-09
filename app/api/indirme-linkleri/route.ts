import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, BUCKET } from '@/lib/supabase/admin';

const MAX_ADET = 300;

/**
 * Seçilen dosyalar için toplu imzalı indirme linki üretir.
 * Yetki kontrolü RLS ile: göremediğin dosya sorgudan hiç dönmez.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });

  const { ids } = (await request.json()) as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ hata: 'Dosya seçilmedi' }, { status: 400 });
  }
  if (ids.length > MAX_ADET) {
    return NextResponse.json(
      { hata: `Tek seferde en fazla ${MAX_ADET} dosya indirilebilir.` },
      { status: 400 }
    );
  }

  const { data: dosyalar } = await supabase
    .from('dosyalar')
    .select('id, ad, klasor, yol, storage_path')
    .in('id', ids);

  if (!dosyalar || dosyalar.length === 0) {
    return NextResponse.json({ hata: 'Erişilebilir dosya yok' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: linkler, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(
      dosyalar.map((d) => d.storage_path),
      300 // 5 dakika
    );

  if (error || !linkler) {
    return NextResponse.json(
      { hata: 'İndirme linkleri oluşturulamadı' },
      { status: 500 }
    );
  }

  const urlHarita = new Map(linkler.map((l) => [l.path, l.signedUrl]));

  const sonuc = dosyalar
    .map((d) => ({
      id: d.id,
      ad: d.ad,
      klasor: d.klasor,
      yol: d.yol as string | null,
      url: urlHarita.get(d.storage_path) || null,
    }))
    .filter((d) => d.url);

  await admin.from('erisim_log').insert(
    sonuc.map((d) => ({
      dosya_id: d.id,
      kullanici_id: user.id,
      eylem: 'toplu-indirme',
    }))
  );

  return NextResponse.json({ dosyalar: sonuc });
}
