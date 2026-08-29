/**
 * Shared pieces for the generated icon and social images.
 *
 * Colours are copied from globals.css as hex rather than imported: Satori (the
 * renderer behind ImageResponse) resolves neither CSS variables nor oklch, so
 * these have to be literals. They are the same values the app paints with.
 */
export const BRAND = {
  ground: '#0d1216',
  surface: '#161f25',
  line: '#28363e',
  ink: '#e8f0f3',
  muted: '#8fa4ad',
  accent: '#5fd4c4',
} as const;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saptalk.dinaludagedara.com';

export const TAGLINE =
  'Ask SAP business data questions in plain English. The model never writes the query.';

/**
 * Load a Google font as TTF for Satori, which cannot parse woff2.
 *
 * Google serves woff2 to browsers and TTF to clients that do not advertise
 * support, and Node's fetch sends no browser User-Agent -- so the plain request
 * below is what gets us a parseable font. `text` narrows the download to the
 * glyphs actually drawn.
 */
export async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer | null> {
  try {
    const url =
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}` +
      `&text=${encodeURIComponent(text)}`;
    const css = await fetch(url).then((response) => response.text());
    const source = /src:\s*url\((https:\/\/[^)]+)\)/.exec(css)?.[1];
    if (!source) return null;
    return await fetch(source).then((response) => response.arrayBuffer());
  } catch {
    // A share image with the fallback face beats a build that fails because a
    // font CDN was briefly unreachable.
    return null;
  }
}

/** Drop nulls so ImageResponse gets only fonts that actually loaded. */
export function usableFonts(
  entries: { name: string; weight: 400 | 500 | 600 | 700; data: ArrayBuffer | null }[],
) {
  return entries
    .filter((entry): entry is typeof entry & { data: ArrayBuffer } => entry.data !== null)
    .map(({ name, weight, data }) => ({ name, weight, data, style: 'normal' as const }));
}
