import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isConfigured, refreshAccessToken } from '@/lib/sso';
import { SESSION_COOKIE, openSession, sealSession, type Session } from '@/lib/session';
import { getAccountingLevel, getWalletBalance } from '@/lib/esi';
import { salesTaxRate } from '@/lib/arbitrage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const jar = await cookies();
  const sealed = jar.get(SESSION_COOKIE)?.value;
  const session = sealed ? await openSession(sealed) : null;

  if (!session) {
    return NextResponse.json({ authenticated: false, configured: isConfigured() });
  }

  let s: Session = session;
  let refreshed = false;

  // Refresh the access token if it's expired (or about to be).
  if (s.expiresAt < Date.now() + 30_000) {
    try {
      const t = await refreshAccessToken(s.refreshToken);
      s = {
        ...s,
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        expiresAt: Date.now() + t.expires_in * 1000,
      };
      refreshed = true;
    } catch {
      const res = NextResponse.json({ authenticated: false, configured: true });
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
  }

  let accountingLevel = 0;
  let walletIsk = 0;
  try {
    [accountingLevel, walletIsk] = await Promise.all([
      getAccountingLevel(s.characterId, s.accessToken),
      getWalletBalance(s.characterId, s.accessToken),
    ]);
  } catch {
    // Token valid but a data call failed; report identity with zeros.
  }

  const res = NextResponse.json({
    authenticated: true,
    configured: true,
    characterId: s.characterId,
    name: s.name,
    accountingLevel,
    salesTaxRate: salesTaxRate(accountingLevel),
    walletIsk,
  });

  if (refreshed) {
    res.cookies.set(SESSION_COOKIE, await sealSession(s), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
