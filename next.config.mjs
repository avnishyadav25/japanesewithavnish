/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/jlpt/n5", destination: "/jlpt?level=n5", permanent: true },
      { source: "/jlpt/n4", destination: "/jlpt?level=n4", permanent: true },
      { source: "/jlpt/n3", destination: "/jlpt?level=n3", permanent: true },
      { source: "/jlpt/n2", destination: "/jlpt?level=n2", permanent: true },
      { source: "/jlpt/n1", destination: "/jlpt?level=n1", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
