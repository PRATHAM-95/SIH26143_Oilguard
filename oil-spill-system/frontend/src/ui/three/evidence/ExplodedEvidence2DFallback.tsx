import React, { useState } from 'react'
import type { EvidenceStackData } from '@/ui/hooks/useEvidenceStackData'
import type { EvidencePhase } from './phases'

interface ExplodedEvidence2DFallbackProps {
  stackData: EvidenceStackData
  initialPhase?: EvidencePhase
  onReturnToMap?: () => void
  isStandAlone?: boolean
}

export const ExplodedEvidence2DFallback: React.FC<ExplodedEvidence2DFallbackProps> = ({
  stackData,
  initialPhase = 'exploded',
  onReturnToMap,
}) => {
  const [phase, setPhase] = useState<EvidencePhase>(initialPhase)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const { layers } = stackData

  // Vertical offsets for isometric SVG plates based on phase
  // In SVG, Y increases downwards, so Layer 9 (top) has smallest SVG Y, Layer 1 (bottom) has largest
  const getPlateY = (index: number) => {
    // index 0 (bottom) to 8 (top)
    const reversed = 8 - index // 0 for top layer, 8 for bottom
    if (phase === 'stacked') {
      return 180 + reversed * 12
    }
    if (phase === 'converged') {
      return 100 + reversed * 35
    }
    // Exploded: full vertical spread
    return 60 + reversed * 55
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-[#070b10] text-[#f8f7f4] overflow-hidden select-none font-sans">
      {/* Top Tactical Chrome Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#273340]/60 bg-[#0b1118]/90 px-4 py-3 z-10 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#0057ff]" />
          <div>
            <h3 className="font-mono text-xs font-semibold tracking-wider text-[#f8f7f4] uppercase">
              EXPLODED EVIDENCE STACK // 2D ARCHITECTURAL FALLBACK
            </h3>
            <p className="font-mono text-[10px] text-[#727d89]">
              9-Layer Incident Decomposition · High-Contrast Static Model
            </p>
          </div>
        </div>

        {/* Phase Switcher & Map Return */}
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-[#273340] bg-[#070b10] p-0.5">
            {(['stacked', 'exploded', 'converged'] as EvidencePhase[]).map((p) => (
              <button
                key={p}
                onClick={() => setPhase(p)}
                className={`font-mono text-[10px] uppercase px-2.5 py-1 rounded transition-all duration-100 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-1 focus-visible:ring-offset-abyss cursor-pointer ${
                  phase === p
                    ? 'bg-[#0057ff] text-white font-semibold'
                    : 'text-[#727d89] hover:text-[#b2bbc5]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {onReturnToMap && (
            <button
              onClick={onReturnToMap}
              className="flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase rounded border border-[#273340] hover:border-[#0057ff] bg-[#111923] text-[#b2bbc5] hover:text-[#f8f7f4] transition-all duration-100 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-1 focus-visible:ring-offset-abyss cursor-pointer"
            >
              <span>← RETURN TO MAP</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Diagram Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col lg:flex-row items-center justify-center gap-8">
        {/* Isometric SVG Evidence Plate Projection */}
        <div className="relative w-full max-w-[560px] h-[580px] flex-shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 520 540"
            className="w-full h-full"
            style={{ shapeRendering: 'geometricPrecision' }}
          >
            <defs>
              <linearGradient id="fallbackPlateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#111923" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0b1118" stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {/* Convergence axis line connecting top to bottom */}
            {(phase === 'converged' || phase === 'exploded') && (
              <line
                x1="260"
                y1={getPlateY(8) + 20}
                x2="260"
                y2={getPlateY(0) + 20}
                stroke="#0057ff"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity={phase === 'converged' ? 0.9 : 0.35}
              />
            )}

            {/* 9 Isometric Plates (Render bottom-to-top so top layers render on top) */}
            {layers.map((layer) => {
              const y = getPlateY(layer.def.index)
              const isFocused = focusedId === layer.def.id
              const isDimmed = focusedId !== null && !isFocused

              // Isometric diamond coordinates: Center at (260, y)
              // Points: Top(260, y-25), Right(440, y+15), Bottom(260, y+55), Left(80, y+15)
              const polyPoints = `260,${y - 25} 440,${y + 15} 260,${y + 55} 80,${y + 15}`

              return (
                <g
                  key={layer.def.id}
                  onClick={() => setFocusedId(isFocused ? null : layer.def.id)}
                  className="cursor-pointer transition-opacity duration-200"
                  opacity={isDimmed ? 0.3 : 1.0}
                >
                  {/* Plate Base Surface */}
                  <polygon
                    points={polyPoints}
                    fill="url(#fallbackPlateGrad)"
                    stroke={isFocused ? layer.def.accentColor : '#273340'}
                    strokeWidth={isFocused ? '2' : '1'}
                  />

                  {/* Corner registration crosshairs */}
                  <line x1="80" y1={y + 15} x2="95" y2={y + 10} stroke="#727d89" strokeWidth="1" />
                  <line x1="440" y1={y + 15} x2="425" y2={y + 10} stroke="#727d89" strokeWidth="1" />

                  {/* Center graphic representation */}
                  {layer.def.id === 'attribution' && (
                    <circle cx="260" cy={y + 15} r="7" fill="none" stroke="#0057ff" strokeWidth="2" />
                  )}
                  {layer.def.id === 'source' && (
                    <>
                      <ellipse cx="260" cy={y + 15} rx="28" ry="12" fill="none" stroke="#ffb020" strokeWidth="1.5" />
                      <ellipse cx="260" cy={y + 15} rx="50" ry="20" fill="none" stroke="#ffb020" strokeWidth="1" opacity="0.6" />
                    </>
                  )}
                  {layer.def.id === 'slick' && (
                    <ellipse cx="260" cy={y + 15} rx="36" ry="14" fill="#182432" stroke="#ffb020" strokeWidth="1" />
                  )}
                  {layer.def.id === 'sar' && (
                    <polygon
                      points={`260,${y - 12} 380,${y + 15} 260,${y + 42} 140,${y + 15}`}
                      fill="none"
                      stroke="#00d98b"
                      strokeWidth="1.5"
                    />
                  )}
                  {layer.def.id === 'backtracking' && (
                    <path
                      d={`M 200,${y + 12} Q 230,${y + 20} 260,${y + 15}`}
                      fill="none"
                      stroke="#0057ff"
                      strokeWidth="1.5"
                    />
                  )}
                  {layer.def.id === 'drift' && (
                    <g fill="#00d98b">
                      <circle cx="250" cy={y + 14} r="2" />
                      <circle cx="265" cy={y + 18} r="2" />
                      <circle cx="275" cy={y + 12} r="2" />
                      <circle cx="245" cy={y + 20} r="2" />
                    </g>
                  )}
                  {layer.isUnavailable && (
                    <text
                      x="260"
                      y={y + 18}
                      textAnchor="middle"
                      fill="#727d89"
                      fontSize="9"
                      fontFamily="monospace"
                      letterSpacing="0.1em"
                    >
                      UNAVAILABLE // NOT YET CALCULATED
                    </text>
                  )}

                  {/* Leader line from plate edge to label area */}
                  <line
                    x1="440"
                    y1={y + 15}
                    x2="480"
                    y2={y + 15}
                    stroke={isFocused ? layer.def.accentColor : '#273340'}
                    strokeWidth="1"
                  />
                  <circle cx="480" cy={y + 15} r="2" fill={layer.def.accentColor} />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Layer Annotation Cards Column */}
        <div className="w-full max-w-[420px] flex flex-col gap-2">
          <div className="font-mono text-[10px] text-[#727d89] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>FORENSIC EVIDENCE LAYERS</span>
            <span>{focusedId ? '1 LAYER ISOLATED' : '9 LAYERS ACTIVE'}</span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-1">
            {/* Show top to bottom: index 8 down to 0 */}
            {[...layers].reverse().map((layer) => {
              const isFocused = focusedId === layer.def.id
              return (
                <div
                  key={layer.def.id}
                  onClick={() => setFocusedId(isFocused ? null : layer.def.id)}
                  className={`p-2.5 rounded border transition-all cursor-pointer ${
                    isFocused
                      ? 'border-[#0057ff] bg-[#111923] shadow-md'
                      : 'border-[#273340]/60 bg-[#0b1118]/80 hover:border-[#727d89]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[#0057ff]">
                        {layer.def.numberStr}
                      </span>
                      <span className="font-mono text-xs font-medium text-[#f8f7f4]">
                        {layer.def.title}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                        layer.tone === 'ok'
                          ? 'text-[#00d98b] border-[#00d98b]/40 bg-[#00d98b]/10'
                          : layer.tone === 'warn'
                            ? 'text-[#ffb020] border-[#ffb020]/40 bg-[#ffb020]/10'
                            : layer.tone === 'sonar'
                              ? 'text-[#0057ff] border-[#0057ff]/40 bg-[#0057ff]/10'
                              : 'text-[#727d89] border-[#727d89]/30 bg-[#111923]'
                      }`}
                    >
                      {layer.status}
                    </span>
                  </div>

                  <p className="font-mono text-[10px] text-[#727d89]">
                    {layer.def.descriptor}
                  </p>

                  {/* Metadata fields */}
                  {layer.metadata && (
                    <div className="mt-2 pt-2 border-t border-[#273340]/40 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-[#b2bbc5]">
                      {Object.entries(layer.metadata).map(([k, v]) => (
                        <span key={k}>
                          <span className="text-[#727d89]">{k}:</span> {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer Provenance Note */}
      <footer className="border-t border-[#273340]/60 bg-[#0b1118] px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[10px] text-[#727d89]">
        <span>OILGUARD FORENSIC DECOMPOSITION // NO FABRICATED TELEMETRY</span>
        <span className="text-[#ffb020]">VERIFIED SCIENTIFIC PROVENANCE</span>
      </footer>
    </div>
  )
}

export default ExplodedEvidence2DFallback
