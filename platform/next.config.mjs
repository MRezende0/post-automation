/** @type {import('next').NextConfig} */
const nextConfig = {
  // a plataforma vive numa subpasta do repo; fixa a raiz pro tracing não pegar o lockfile de cima
  outputFileTracingRoot: import.meta.dirname,
  // As artes vêm do Supabase Storage (bucket público post-images) e do raw.githubusercontent.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
