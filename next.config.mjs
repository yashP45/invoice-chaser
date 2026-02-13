/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: []
    }
  },
  serverExternalPackages: ["pdfkit"]
};

export default nextConfig;
