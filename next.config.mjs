/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable compression for better performance
  compress: true,
  
  // Optimize images with modern formats
  images: {
    formats: ['image/webp', 'image/avif'],
  },
};

export default nextConfig;
