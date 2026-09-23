/** Subtle north indicator for the map furniture corner. */
export function NorthArrow() {
  return (
    <div className="north-arrow" aria-label="North up" title="North is up">
      <span className="north-arrow-glyph" aria-hidden="true">
        N
      </span>
      <span className="north-arrow-shaft" aria-hidden="true">
        ▲
      </span>
    </div>
  )
}