/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,

  // Enable standalone output for Docker deployments
  // This creates a minimal production build with all dependencies bundled
  output: "standalone",
};

module.exports = nextConfig;
