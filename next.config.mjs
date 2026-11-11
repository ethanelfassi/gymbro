/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // 32-bit ARM (Raspberry Pi OS armhf) lacks prebuilt @next/swc-linux-arm-gnueabihf binaries in Next 14.
    useWasmBinary: process.arch === 'arm',
  },
};

export default nextConfig;
