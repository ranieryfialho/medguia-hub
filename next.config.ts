import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // <-- Nova linha adicionada aqui

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        port: '',
        pathname: '/api/**',
        search: '',
      },
    ],
  },
};

export default nextConfig;