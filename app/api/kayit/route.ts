import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Herkese açık kayıt. Hesap oluşturulur ama "bekliyor" durumundadır;
 * yönetici onaylayana kadar panele erişemez.
 * E-posta doğrulaması yapılmaz (email_confirm: true) — hiç mail gönderilmez.
 */
export async function POST(request: Request) {
  const { eposta, sifre, ad_soyad } = (await request.json()) as {
    eposta?: string;
    sifre?: string;
    ad_soyad?: string;
  };

  const mail = eposta?.trim().toLowerCase();

  if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return NextResponse.json({ hata: 'Geçerli bir e-posta girin.' }, { status: 400 });
  }
  if (!sifre || sifre.length < 8) {
    return NextResponse.json(
      { hata: 'Şifre en az 8 karakter olmalı.' },
      { status: 400 }
    );
  }
  if (!ad_soyad?.trim()) {
    return NextResponse.json({ hata: 'Ad soyad gerekli.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: mail,
    password: sifre,
    email_confirm: true, // doğrulama maili gönderilmesin
    user_metadata: { ad_soyad: ad_soyad.trim(), sifre_belirlendi: true },
  });

  if (error || !data.user) {
    const ham = error?.message || 'bilinmeyen hata';
    const m = ham.toLowerCase();

    console.error('[kayit] createUser hatası:', ham);

    if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
      return NextResponse.json(
        { hata: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { hata: `Kayıt oluşturulamadı: ${ham}` },
      { status: 400 }
    );
  }

  // Trigger profili oluşturur; ad soyadı garantiye alalım
  const { error: profilHatasi } = await admin
    .from('profiller')
    .update({ ad_soyad: ad_soyad.trim(), onay_durumu: 'bekliyor' })
    .eq('id', data.user.id);

  if (profilHatasi) {
    console.error('[kayit] profil güncelleme hatası:', profilHatasi.message);
    return NextResponse.json(
      { hata: `Hesap açıldı ama profil kaydedilemedi: ${profilHatasi.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ tamam: true });
}
