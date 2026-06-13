import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile above the repo otherwise makes
  // Turbopack mis-infer it (breaks output file tracing on deploy).
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
