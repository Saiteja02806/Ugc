import glyphData from './reference-caption-glyphs.json' with { type: 'json' };

type Command = {type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number};
type Face = {units: number; glyphs: Record<string, {advance: number; commands: Command[]}>};

/** Same packaged glyph geometry for reference previews and native exports. */
export function referenceCaptionPaths(value: string, font: string | undefined, weight: number, preset: string | undefined, size: number, x: number, y: number): string[] | null {
  if ((preset !== 'reference-social' && preset !== 'reference-classic') || weight !== 700 || (font !== 'tiktoksans' && font !== 'dmsans')) return null;
  const face = glyphData[font] as Face;
  if (Array.from(value).some(character => !face.glyphs[character])) return null;
  const scale = size / face.units;
  const number = (v: number) => String(Number(v.toFixed(3)));
  return Array.from(value).map(character => {
    const glyph = face.glyphs[character];
    const point = (cx: number, cy: number) => `${number(x + cx * scale)} ${number(y + cy * scale)}`;
    const d = glyph.commands.map(c => {
      if (c.type === 'Z') return 'Z';
      if (c.type === 'M' || c.type === 'L') return c.type + point(c.x!, c.y!);
      if (c.type === 'Q') return 'Q' + point(c.x1!, c.y1!) + ' ' + point(c.x!, c.y!);
      if (c.type === 'C') return 'C' + point(c.x1!, c.y1!) + ' ' + point(c.x2!, c.y2!) + ' ' + point(c.x!, c.y!);
      throw new Error('Unsupported reference caption glyph.');
    }).join('');
    x += glyph.advance * scale;
    return d;
  });
}
