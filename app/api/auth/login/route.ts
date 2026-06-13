import { NextResponse } from 'next/server';
import { buildAuthUrl, createPkce, isConfigured, randomState } from '@/lib/sso';
import { OAUTH_COOKIE, sealOAuth } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'EVE SSO not configured' }, { status: 503 });
  }
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;
  const { verifier, challenge } = createPkce();
  const state = randomState();

  const res = NextResponse.redirect(buildAuthUrl(redirectUri, challenge, state));
  res.cookies.set(OAUTH_COOKIE, await sealOAuth({ state, verifier, redirectUri }), {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
