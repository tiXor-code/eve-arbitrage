'use client';

import { useEffect, useState } from 'react';
import type { AuthMe } from '@/lib/types';
import { formatIsk } from '@/lib/format';

export default function AuthBar({ onAuth }: { onAuth?: (me: AuthMe) => void }) {
  const [me, setMe] = useState<AuthMe | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d: AuthMe) => {
        if (!alive) return;
        setMe(d);
        if (d.authenticated) onAuth?.(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSO not configured on this deployment: stay invisible (anonymous tool).
  if (!me || !me.configured) return null;

  if (!me.authenticated) {
    return (
      <a
        href="/api/auth/login"
        className="rounded border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[#04201c]"
      >
        Log in with EVE
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[var(--text)]">
        {me.name}
        <span className="ml-2 text-xs text-[var(--muted)]">
          tax {((me.salesTaxRate ?? 0) * 100).toFixed(1)}% · {formatIsk(me.walletIsk ?? 0)} ISK
        </span>
      </span>
      <a href="/api/auth/logout" className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
        Log out
      </a>
    </div>
  );
}
