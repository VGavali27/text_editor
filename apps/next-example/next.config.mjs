/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages resolve to TypeScript sources — let Next transpile them.
  transpilePackages: [
    '@editor/core',
    '@editor/plugin-api',
    '@editor/adapter-react',
    '@editor/extension-styling',
    '@editor/extension-history',
    '@editor/extension-link',
    '@editor/extension-anchor',
    '@editor/extension-image',
    '@editor/extension-paste-clean',
    '@editor/extension-source-view',
    '@editor/sanitize',
    '@editor/ui',
  ],
}

export default nextConfig
