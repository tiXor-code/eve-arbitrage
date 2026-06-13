import { describe, it, expect, beforeAll } from 'vitest';
import {
  sealSession,
  openSession,
  sealOAuth,
  openOAuth,
} from '@/lib/session';

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-at-least-32-bytes-long-xxxxx';
});

describe('session sealing', () => {
  it('seals and reopens a session', async () => {
    const token = await sealSession({
      characterId: 123,
      name: 'Test Pilot',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 1_000,
    });
    const back = await openSession(token);
    expect(back?.characterId).toBe(123);
    expect(back?.name).toBe('Test Pilot');
    expect(back?.refreshToken).toBe('refresh');
  });

  it('returns null for a tampered/invalid token', async () => {
    expect(await openSession('not.a.real.token')).toBeNull();
  });

  it('round-trips the short-lived OAuth state', async () => {
    const token = await sealOAuth({ state: 's', verifier: 'v', redirectUri: 'u' });
    const back = await openOAuth(token);
    expect(back?.verifier).toBe('v');
    expect(back?.state).toBe('s');
  });
});
