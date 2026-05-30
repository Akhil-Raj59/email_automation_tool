import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static export — we use server-side features (MongoDB, Nodemailer)
  // Render deployment: use npm run build && npm run start

  // Increase body size limit for CSV uploads (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
