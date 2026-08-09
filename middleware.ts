import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const HERKESE_ACIK = ['/giris', '/auth'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Oturumu tazeler (bu satır kaldırılmamalı)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const acik = HERKESE_ACIK.some((p) => path.startsWith(p));

  if (!user && path.startsWith('/api/')) {
    // API çağrılarında HTML'e yönlendirmek yerine düzgün 401 dön
    return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });
  }

  if (!user && !acik) {
    const url = request.nextUrl.clone();
    url.pathname = '/giris';
    url.searchParams.set('yonlendir', path);
    return NextResponse.redirect(url);
  }

  if (user) {
    const sifreVar = user.user_metadata?.sifre_belirlendi === true;
    const sifreSayfasi = path.startsWith('/sifre-belirle');

    // Şifresini belirlememiş kullanıcı sadece şifre sayfasını görebilir
    if (!sifreVar && !sifreSayfasi && !acik) {
      const url = request.nextUrl.clone();
      url.pathname = '/sifre-belirle';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // ?yenile=1 → "şifremi unuttum" akışı, şifresi olan da girebilmeli
    const yenileme = request.nextUrl.searchParams.get('yenile') === '1';

    if (sifreVar && sifreSayfasi && !yenileme) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (path === '/giris') {
      const url = request.nextUrl.clone();
      url.pathname = sifreVar ? '/' : '/sifre-belirle';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
