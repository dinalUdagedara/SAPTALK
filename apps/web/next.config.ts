import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared package ships as workspace source-built CJS.
  transpilePackages: ['@saptalk/shared'],
};

export default nextConfig;
