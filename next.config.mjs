/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com", pathname: "/**" },
      // Add your Supabase project hostname when using Storage images, e.g.:
      // { protocol: "https", hostname: "YOUR_PROJECT.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
