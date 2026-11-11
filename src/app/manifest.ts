import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GymBro Analytics',
    short_name: 'GymBro',
    description: "Plateforme d'analyse et de surcharge progressive pour la musculation",
    start_url: '/',
    display: 'standalone',
    background_color: '#090B0E',
    theme_color: '#090B0E',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
