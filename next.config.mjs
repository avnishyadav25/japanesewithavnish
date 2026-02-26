/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip prerendering pages that require env vars (admin, API routes)
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
