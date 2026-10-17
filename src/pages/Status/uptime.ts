// Formats uptime for the live node table. Unlike HumanSeconds, every unit
// below the largest one is kept (01h 00m 05s, not 01h 05s), so the value
// keeps its width between refreshes and the table doesn't jump.
export function formatUptime(seconds: number): string {
  seconds = Math.max(0, Math.floor(seconds))
  const parts: [number, string][] = [
    [Math.floor(seconds / 31536000), 'y'],
    [Math.floor((seconds % 31536000) / 86400), 'd'],
    [Math.floor((seconds % 86400) / 3600), 'h'],
    [Math.floor((seconds % 3600) / 60), 'm'],
    [seconds % 60, 's'],
  ]
  const first = parts.findIndex(([n]) => n > 0)
  if (first === -1) {
    return '0s'
  }
  return parts
    .slice(first)
    .map(([n, unit]) =>
      unit === 'y' || unit === 'd'
        ? `${n}${unit}`
        : `${String(n).padStart(2, '0')}${unit}`
    )
    .join(' ')
}
