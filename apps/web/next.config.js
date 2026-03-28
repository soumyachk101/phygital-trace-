/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['leaflet']
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud'
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io'
      }
    ]
  },
  env: {
    CUSTOM_KEY: process.env.NEXT_PUBLIC_APP_URL
  }
};

module.exports = nextConfig;
