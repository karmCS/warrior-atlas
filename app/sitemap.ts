import type { MetadataRoute } from 'next';

// Single-route site; exists so robots.txt has a real sitemap to point at.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://projectwarrioratlas.com', changeFrequency: 'monthly', priority: 1 }];
}
