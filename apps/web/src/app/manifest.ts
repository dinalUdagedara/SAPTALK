import type { MetadataRoute } from 'next';
import { BRAND, TAGLINE } from '@/lib/og';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SAPTalk — natural language to OData',
    short_name: 'SAPTalk',
    description: TAGLINE,
    start_url: '/',
    display: 'standalone',
    background_color: BRAND.ground,
    theme_color: BRAND.ground,
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
