import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/asr",
        destination: `${BACKEND_URL}/asr`,
      },
    ];
  },
};

export default nextConfig;
