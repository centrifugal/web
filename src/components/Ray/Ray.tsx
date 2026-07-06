import styles from './Ray.module.css'

interface RayProps {
  className?: string
}

// Ray renders the dark-mode aurora / light-ray backdrop used on centrifugal.dev.
// It's purely decorative (pointer-events: none) and sits on its own fixed layer.
// Render it only in dark mode — see usage in the Login page.
export const Ray = ({ className }: RayProps) => (
  <div className={`${styles.rayContainer} ${className || ''}`}>
    <div className={styles.ray} />
  </div>
)
