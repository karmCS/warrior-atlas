/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Two dev servers sharing one .next corrupt each other's webpack cache. Set
  // NEXT_DIST_DIR to run a second one (a preview, a different port) side by side.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // @arcgis/core ships modern ESM; let Next transpile it for the client bundle.
  transpilePackages: ['@arcgis/core'],
};

export default nextConfig;
