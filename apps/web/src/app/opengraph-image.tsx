import { ImageResponse } from 'next/og';
import { BRAND, loadGoogleFont, usableFonts } from '@/lib/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt =
  'SAPTalk — a plain-English question compiled into a validated OData query';

const HEADLINE = 'The model never writes the query.';
const SUB = 'Plain English in. Validated OData out. Shown every time.';
const QUESTION = '“organisations added this year, newest first”';
const QUERY =
  "$filter=(BusinessPartnerCategory eq '2') and (CreationDate ge datetime'2026-01-01T00:00:00')";
const DOMAIN = 'saptalk.dinaludagedara.com';
const WORDMARK = 'SAPTalk';

/**
 * The social card.
 *
 * It shows the transformation rather than describing it: the question above,
 * the compiled query below. That is the product in one glance, and it is the
 * only thing a reader gets before deciding whether to click.
 */
export default async function OpengraphImage() {
  const sansText = HEADLINE + SUB + WORDMARK + DOMAIN + 'INTENT ODATA';
  const [sans, sansBold, mono] = await Promise.all([
    loadGoogleFont('Geist', 400, sansText),
    loadGoogleFont('Geist', 600, sansText),
    loadGoogleFont('JetBrains Mono', 400, QUESTION + QUERY),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: BRAND.ground,
          // One soft accent bloom, the same device the app uses behind its
          // ask bar, so the card and the page read as one thing.
          backgroundImage: `radial-gradient(1100px 420px at 15% -12%, ${BRAND.accent}22, transparent 70%)`,
          fontFamily: 'Geist',
          color: BRAND.ink,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderTop: `7px solid ${BRAND.accent}`,
              borderRight: `7px solid ${BRAND.accent}`,
              transform: 'rotate(45deg)',
              marginLeft: -6,
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.4 }}>
            {WORDMARK}
          </div>
          <div style={{ fontSize: 22, color: BRAND.muted, marginLeft: 4 }}>
            natural language to OData
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 600,
              letterSpacing: -1.6,
              lineHeight: 1.05,
            }}
          >
            {HEADLINE}
          </div>
          <div style={{ fontSize: 27, color: BRAND.muted }}>{SUB}</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: '26px 30px',
            borderRadius: 14,
            background: BRAND.surface,
            border: `1px solid ${BRAND.line}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'JetBrains Mono',
              fontSize: 23,
              color: BRAND.ink,
            }}
          >
            {QUESTION}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 1, background: BRAND.line }} />
            <div
              style={{
                fontSize: 14,
                letterSpacing: 2.4,
                color: BRAND.accent,
              }}
            >
              COMPILES TO
            </div>
            <div style={{ flex: 1, height: 1, background: BRAND.line }} />
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'JetBrains Mono',
              fontSize: 19,
              color: BRAND.accent,
              lineHeight: 1.4,
            }}
          >
            {QUERY}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 21, color: BRAND.muted }}>
          {DOMAIN}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: usableFonts([
        { name: 'Geist', weight: 400, data: sans },
        { name: 'Geist', weight: 600, data: sansBold },
        { name: 'JetBrains Mono', weight: 400, data: mono },
      ]),
    },
  );
}
