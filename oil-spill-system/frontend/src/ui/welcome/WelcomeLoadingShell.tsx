import type React from 'react'

export const WelcomeLoadingShell: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#070b10] text-[#f8f7f4] flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden select-none">
      {/* Background Graticule */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, #273340 1px, transparent 1px), linear-gradient(to bottom, #273340 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header bar placeholder */}
      <header className="relative z-10 flex items-center justify-between border-b border-[#273340]/60 pb-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#0057ff] animate-ping" />
          <span className="font-mono text-xs font-semibold tracking-widest text-[#f8f7f4] uppercase">
            OILGUARD
          </span>
          <span className="text-[#273340]">/</span>
          <span className="font-mono text-[11px] text-[#727d89] tracking-wider">
            INITIALIZING 3D MARITIME ENGINE...
          </span>
        </div>
        <div className="font-mono text-[10px] text-[#727d89]">
          STATUS: HYDRATING
        </div>
      </header>

      {/* Center radar loader */}
      <main className="relative z-10 my-auto flex flex-col items-center justify-center text-center">
        <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
          {/* Concentric rings */}
          <div className="absolute inset-0 rounded-full border border-[#273340] animate-pulse" />
          <div className="absolute inset-3 rounded-full border border-[#0057ff]/40" />
          <div className="absolute inset-6 rounded-full border border-[#0057ff]/70" />
          {/* Radar sweeping line */}
          <div
            className="absolute inset-0 rounded-full border-t border-[#0057ff] animate-spin"
            style={{ animationDuration: '2s' }}
          />
          <div className="w-2 h-2 rounded-full bg-[#0057ff]" />
        </div>

        <h2 className="font-serif text-2xl sm:text-3xl text-[#f8f7f4] mb-2 tracking-tight">
          Calibrating Ocean Environment
        </h2>
        <p className="font-mono text-xs text-[#727d89] max-w-sm">
          Compiling Gerstner wave displacement shaders and procedural tanker geometry...
        </p>
      </main>

      {/* Footer bar */}
      <footer className="relative z-10 flex items-center justify-between border-t border-[#273340]/60 pt-4 font-mono text-[10px] text-[#727d89]">
        <span>LAT: 24° 18&apos; N · LON: 054° 22&apos; E</span>
        <span>INSTRUMENT AT SEA</span>
      </footer>
    </div>
  )
}

export default WelcomeLoadingShell
