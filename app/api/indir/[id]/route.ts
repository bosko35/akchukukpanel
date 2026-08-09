import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, BUCKET } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * İndirme. Yetki kontrolü RLS üzerinden yapılır:
 * dosyayı göremeyen kullanıcı için sorgu boş döner.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });

  const { data: dosya } = await supabase
    .from('dosyalar')
    .select('id, ad, storage_path')
    .eq('id', id)
    .single();

  if (!dosya) {
    return NextResponse.json(
      { hata: 'Dosya bulunamadı veya erişim yetkiniz yok' },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(dosya.storage_path, 60, { download: dosya.ad });

  if (error || !data) {
    return NextResponse.json(
      { hata: 'İndirme linki oluşturulamadı' },
      { status: 500 }
    );
  }

  await admin
    .from('erisim_log')
    .insert({ dosya_id: dosya.id, kullanici_id: user.id, eylem: 'indirme' });

  return NextResponse.redirect(data.signedUrl);
}
