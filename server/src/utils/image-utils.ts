export function getFaviconUrlForDomain(domain: string): string {
  const d = String(domain).replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`
}

export function generatePlaceholderSvgDataUrl(title?: string): string {
  const t = (title || 'D').trim()
  const letter = t ? t[0]!.toUpperCase() : 'D'
  const hash = Array.from(t).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0)
  const hue = hash % 360
  const bg = `hsl(${hue}, 60%, 18%)`
  const fg = `hsl(${hue}, 70%, 70%)`
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${bg}'/>
      <stop offset='100%' stop-color='${fg}'/>
    </linearGradient>
  </defs>
  <rect width='128' height='128' rx='16' fill='url(#g)'/>
  <text x='50%' y='58%' text-anchor='middle' font-size='64' font-family='Inter, ui-sans-serif, system-ui' fill='rgba(255,255,255,0.9)'>${letter}</text>
  <rect x='8' y='8' width='112' height='112' rx='14' fill='none' stroke='rgba(255,255,255,0.12)'/>
</svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}
