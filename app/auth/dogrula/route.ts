import { NextResponse, type NextRequest } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Maildeki giriş linki buraya düşer.
 * İki formatı da destekler:
 *  - ?token_hash=...&type=magiclink   (önerilen, mail şablonu {{ .TokenHash }})
 *  - ?code=...                        (PKCE varsayılanı)
 *
 * Link ile gelen kullanıcı her zaman şifre belirleme ekranına yönlendirilir;
 * bu akış hem ilk giriş hem de "şifremi unuttum" için kullanılır.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const supabase = await createClient();
  let girisBasarili = false;

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) girisBasarili = true;
  }

  if (!girisBasarili && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) girisBasarili = true;
  }

  if (!girisBasarili) {
    return NextResponse.redirect(`${origin}/giris?hata=link_gecersiz`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Giriş linki iki durumda kullanılır: ilk giriş ya da şifre unutma.
  // İkisi de şifre belirleme ekranıyla biter.
  if (!user?.user_metadata?.sifre_belirlendi) {
    return NextResponse.redirect(`${origin}/sifre-belirle`);
  }

  return NextResponse.redirect(`${origin}/sifre-belirle?yenile=1`);
}
