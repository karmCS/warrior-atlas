/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @arcgis/core ships modern ESM; let Next transpile it for the client bundle.
  transpilePackages: ['@arcgis/core'],
};

export default nextConfig;
