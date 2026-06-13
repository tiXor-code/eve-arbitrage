import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { base64url } from 'jose';
import { createPkce, buildAuthUrl, isConfigured, SCOPES } from '@/lib/sso';

beforeAll(() => {
  process.env.EVE_CLIENT_ID = 'test-client';
});

describe('sso PKCE', () => {
  it('derives challenge as base64url(sha256(verifier))', () => {
    const { verifier, challenge } = createPkce();
    const expected = base64url.encode(createHash('sha256').update(verifier).digest());
    expect(challenge).toBe(expected);
  });

  it('builds an authorize URL with PKCE params and scopes', () => {
    const url = new URL(buildAuthUrl('https://x.app/api/auth/callback', 'chal', 'st8'));
    expect(url.origin + url.pathname).toBe(
      'https://login.eveonline.com/v2/oauth/authorize/',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('state')).toBe('st8');
    expect(url.searchParams.get('redirect_uri')).toBe('https://x.app/api/auth/callback');
    expect(url.searchParams.get('scope')).toBe(SCOPES.join(' '));
    expect(url.searchParams.get('client_id')).toBe('test-client');
  });

  it('reports configured when EVE_CLIENT_ID is set', () => {
    expect(isConfigured()).toBe(true);
  });
});
