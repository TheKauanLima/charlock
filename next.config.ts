import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.clerk.com https://*.clerk.accounts.dev https://clerk.cursedconcepts.xyz https://challenges.cloudflare.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
  "font-src 'self' fonts.gstatic.com",
  "img-src 'self' data: blob: img.clerk.com images.clerk.dev https://*.clerk.accounts.dev https://clerk.cursedconcepts.xyz https://*.public.blob.vercel-storage.com utfs.io https://www.google-analytics.com https://*.google-analytics.com",
  "connect-src 'self' *.clerk.com https://*.clerk.accounts.dev https://clerk.cursedconcepts.xyz https://cursedconcepts.xyz https://challenges.cloudflare.com *.uploadthing.com utfs.io https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
  "frame-src 'self' *.clerk.com https://*.clerk.accounts.dev https://clerk.cursedconcepts.xyz https://cursedconcepts.xyz https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
      {
        protocol: 'https',
        hostname: 'clerk.cursedconcepts.xyz',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
        ],
      },
    ]
  },
};

export default nextConfig;
