// Inlined Centrifugo mark — kept in its true brand colors (charcoal + coral) in
// both themes. Inlined rather than a flat <img> so nothing (e.g. a CSS filter
// meant to help a dark bar) can wash the two tones out.

const OUTER =
  'M 429.39101256495604 232.56088156396868 L 499.39101256495604 232.56088156396868 A 250 250 0 0 0 267.4391184360314 0.6089874350439572 L 267.4391184360314 70.60898743504396 A 180 180 0 0 1 429.39101256495604 232.56088156396868 Z'
const INNER =
  'M 349.6102480415719 238.83896420093996 L 409.6102480415719 238.83896420093996 A 160 160 0 0 0 261.1610357990601 90.38975195842812 L 261.1610357990601 150.38975195842812 A 100 100 0 0 1 349.6102480415719 238.83896420093996 Z'

export const Logo = ({ size = 30 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 500 500"
    role="img"
    aria-label="Centrifugo logo"
  >
    {/* Outer arcs — brand charcoal. */}
    <path d={OUTER} fill="#393940" />
    <path d={OUTER} transform="rotate(-90 250 250)" fill="#393940" />
    <path d={OUTER} transform="rotate(-180 250 250)" fill="#393940" />
    <path d={OUTER} transform="rotate(-270 250 250)" fill="#393940" />
    {/* Inner arcs — brand coral. */}
    <path d={INNER} transform="rotate(-45 250 250)" fill="#e84c3b" />
    <path d={INNER} transform="rotate(-135 250 250)" fill="#e84c3b" />
    <path d={INNER} transform="rotate(-225 250 250)" fill="#e84c3b" />
  </svg>
)
