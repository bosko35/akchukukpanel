import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, BUCKET } from '@/lib/supabase/admin';

const MAX_BOYUT = 50 * 1024 * 1024; // 50 MB

const TR_HARITA: Record<string, string> = {
  ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
  ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
};

/** Depolama yolu için güvenli dosya adı (Türkçe karakterler sadeleştirilir). */
function guvenliAd(ad: string) {
  return ad
    .split('')
    .map((h) => TR_HARITA[h] ?? h)
    .join('')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

/** Tarayıcının doğrudan Supabase'e yükleyebilmesi için imzalı yükleme linki üretir. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });
  }

  const { ad, boyut } = (await request.json()) as {
    ad?: string;
    boyut?: number;
  };

  if (!ad) {
    return NextResponse.json({ hata: 'Dosya adı gerekli' }, { status: 400 });
  }
  if (typeof boyut === 'number' && boyut > MAX_BOYUT) {
    return NextResponse.json(
      { hata: 'Dosya 50 MB sınırını aşıyor' },
      { status: 400 }
    );
  }

  const path = `${user.id}/${crypto.randomUUID()}-${guvenliAd(ad)}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { hata: 'Yükleme linki oluşturulamadı' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bucket: BUCKET,
    path: data.path,
    token: data.token,
  });
}
