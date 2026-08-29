import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * Home-screen icon. Same mark as the favicon, but iOS renders these large and
 * on an arbitrary wallpaper, so it gets a border to hold its edge.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND.ground,
          border: `1px solid ${BRAND.line}`,
        }}
      >
        <div
          style={{
            width: 62,
            height: 62,
            borderTop: `18px solid ${BRAND.accent}`,
            borderRight: `18px solid ${BRAND.accent}`,
            transform: 'rotate(45deg)',
            marginLeft: -16,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
