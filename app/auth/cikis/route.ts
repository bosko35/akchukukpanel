import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303: POST sonrası GET ile yönlendirir
  return NextResponse.redirect(new URL('/giris', request.url), {
    status: 303,
  });
}
