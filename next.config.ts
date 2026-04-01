
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Webpack caching is enabled by default in Next.js 15 for faster rebuilds
    return config;
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
  // Standalone output for Electron - more reliable than next start in packaged app
  output: process.env.ELECTRON === 'true' ? 'standalone' : undefined,
  // Electron: trailingSlash false avoids blank pages on navigation (client-side routing issues)
  trailingSlash: process.env.ELECTRON === 'true' ? false : true,
};

export default nextConfig;

// Touched to trigger dev server reload
