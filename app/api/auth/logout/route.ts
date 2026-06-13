import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const res = NextResponse.redirect(`${new URL(req.url).origin}/`);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
