import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { base64url, createRemoteJWKSet, jwtVerify } from 'jose';

// EVE Online SSO (OAuth2 Authorization Code + PKCE).
// Docs: https://developers.eveonline.com/docs/services/sso/

const AUTHORIZE = 'https://login.eveonline.com/v2/oauth/authorize/';
const TOKEN = 'https://login.eveonline.com/v2/oauth/token';
const JWKS_URL = 'https://login.eveonline.com/oauth/jwks';

export const SCOPES = [
  'esi-skills.read_skills.v1',
  'esi-wallet.read_character_wallet.v1',
];

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export function isConfigured(): boolean {
  return Boolean(process.env.EVE_CLIENT_ID);
}

function clientId(): string {
  const id = process.env.EVE_CLIENT_ID;
  if (!id) throw new Error('EVE_CLIENT_ID is not set');
  return id;
}

// --- PKCE ---

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url.encode(randomBytes(32));
  const challenge = base64url.encode(
    createHash('sha256').update(verifier).digest(),
  );
  return { verifier, challenge };
}

export function randomState(): string {
  return base64url.encode(randomBytes(16));
}

export function buildAuthUrl(
  redirectUri: string,
  challenge: string,
  state: string,
): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return url.toString();
}

// --- Token endpoint ---

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function tokenHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Host: 'login.eveonline.com',
  };
  // Confidential (web) app: HTTP Basic. Native PKCE app: client_id in body.
  const secret = process.env.EVE_CLIENT_SECRET;
  if (secret) {
    const basic = Buffer.from(`${clientId()}:${secret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  }
  return headers;
}

function withClientId(body: URLSearchParams): URLSearchParams {
  if (!process.env.EVE_CLIENT_SECRET) body.set('client_id', clientId());
  return body;
}

export async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = withClientId(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  );
  const res = await fetch(TOKEN, { method: 'POST', headers: tokenHeaders(), body });
  if (!res.ok) {
    throw new Error(`SSO token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const body = withClientId(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  );
  const res = await fetch(TOKEN, { method: 'POST', headers: tokenHeaders(), body });
  if (!res.ok) {
    throw new Error(`SSO token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

// --- Access-token (JWT) verification ---

export interface VerifiedToken {
  characterId: number;
  name: string;
}

export async function verifyAccessToken(token: string): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ['login.eveonline.com', 'https://login.eveonline.com'],
    audience: process.env.EVE_CLIENT_ID,
  });
  // sub looks like "CHARACTER:EVE:123456789"
  const sub = String(payload.sub ?? '');
  const characterId = Number(sub.split(':').pop());
  const name = String((payload as { name?: unknown }).name ?? 'Unknown');
  if (!Number.isFinite(characterId) || characterId <= 0) {
    throw new Error('SSO token missing character id');
  }
  return { characterId, name };
}
