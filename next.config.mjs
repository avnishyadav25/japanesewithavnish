/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Canonical hostname: apex only, no www — avoids duplicate-content/split-SEO
      // between japanesewithavnish.com and www.japanesewithavnish.com.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.japanesewithavnish.com" }],
        destination: "https://japanesewithavnish.com/:path*",
        permanent: true,
      },
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
      // R2 public bucket URLs (add your custom domain here if needed)
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" },
    ],
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
