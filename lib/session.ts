import 'server-only';
import { createHash } from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';

// Encrypted session cookie holding the EVE tokens + character identity. Uses a
// symmetric key derived from SESSION_SECRET (dir / A256GCM via jose).

export const SESSION_COOKIE = 'eve_session';
export const OAUTH_COOKIE = 'eve_oauth'; // short-lived PKCE state during login

export interface Session {
  characterId: number;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
}

export interface OAuthState {
  state: string;
  verifier: string;
  redirectUri: string;
}

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return new Uint8Array(createHash('sha256').update(secret).digest());
}

async function seal(payload: Record<string, unknown>, ttl: string): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .encrypt(key());
}

async function open<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtDecrypt(token, key());
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export const sealSession = (s: Session) => seal({ ...s }, '30d');
export const openSession = (t: string) => open<Session>(t);

export const sealOAuth = (s: OAuthState) => seal({ ...s }, '10m');
export const openOAuth = (t: string) => open<OAuthState>(t);
