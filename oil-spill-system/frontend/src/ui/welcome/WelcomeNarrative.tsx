import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { SceneScrollState } from './useWelcomeScroll'

interface WelcomeNarrativeProps {
  scrollState: SceneScrollState
  onJumpToSection?: (sectionIndex: number) => void
}

const SECTIONS = [
  { id: 'ocean', label: '01 OCEAN' },
  { id: 'vessel', label: '02 VESSEL' },
  { id: 'spill', label: '03 SPILL' },
  { id: 'reconstruction', label: '04 RECONSTRUCT' },
  { id: 'enter', label: '05 ENTER' },
]

export const WelcomeNarrative: React.FC<WelcomeNarrativeProps> = ({
  scrollState,
  onJumpToSection,
}) => {
  const navigate = useNavigate()
  const activeIdx = scrollState.activeSection

  const handleEnter = () => {
    navigate('/')
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 sm:p-10 z-10 select-none">
      {/* --- TOP INSTRUMENT BAR --- */}
      <header className="flex items-center justify-between border-b border-[#273340]/60 pb-4 pointer-events-auto">
        {/* Brand identity & status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00d98b] animate-pulse" />
            <span className="font-mono text-xs font-semibold tracking-widest text-[#f8f7f4] uppercase">
              OILGUARD
            </span>
          </div>
          <span className="text-[#273340] text-xs">/</span>
          <span className="font-mono text-[11px] text-[#727d89] tracking-wider hidden sm:inline">
            MARITIME FORENSIC INTELLIGENCE
          </span>
        </div>

        {/* Section chapter tabs (clickable for keyboard/mouse convenience) */}
        <nav
          aria-label="Welcome chapter navigation"
          className="hidden md:flex items-center gap-1 bg-[#0b1118]/80 border border-[#273340]/60 px-2 py-1 rounded"
        >
          {SECTIONS.map((sec, idx) => {
            const isActive = idx === activeIdx
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onJumpToSection?.(idx)}
                className={`font-mono text-[10px] tracking-wider px-2.5 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-[#0057ff] text-[#f8f7f4] font-medium'
                    : 'text-[#727d89] hover:text-[#b2bbc5]'
                }`}
              >
                {sec.label}
              </button>
            )
          })}
        </nav>

        {/* Quick entry action */}
        <button
          type="button"
          onClick={handleEnter}
          className="font-mono text-xs tracking-wider px-3.5 py-1.5 rounded border border-[#273340] bg-[#111923]/90 text-[#b2bbc5] hover:text-[#f8f7f4] hover:border-[#0057ff] hover:bg-[#0057ff]/10 transition-all flex items-center gap-2 cursor-pointer"
        >
          <span>COMMAND CENTER</span>
          <span className="text-[#0057ff]">→</span>
        </button>
      </header>

      {/* --- CENTER NARRATIVE VIEWPORT STAGE --- */}
      <main className="flex-1 flex items-center justify-start my-auto py-8">
        <div className="w-full max-w-2xl">
          {/* Section 01: Ocean */}
          <div
            className={`transition-all duration-700 pointer-events-auto ${
              activeIdx === 0
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none absolute'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#273340]/80 bg-[#0b1118]/90 font-mono text-[10px] text-[#0057ff] tracking-widest uppercase mb-4">
              <span>01</span>
              <span className="text-[#727d89]">/</span>
              <span>MARITIME RECONNAISSANCE</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl text-[#f8f7f4] tracking-tight leading-none mb-3">
              OILGUARD
            </h1>

            <p className="font-sans text-lg sm:text-2xl text-[#b2bbc5] font-light leading-snug mb-5">
              Maritime Forensic Intelligence
            </p>

            <blockquote className="border-l-2 border-[#0057ff] pl-4 mb-6">
              <p className="font-serif italic text-base sm:text-lg text-[#f8f7f4]/90">
                &ldquo;From satellite signal to defensible vessel attribution.&rdquo;
              </p>
            </blockquote>

            <p className="font-sans text-sm text-[#727d89] max-w-lg leading-relaxed mb-6">
              Continuous monitoring of global commercial maritime corridors.
              Synthesizing radar aperture sensors, hydrodynamic currents, and
              telemetry to hold polluters accountable.
            </p>

            <div className="flex items-center gap-3 font-mono text-[11px] text-[#727d89]">
              <span className="inline-block w-2 h-2 rounded-full border border-[#0057ff] animate-ping" />
              <span>SCROLL DOWN TO COMMENCE TRAFFIC CORRELATION ↓</span>
            </div>
          </div>

          {/* Section 02: Vessel */}
          <div
            className={`transition-all duration-700 pointer-events-auto ${
              activeIdx === 1
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none absolute'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#273340]/80 bg-[#0b1118]/90 font-mono text-[10px] text-[#0057ff] tracking-widest uppercase mb-4">
              <span>02</span>
              <span className="text-[#727d89]">/</span>
              <span>VESSEL TRACKING</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-5xl text-[#f8f7f4] tracking-tight leading-tight mb-4">
              Commercial Traffic Correlation
            </h2>

            <p className="font-sans text-sm sm:text-base text-[#b2bbc5] leading-relaxed mb-6 max-w-xl">
              Correlating real-time AIS positional transponders and terrestrial receiver networks
              against high-traffic maritime transit lanes. Reconstructing spatial-temporal
              trajectories across international waters.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-[#273340]/60 bg-[#0b1118]/80 p-3.5 rounded text-left max-w-lg mb-4">
              <div>
                <span className="block font-mono text-[10px] text-[#727d89] uppercase">VESSEL CLASS</span>
                <span className="font-mono text-xs text-[#f8f7f4]">VLCC TANKER</span>
              </div>
              <div>
                <span className="block font-mono text-[10px] text-[#727d89] uppercase">HULL DESIGN</span>
                <span className="font-mono text-xs text-[#f8f7f4]">DOUBLE HULL</span>
              </div>
              <div>
                <span className="block font-mono text-[10px] text-[#727d89] uppercase">TELEMETRY</span>
                <span className="font-mono text-xs text-[#00d98b]">AIS VERIFIED</span>
              </div>
            </div>

            <p className="font-mono text-[10px] text-[#727d89]">
              Representative model, not vessel-specific geometry
            </p>
          </div>

          {/* Section 03: Spill */}
          <div
            className={`transition-all duration-700 pointer-events-auto ${
              activeIdx === 2
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none absolute'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#ffb020]/60 bg-[#0b1118]/90 font-mono text-[10px] text-[#ffb020] tracking-widest uppercase mb-4">
              <span>03</span>
              <span className="text-[#727d89]">/</span>
              <span>SURFACE ANOMALY</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-5xl text-[#f8f7f4] tracking-tight leading-tight mb-4">
              Surface Slick Delineation
            </h2>

            <p className="font-sans text-sm sm:text-base text-[#b2bbc5] leading-relaxed mb-5 max-w-xl">
              Synthetic Aperture Radar (SAR) detects surface capillary wave damping,
              revealing thin-film hydrocarbon sheens against natural ocean clutter with
              sub-pixel resolution.
            </p>

            {/* Crucial mandatory disclaimer box */}
            <div className="border border-[#ffb020]/50 bg-[#111923]/90 p-4 rounded max-w-lg mb-5">
              <div className="flex items-center gap-2 text-[#ffb020] font-mono text-xs font-semibold tracking-wider mb-1">
                <span className="w-2 h-2 rounded-full bg-[#ffb020]" />
                <span>ILLUSTRATIVE · NOT LIVE DATA</span>
              </div>
              <p className="font-sans text-xs text-[#b2bbc5] leading-relaxed">
                This visual representation illustrates thin-film physical reflectance.
                Actual operational dossiers incorporate calibrated SAR backscatter and
                multispectral infrared indices.
              </p>
            </div>

            <p className="font-mono text-[10px] text-[#727d89]">
              THIN-FILM INTERFERENCE · HYDROCARBON EMISSION SIGNATURE
            </p>
          </div>

          {/* Section 04: Reconstruction */}
          <div
            className={`transition-all duration-700 pointer-events-auto ${
              activeIdx === 3
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none absolute'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#0057ff]/80 bg-[#0b1118]/90 font-mono text-[10px] text-[#0057ff] tracking-widest uppercase mb-4">
              <span>04</span>
              <span className="text-[#727d89]">/</span>
              <span>FORENSIC RECONSTRUCTION</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-5xl text-[#f8f7f4] tracking-tight leading-tight mb-4">
              Hydrodynamic Backtracking
            </h2>

            {/* Pipeline Stage Badges */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs mb-5">
              <span className="px-2.5 py-1 bg-[#111923] border border-[#273340] text-[#f8f7f4] rounded">
                OBSERVE
              </span>
              <span className="text-[#0057ff]">→</span>
              <span className="px-2.5 py-1 bg-[#111923] border border-[#273340] text-[#f8f7f4] rounded">
                TRACE
              </span>
              <span className="text-[#0057ff]">→</span>
              <span className="px-2.5 py-1 bg-[#111923] border border-[#273340] text-[#f8f7f4] rounded">
                CORRELATE
              </span>
              <span className="text-[#0057ff]">→</span>
              <span className="px-2.5 py-1 bg-[#0057ff]/20 border border-[#0057ff] text-[#00d98b] font-medium rounded">
                ATTRIBUTE
              </span>
            </div>

            <p className="font-sans text-sm sm:text-base text-[#b2bbc5] leading-relaxed mb-5 max-w-xl">
              Reverse Lagrangian particle drift simulations backcast observed slicks through
              ocean current and wind forcing fields, establishing defensible release coordinates
              and matching transit windows.
            </p>

            <div className="font-mono text-[11px] text-[#727d89] border-t border-[#273340]/60 pt-3">
              <span>ILLUSTRATIVE FORENSIC GRAPHICS · SCHEMATIC TRAJECTORY</span>
            </div>
          </div>

          {/* Section 05: Enter Command Center */}
          <div
            className={`transition-all duration-700 pointer-events-auto ${
              activeIdx === 4
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none absolute'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#00d98b]/80 bg-[#0b1118]/90 font-mono text-[10px] text-[#00d98b] tracking-widest uppercase mb-4">
              <span>05</span>
              <span className="text-[#727d89]">/</span>
              <span>COMMAND DEPLOYMENT</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-5xl text-[#f8f7f4] tracking-tight leading-tight mb-4">
              Detect. Reconstruct.<br />Correlate. Attribute.
            </h2>

            <p className="font-sans text-base text-[#b2bbc5] leading-relaxed mb-7 max-w-xl">
              Enter the OilGuard operational workstation. Explore interactive spatial intelligence,
              run hydrodynamic drift models, evaluate vessel candidate scores, and export defensible
              evidentiary dossiers.
            </p>

            {/* Primary Action Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
              <button
                type="button"
                onClick={handleEnter}
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#0057ff] text-[#f8f7f4] font-sans font-semibold text-base rounded shadow-lg shadow-[#0057ff]/25 hover:bg-[#0046d4] active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>ENTER COMMAND CENTER</span>
                <span className="font-mono text-lg transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>

              <span className="font-mono text-xs text-[#727d89] text-center sm:text-left">
                Direct Workstation Access · Live Radar Feeds
              </span>
            </div>

            <div className="flex flex-wrap gap-4 font-mono text-[11px] text-[#727d89] border-t border-[#273340]/60 pt-4">
              <span>• 6 INTEGRATED MODULES</span>
              <span>• EVIDENCE DOSSIER EXPORT</span>
              <span>• DETERMINISTIC RECONSTRUCTION</span>
            </div>
          </div>
        </div>
      </main>

      {/* --- FOOTER PRODUCT CHROME BANNER --- */}
      <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-[#273340]/60 pt-4 gap-2 font-mono text-[11px] text-[#727d89] pointer-events-auto">
        <div className="flex items-center gap-4">
          <span className="text-[#b2bbc5]">OILGUARD // MARITIME FORENSIC INTELLIGENCE</span>
          <span className="text-[#273340] hidden sm:inline">|</span>
          <span className="text-[#ffb020] hidden sm:inline">ILLUSTRATIVE · NOT LIVE DATA</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[#727d89]">INSTRUMENT AT SEA</span>
          <span className="text-[#273340]">|</span>
          <button
            type="button"
            onClick={handleEnter}
            className="text-[#0057ff] hover:underline cursor-pointer"
          >
            Skip Intro →
          </button>
        </div>
      </footer>
    </div>
  )
}

export default WelcomeNarrative
