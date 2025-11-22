export function getFaviconUrlForDomain(domain: string): string {
  const d = String(domain).replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`
}

const FILE_TYPE_CONFIGS: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
  json: { bg: '#0e1120', fg: '#E07555', icon: '{}', label: 'JSON' },
  csv: { bg: '#0e1120', fg: '#5fb3b3', icon: '⚏', label: 'CSV' },
  xml: { bg: '#0e1120', fg: '#ec5f67', icon: '‹›', label: 'XML' },
  txt: { bg: '#0e1120', fg: '#B9B1A5', icon: '≡', label: 'TXT' },
  pdf: { bg: '#0e1120', fg: '#f97583', icon: '⎙', label: 'PDF' },
  html: { bg: '#0e1120', fg: '#f99157', icon: '‹/›', label: 'HTML' },
  md: { bg: '#0e1120', fg: '#6c9ef8', icon: 'M↓', label: 'MD' },
  sql: { bg: '#0e1120', fg: '#8ec07c', icon: '⚑', label: 'SQL' },
  yaml: { bg: '#0e1120', fg: '#c792ea', icon: '⋮', label: 'YAML' },
  js: { bg: '#0e1120', fg: '#f7df1e', icon: 'JS', label: 'JS' },
  ts: { bg: '#0e1120', fg: '#3178c6', icon: 'TS', label: 'TS' },
  py: { bg: '#0e1120', fg: '#61afef', icon: 'Py', label: 'PY' },
  zip: { bg: '#0e1120', fg: '#b18bb1', icon: '⊞', label: 'ZIP' },
  img: { bg: '#0e1120', fg: '#ec9a78', icon: '◉', label: 'IMG' },
  png: { bg: '#0e1120', fg: '#ec9a78', icon: '◉', label: 'PNG' },
  jpg: { bg: '#0e1120', fg: '#ec9a78', icon: '◉', label: 'JPG' },
  jpeg: { bg: '#0e1120', fg: '#ec9a78', icon: '◉', label: 'JPEG' },
  gif: { bg: '#0e1120', fg: '#ec9a78', icon: '◉', label: 'GIF' },
  default: { bg: '#0e1120', fg: '#E07555', icon: '◆', label: '' }
}

const FILE_ICONS: Record<string, string> = {
  json: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M7 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V8z"/><path d="M12 12v4m4-4v4" stroke-width="2.5" stroke-linecap="round"/>`,
  csv: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M11 12h10M11 16h10M11 20h6" stroke-width="2.5" stroke-linecap="round"/>`,
  xml: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13 14l-3 3 3 3m6-6l3 3-3 3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  txt: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M12 12h8m-8 4h8m-8 4h5" stroke-width="2" stroke-linecap="round"/>`,
  pdf: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13 18h-1v-5h2a2 2 0 1 1 0 4h-1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  html: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13 14l-2 3 2 3m6-6l2 3-2 3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  md: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M11 18v-6l2 2 2-2v6m4-6v6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  sql: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><ellipse cx="16" cy="12" rx="5" ry="3" stroke-width="2" fill="none"/><path d="M11 12v4c0 1.657 2.239 3 5 3s5-1.343 5-3v-4" stroke-width="2" fill="none"/>`,
  yaml: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M12 12h8m-8 4h6m-6 4h4" stroke-width="2" stroke-linecap="round"/>`,
  js: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M18 20v-4a2 2 0 0 0-2-2h0m-3 2a3 3 0 0 1-3 3" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
  ts: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13 13h6m-3 0v7" stroke-width="2.5" stroke-linecap="round"/>`,
  py: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><circle cx="14" cy="13" r="1.5" fill="currentColor"/><circle cx="18" cy="13" r="1.5" fill="currentColor"/><path d="M12 17h8" stroke-width="2.5" stroke-linecap="round"/>`,
  zip: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M16 3v8m0 0h-2m2 0h2m-2 4v8" stroke-width="2" stroke-linecap="round"/>`,
  img: `<rect x="8" y="10" width="16" height="12" rx="2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><path d="M24 18l-4-4-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  png: `<rect x="8" y="10" width="16" height="12" rx="2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><path d="M24 18l-4-4-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  jpg: `<rect x="8" y="10" width="16" height="12" rx="2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><path d="M24 18l-4-4-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  jpeg: `<rect x="8" y="10" width="16" height="12" rx="2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><path d="M24 18l-4-4-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  gif: `<rect x="8" y="10" width="16" height="12" rx="2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><path d="M24 18l-4-4-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  default: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 3h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 8v12m4-6H12" stroke-width="2.5" stroke-linecap="round"/>`,
}

export function generatePlaceholderSvgDataUrl(title?: string, format?: string): string {
  const ext = format?.toLowerCase() || 'default'
  const config = FILE_TYPE_CONFIGS[ext] || FILE_TYPE_CONFIGS.default
  const icon = FILE_ICONS[ext] || FILE_ICONS.default
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 32 32'>
  <g stroke='${config.fg}' fill='none' stroke-width='1.5'>
    ${icon}
  </g>
</svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}
