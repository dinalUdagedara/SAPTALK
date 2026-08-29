import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * Favicon: a prompt caret on the console ground.
 *
 * A chevron rather than a letter. At 16px in a crowded tab strip an "S" turns
 * to mush, while an angle keeps its shape -- and a caret is what the product
 * is: somewhere you type a question.
 *
 * Drawn from two rotated borders instead of a glyph, because Satori has no
 * font to fall back on for punctuation at this size.
 */
export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div
          style={{
            width: 11,
            height: 11,
            borderTop: `3.5px solid ${BRAND.accent}`,
            borderRight: `3.5px solid ${BRAND.accent}`,
            transform: 'rotate(45deg)',
            // The rotated square reads right-of-centre; nudge it back.
            marginLeft: -3,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
