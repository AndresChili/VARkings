import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // nonce + strict-dynamic: los navegadores modernos exigen el nonce; unsafe-inline lo ignoran
    // (se mantiene como fallback para navegadores antiguos que no soportan strict-dynamic)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://media.api-sports.io https://media-3.api-sports.io https://crests.football-data.org https://upload.wikimedia.org https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "font-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  // Genera un nonce por petición para la CSP — los server components lo leen vía headers()
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Pasa el nonce en la petición reenviada para que el layout raíz pueda leerlo
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Conserva la cabecera x-nonce cuando Supabase recrea la respuesta
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/onboarding';
  const isPublicPath =
    pathname === '/' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/add/') ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js';

  if (!user && !isAuthPage && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set('Content-Security-Policy', buildCsp(nonce));
    return redirectResponse;
  }

  if (user && isAuthPage) {
    const dashboardResponse = NextResponse.redirect(new URL('/dashboard', request.url));
    dashboardResponse.headers.set('Content-Security-Policy', buildCsp(nonce));
    return dashboardResponse;
  }

  supabaseResponse.headers.set('Content-Security-Policy', buildCsp(nonce));
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*).*)'],
};
