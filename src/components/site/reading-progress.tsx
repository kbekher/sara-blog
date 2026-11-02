/**
 * Thin accent bar at the top of the viewport that tracks scroll progress. Decorative (aria-hidden).
 * Pure CSS (scroll-driven animation, see `.reading-progress` in src/styles/prose.css):
 * hidden in browsers without `animation-timeline` support and for reduced-motion users.
 */
export function ReadingProgress() {
  return <div className="reading-progress" aria-hidden />;
}
