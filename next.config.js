/** @type {import('next').NextConfig} */

const backendApiUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';

const nextConfig = {
    images: {
        domains: ['images.unsplash.com'],
    },
    async rewrites() {
        return {
            beforeFiles: [
                {
                    source: '/api/:path*',
                    destination: `${backendApiUrl}/api/:path*`,
                },
            ],
        };
    },
};

module.exports = nextConfig;
