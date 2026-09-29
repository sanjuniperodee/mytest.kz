// mytest brand mark: an "m" whose upper-right corner carries a check badge ("my test, passed").
// One geometry, several colourways. Everything in 64×64 units so it scales to any asset.

export const COLORS = {
  ink: "#2A2826", // = app light theme foreground
  paper: "#F7F6F3", // = app light theme background
  coral: "#EB7A6A", // accent used on dark surfaces
  coralDeep: "#E06050", // accent used on light surfaces
}

// Colourways: which tile the mark sits on and how the glyph is drawn on it.
export const WAYS = {
  // Dark tile — default (favicons, app icons, light UI).
  onInk: { tile: COLORS.ink, glyph: COLORS.paper, badge: COLORS.coral, check: COLORS.ink },
  // Light tile — for dark UI.
  onPaper: { tile: COLORS.paper, glyph: COLORS.ink, badge: COLORS.coralDeep, check: COLORS.paper },
}

const GLYPH = "M12.5 48V30.5a7.75 7.75 0 0 1 15.5 0V48M28 30.5a7.75 7.75 0 0 1 15.5 0V48"

/**
 * @param {object} o
 * @param {string} [o.tile]      tile colour; omit for a bare glyph on transparent
 * @param {number} [o.radius]    tile corner radius (0 = square, for icons the OS masks itself)
 * @param {string} o.glyph
 * @param {string} o.badge
 * @param {string} o.check
 * @param {number} [o.scale]     glyph scale inside the 64 box (1 = as designed)
 * @param {number|string} [o.size]
 */
export function markSvg({ tile, radius = 15, glyph, badge, check, scale = 1, size = 64, id = "m" }) {
  // Centre of the glyph+badge bounding box is (32.75, 30); move it to (32, 32).
  const place = `translate(32 32) scale(${scale}) translate(-32.75 -30)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" fill="none">
  ${tile ? `<rect width="64" height="64" rx="${radius}" fill="${tile}"/>` : ""}
  <defs>
    <mask id="${id}-cut" maskUnits="userSpaceOnUse" x="-32" y="-32" width="128" height="128">
      <rect x="-32" y="-32" width="128" height="128" fill="#fff"/>
      <circle cx="47.5" cy="17.5" r="11.6" fill="#000"/>
    </mask>
  </defs>
  <g transform="${place}">
    <path d="${GLYPH}" stroke="${glyph}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id}-cut)"/>
    <circle cx="47.5" cy="17.5" r="8.6" fill="${badge}"/>
    <path d="M43.5 17.9l2.9 3 5.4-6.4" stroke="${check}" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}

export const tileMark = (way = "onInk", extra = {}) => markSvg({ ...WAYS[way], ...extra })
