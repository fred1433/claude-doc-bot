/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
    WS_URL: process.env.WS_URL || 'ws://localhost:3001',
  },
};

module.exports = nextConfig; 