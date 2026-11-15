/** @type {import('next').NextConfig} */
export default {
  experimental: { serverComponentsExternalPackages: ['@node-rs/argon2'] },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
};
