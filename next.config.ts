import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // ⚠️ WARNING: Allows build to succeed even with TypeScript errors
    ignoreBuildErrors: true,
  },
  // `eslint: { ignoreDuringBuilds: true }` is no longer supported in Next.js 16
};

export default nextConfig;