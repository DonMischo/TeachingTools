import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_HOST = process.env.API_HOST ?? "127.0.0.1";
const API_PORT = process.env.API_PORT ?? "8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { poll: 500, aggregateTimeout: 200 };
    }
    return config;
  },
  // Tippen und Maus-Führerschein lagen früher unter /aktivitaeten.
  async redirects() {
    return ["tippen", "maus"].map(slug => ({
      source: `/aktivitaeten/${slug}`,
      destination: `/simulationen/${slug}`,
      permanent: false,
    }));
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `http://${API_HOST}:${API_PORT}/api/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `http://${API_HOST}:${API_PORT}/uploads/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
