import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, verifyAccessToken } from '@/lib/sso';
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  openOAuth,
  sealSession,
} from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const origin = url.origin;

  const jar = await cookies();
  const sealed = jar.get(OAUTH_COOKIE)?.value;
  const oauth = sealed ? await openOAuth(sealed) : null;

  if (!code || !state || !oauth || oauth.state !== state) {
    return NextResponse.redirect(`${origin}/?auth=error`);
  }

  try {
    const tokens = await exchangeCode(code, oauth.verifier, oauth.redirectUri);
    const { characterId, name } = await verifyAccessToken(tokens.access_token);

    const res = NextResponse.redirect(`${origin}/?auth=ok`);
    res.cookies.set(
      SESSION_COOKIE,
      await sealSession({
        characterId,
        name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      }),
      {
        httpOnly: true,
        secure: origin.startsWith('https'),
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      },
    );
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/?auth=error`);
  }
}
