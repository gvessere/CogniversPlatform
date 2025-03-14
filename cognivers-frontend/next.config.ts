import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  eslint: {  
    ignoreDuringBuilds: true  // For faster iteration  
  },
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://api:8000',
  },
  // Configure Next.js to look for pages in the app/pages folder
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  distDir: '.next',
  // Configure source directories
  webpack: (config, { isServer }) => {
    // Update aliases for the new structure
    config.resolve.alias = {
      ...config.resolve.alias,
      '@components': path.join(__dirname, 'components'),
      '@lib': path.join(__dirname, 'lib'),
      '@styles': path.join(__dirname, 'styles'),
      '@utils': path.join(__dirname, 'utils'),
      '@context': path.join(__dirname, 'context')
    };
    
    return config;
  }
};

export default nextConfig;