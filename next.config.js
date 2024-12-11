/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // This will generate static HTML/CSS/JS
  images: {
    unoptimized: true, // Required for static export
  },
}

module.exports = nextConfig 