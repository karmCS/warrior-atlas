/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Two dev servers sharing one .next corrupt each other's webpack cache. Set
  // NEXT_DIST_DIR to run a second one (a preview, a different port) side by side.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // @arcgis/core ships modern ESM; let Next transpile it for the client bundle.
  transpilePackages: ['@arcgis/core'],
  // Baseline hardening headers. No CSP: the ArcGIS SDK needs blob: workers and
  // wasm, and getting that allowlist wrong silently kills the globe.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
