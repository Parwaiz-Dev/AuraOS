/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tenant images are served from Cloudflare R2 / CDN. Allow remote images so
  // next/image can optimize them. Tighten the hostnames before production.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudflarestorage.com' },
    ],
  },
};

module.exports = nextConfig;
