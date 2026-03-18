import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const OPENCODE_URL = process.env.OPENCODE_URL || "http://127.0.0.1:17171";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.dev", "brittni-unprospering-pia.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/asr",
        destination: `${BACKEND_URL}/asr`,
      },
      {
        source: "/opencode/:path*",
        destination: `${OPENCODE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
