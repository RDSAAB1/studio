
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: process.env.ELECTRON === 'true', // Disable image optimization for Electron
  },
  // For Electron builds, we might want to use static export
  output: process.env.ELECTRON === 'true' ? 'export' : undefined,
  trailingSlash: true,
};

export default nextConfig;
