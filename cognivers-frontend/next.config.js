// @ts-check

/** @type {import('next').NextConfig} */
const config = {
  eslint: {  
    ignoreDuringBuilds: true
  },
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://api:8000',
  }
};

export default config;