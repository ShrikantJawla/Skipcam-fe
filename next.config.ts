import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow tunnel hosts to load Next.js dev / HMR resources
  allowedDevOrigins: [
    "172.20.10.4",
    "aerospace-might-services-uniprotkb.trycloudflare.com",
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
