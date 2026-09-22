import React from 'react'
import { useNavigate } from 'react-router-dom'

interface WelcomeFallbackProps {
  reason?: 'no-webgl' | 'reduced-motion' | 'user-choice'
}

export const WelcomeFallback: React.FC<WelcomeFallbackProps> = () => {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full bg-[#070b10] text-[#f8f7f4] flex flex-col justify-between p-6 sm:p-12 overflow-x-hidden">
      {/* Background Graticule Lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, #273340 1px, transparent 1px), linear-gradient(to bottom, #273340 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top Instrument Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-[#273340]/60 pb-5">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00d98b]" />
          <span className="font-mono text-sm font-semibold tracking-widest text-[#f8f7f4] uppercase">
            OILGUARD
          </span>
          <span className="text-[#273340]">/</span>
          <span className="font-mono text-xs text-[#727d89] tracking-wider hidden sm:inline">
            MARITIME FORENSIC INTELLIGENCE
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-mono text-xs tracking-wider px-4 py-2 rounded border border-[#273340] bg-[#111923] text-[#b2bbc5] hover:text-[#f8f7f4] hover:border-[#0057ff] transition-all cursor-pointer"
        >
          ENTER COMMAND CENTER →
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 my-auto py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center max-w-7xl mx-auto w-full">
        {/* Left Column: Editorial Narrative */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-[#273340] bg-[#0b1118] font-mono text-[10px] text-[#0057ff] tracking-widest uppercase mb-5 w-fit">
            <span>FORENSIC SURVEILLANCE INSTRUMENT</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-6xl text-[#f8f7f4] tracking-tight leading-none mb-4">
            OILGUARD
          </h1>

          <p className="font-sans text-xl sm:text-2xl text-[#b2bbc5] font-light leading-snug mb-6">
            From satellite signal to defensible vessel attribution.
          </p>

          <p className="font-sans text-sm sm:text-base text-[#727d89] max-w-xl leading-relaxed mb-8">
            An operational intelligence platform synthesizing Synthetic Aperture Radar (SAR),
            multispectral optical imagery, and terrestrial AIS telemetry to detect marine
            hydrocarbon spills, reconstruct physical drift, and build legally defensible
            vessel attribution dossiers.
          </p>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-8 py-4 bg-[#0057ff] hover:bg-[#0046d4] text-[#f8f7f4] font-sans font-semibold text-base rounded shadow-lg shadow-[#0057ff]/20 transition-all cursor-pointer text-center"
            >
              ENTER COMMAND CENTER →
            </button>
            <span className="font-mono text-xs text-[#727d89]">
              Full Workstation & Simulation Access
            </span>
          </div>

          {/* Forensic Pipeline Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#273340]/60 pt-6">
            <div className="border border-[#273340]/50 bg-[#0b1118]/80 p-3 rounded">
              <span className="block font-mono text-[10px] text-[#0057ff] mb-1">01 / DETECT</span>
              <span className="block font-sans text-xs text-[#b2bbc5]">SAR wave damping anomaly</span>
            </div>
            <div className="border border-[#273340]/50 bg-[#0b1118]/80 p-3 rounded">
              <span className="block font-mono text-[10px] text-[#0057ff] mb-1">02 / TRACE</span>
              <span className="block font-sans text-xs text-[#b2bbc5]">Lagrangian drift backcast</span>
            </div>
            <div className="border border-[#273340]/50 bg-[#0b1118]/80 p-3 rounded">
              <span className="block font-mono text-[10px] text-[#0057ff] mb-1">03 / CORRELATE</span>
              <span className="block font-sans text-xs text-[#b2bbc5]">AIS transit track intersection</span>
            </div>
            <div className="border border-[#273340]/50 bg-[#0b1118]/80 p-3 rounded">
              <span className="block font-mono text-[10px] text-[#00d98b] mb-1">04 / ATTRIBUTE</span>
              <span className="block font-sans text-xs text-[#b2bbc5]">Publication-grade dossier</span>
            </div>
          </div>
        </div>

        {/* Right Column: Architectural SVG Blueprint Schematic */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-md border border-[#273340] bg-[#0b1118]/90 rounded p-6 shadow-2xl relative">
            {/* Header tag */}
            <div className="flex items-center justify-between font-mono text-[10px] text-[#727d89] border-b border-[#273340]/50 pb-3 mb-4">
              <span>SCHEMATIC VESSEL PROFILE</span>
              <span className="text-[#0057ff]">VLCC COMMERCIAL TANKER</span>
            </div>

            {/* Architectural SVG Tanker Blueprint */}
            <svg
              viewBox="0 0 400 200"
              className="w-full h-auto text-[#b2bbc5]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Radar origin concentric circles */}
              <circle cx="80" cy="140" r="45" stroke="#273340" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx="80" cy="140" r="25" stroke="#0057ff" strokeWidth="1" strokeOpacity="0.6" />
              <circle cx="80" cy="140" r="4" fill="#0057ff" />

              {/* Backtrack vector line */}
              <path
                d="M 80 140 Q 140 120 220 100"
                stroke="#0057ff"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />

              {/* Oil Sheen Contour Metaphor */}
              <path
                d="M 50 140 C 70 120, 110 130, 140 115 C 170 100, 200 110, 210 100 C 190 125, 140 145, 90 155 Z"
                fill="#182432"
                fillOpacity="0.5"
                stroke="#273340"
                strokeWidth="1"
              />

              {/* Tanker Hull Silhouette */}
              {/* Main Hull */}
              <path
                d="M 180 85 L 340 85 L 370 95 L 365 110 L 180 110 Z"
                fill="#111923"
                stroke="#727d89"
                strokeWidth="1.5"
              />
              {/* Waterline band */}
              <line x1="180" y1="102" x2="367" y2="102" stroke="#ff4d5a" strokeWidth="1" strokeOpacity="0.5" />

              {/* Superstructure / Bridge */}
              <rect x="195" y="55" width="35" height="30" fill="#1b2533" stroke="#727d89" strokeWidth="1.5" />
              <rect x="200" y="45" width="25" height="10" fill="#273340" stroke="#727d89" strokeWidth="1" />
              <rect x="193" y="60" width="39" height="3" fill="#0057ff" fillOpacity="0.4" />

              {/* Smokestack / Funnel */}
              <rect x="186" y="50" width="7" height="20" fill="#0e151e" stroke="#727d89" strokeWidth="1" />

              {/* Radar Mast */}
              <line x1="212" y1="45" x2="212" y2="28" stroke="#f8f7f4" strokeWidth="1.5" />
              <line x1="206" y1="34" x2="218" y2="34" stroke="#f8f7f4" strokeWidth="1" />

              {/* Deck Pipings & Hatches */}
              <line x1="240" y1="82" x2="335" y2="82" stroke="#3d4b5c" strokeWidth="2" />
              <rect x="250" y="80" width="12" height="5" fill="#273340" />
              <rect x="280" y="80" width="12" height="5" fill="#273340" />
              <rect x="310" y="80" width="12" height="5" fill="#273340" />

              {/* Bow Mast */}
              <line x1="355" y1="90" x2="355" y2="72" stroke="#727d89" strokeWidth="1" />

              {/* Schematic Labels */}
              <text x="20" y="145" fill="#727d89" fontSize="9" fontFamily="monospace">ORIGIN LOCUS</text>
              <text x="245" y="130" fill="#727d89" fontSize="9" fontFamily="monospace">AIS TRACK // 14.2 KTS</text>
            </svg>

            {/* Technical Disclaimer Notice */}
            <div className="mt-4 border-t border-[#273340]/60 pt-3 flex items-center justify-between font-mono text-[9px] text-[#727d89]">
              <span className="text-[#ffb020]">ILLUSTRATIVE METAPHOR</span>
              <span>NO FABRICATED TELEMETRY</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Technical Datum */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-[#273340]/60 pt-4 gap-2 font-mono text-[11px] text-[#727d89]">
        <div>
          <span>LAT: 24° 18&apos; N · LON: 054° 22&apos; E · WGS84</span>
        </div>
        <div>
          <span>OILGUARD MARITIME FORENSIC ENGINE</span>
        </div>
      </footer>
    </div>
  )
}

export default WelcomeFallback
