// Browser tab title, most specific part first so it survives tab truncation:
// pageTitle('Trends', 'Analytics') -> "Trends · Analytics · Centrifugo".
export const pageTitle = (...parts: string[]) =>
  [...parts.filter(Boolean), 'Centrifugo'].join(' · ')
