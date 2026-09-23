/**
 * Editorial/technical chapter eyebrow — NOT a badge, pill, capsule, or
 * status chip. A restrained mono chapter marker: `CODE · LABEL`.
 *
 * Uses existing typography tokens (mono, tracking, uppercase) and a
 * hairline-quality separator between the code and the label.
 */
export interface SectionEyebrowProps {
  code: string
  label: string
}

export function SectionEyebrow({ code, label }: SectionEyebrowProps) {
  return (
    <span className="inline-flex items-baseline gap-2 font-mono text-[10px] tracking-widest uppercase leading-none select-none">
      <span className="text-sonar">{code}</span>
      <span className="text-dim" aria-hidden="true">
        ·
      </span>
      <span className="text-mist">{label}</span>
    </span>
  )
}

export default SectionEyebrow