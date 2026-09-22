import React, { useState, useEffect, useRef, useTransition } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEvidenceStackData } from '@/ui/hooks/useEvidenceStackData'
import { ExplodedEvidenceStack } from './ExplodedEvidenceStack'
import { ExplodedEvidence2DFallback } from './ExplodedEvidence2DFallback'
import type { EvidencePhase } from './phases'
import { prefersReducedMotion } from '@/ui/motion/tokens'

interface EvidenceStackViewportProps {
  onReturnToMap?: () => void
  isIllustrative?: boolean
  initialPhase?: EvidencePhase
}

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(
      (gl && gl instanceof WebGLRenderingContext) ||
        (window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext)
    )
  } catch {
    return false
  }
}

// Bounded interactive camera rig for orbital inspection
function InteractiveCameraRig({
  rotationAngles,
  reducedMotion,
}: {
  rotationAngles: { azimuth: number; elevation: number }
  reducedMotion?: boolean
}) {
  const targetPos = useRef(new THREE.Vector3())
  const lookAtTarget = useRef(new THREE.Vector3(0, 4.5, 0))

  useFrame(({ camera }) => {
    const radius = 32.0
    const phi = THREE.MathUtils.clamp(rotationAngles.elevation, 0.2, 1.4) // Vertical tilt
    const theta = rotationAngles.azimuth // Horizontal orbit

    const x = radius * Math.sin(phi) * Math.sin(theta)
    const y = radius * Math.cos(phi) + 2.0
    const z = radius * Math.sin(phi) * Math.cos(theta)

    targetPos.current.set(x, y, z)

    if (reducedMotion) {
      camera.position.copy(targetPos.current)
      camera.lookAt(lookAtTarget.current)
      return
    }

    camera.position.lerp(targetPos.current, 0.08)
    camera.lookAt(lookAtTarget.current)
  })

  return null
}

export const EvidenceStackViewport: React.FC<EvidenceStackViewportProps> = ({
  onReturnToMap,
  isIllustrative = false,
  initialPhase = 'exploded',
}) => {
  const stackData = useEvidenceStackData(isIllustrative)
  const [phase, setPhase] = useState<EvidencePhase>(initialPhase)
  const [separation, setSeparation] = useState<number>(1.0)
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>(null)

  const [webGLSupported, setWebGLSupported] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [, startTransition] = useTransition()

  // Orbital drag controls
  const [rotationAngles, setRotationAngles] = useState({ azimuth: 0.25, elevation: 0.72 })
  const isDragging = useRef(false)
  const lastMousePos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const hasWebGL = checkWebGLSupport()
    const isReduced = prefersReducedMotion()
    startTransition(() => {
      setWebGLSupported(hasWebGL)
      setReducedMotion(isReduced)
    })
  }, [])

  // Sync separation slider with phase buttons
  const handlePhaseChange = (newPhase: EvidencePhase) => {
    setPhase(newPhase)
    if (newPhase === 'stacked') setSeparation(0.0)
    else if (newPhase === 'exploded') setSeparation(1.0)
    else if (newPhase === 'converged') setSeparation(0.35)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on canvas background
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return
    isDragging.current = true
    lastMousePos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMousePos.current.x
    const dy = e.clientY - lastMousePos.current.y
    lastMousePos.current = { x: e.clientX, y: e.clientY }

    setRotationAngles((prev) => ({
      azimuth: prev.azimuth - dx * 0.008,
      elevation: THREE.MathUtils.clamp(prev.elevation + dy * 0.008, 0.25, 1.35),
    }))
  }

  const handleMouseUp = () => {
    isDragging.current = false
  }

  // Fallback if WebGL unavailable or reduced motion enabled
  if (!webGLSupported || reducedMotion) {
    return (
      <ExplodedEvidence2DFallback
        stackData={stackData}
        initialPhase={phase}
        onReturnToMap={onReturnToMap}
        isStandAlone={true}
      />
    )
  }

  return (
    <div
      className="relative w-full h-full flex flex-col bg-[#070b10] text-[#f8f7f4] overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. Tactical Header & Control Bar */}
      <header className="relative z-20 flex flex-wrap items-center justify-between border-b border-[#273340]/70 bg-[#0b1118]/90 backdrop-blur-md px-4 py-2.5 gap-3 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0057ff] animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-xs font-semibold tracking-wider text-[#f8f7f4] uppercase">
                EXPLODED EVIDENCE STACK // 3D INSTRUMENT
              </h2>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-[#0057ff]/40 bg-[#0057ff]/10 text-[#0057ff]">
                9 LAYERS
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#727d89]">
              Incident Decomposition · Stacked / Exploded / Converged Metaphor
            </p>
          </div>
        </div>

        {/* Phase Buttons & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Phase toggles */}
          <div className="flex items-center rounded border border-[#273340] bg-[#070b10] p-0.5">
            {(['stacked', 'exploded', 'converged'] as EvidencePhase[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePhaseChange(p)}
                className={`font-mono text-[10px] uppercase px-3 py-1 rounded transition-colors cursor-pointer ${
                  phase === p
                    ? 'bg-[#0057ff] text-white font-semibold'
                    : 'text-[#727d89] hover:text-[#b2bbc5]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Separation Slider */}
          <div className="flex items-center gap-2 px-2 py-1 rounded border border-[#273340] bg-[#070b10]">
            <span className="font-mono text-[10px] text-[#727d89] uppercase">Spread:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={separation}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setSeparation(val)
                if (val < 0.2) setPhase('stacked')
                else if (val > 0.7) setPhase('exploded')
                else setPhase('converged')
              }}
              className="w-20 accent-[#0057ff] cursor-pointer"
            />
            <span className="font-mono text-[10px] text-[#b2bbc5] w-7 text-right">
              {Math.round(separation * 100)}%
            </span>
          </div>

          {/* Reset focus if a layer is isolated */}
          {focusedLayerId && (
            <button
              type="button"
              onClick={() => setFocusedLayerId(null)}
              className="font-mono text-[10px] text-[#ffb020] hover:underline cursor-pointer"
            >
              Reset Focus ✕
            </button>
          )}

          {/* Return to Map button */}
          {onReturnToMap && (
            <button
              type="button"
              onClick={onReturnToMap}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wider uppercase rounded border border-[#0057ff]/60 bg-[#0057ff]/15 hover:bg-[#0057ff]/25 text-[#f8f7f4] transition-all cursor-pointer"
            >
              <span>← RETURN TO MAP</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. 3D WebGL Canvas */}
      <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <Canvas
          camera={{ position: [0, 18, 28], fov: 42, near: 0.5, far: 300 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          onCreated={({ scene, gl }) => {
            scene.background = new THREE.Color(0x070b10) // Abyss
            scene.fog = new THREE.Fog(0x070b10, 45, 200)
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.05
          }}
        >
          {/* Interactive Bounded Camera Controller */}
          <InteractiveCameraRig
            rotationAngles={rotationAngles}
            reducedMotion={reducedMotion}
          />

          {/* Lighting */}
          <ambientLight intensity={0.55} color={0x0b1622} />
          <directionalLight
            position={[25, 45, 20]}
            intensity={1.4}
            color={0xdbe7f5}
            castShadow={false}
          />
          <directionalLight
            position={[-30, 15, -25]}
            intensity={0.7}
            color={0x182c40}
          />

          {/* Tactical Base Graticule Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
            <planeGeometry args={[60, 60]} />
            <meshBasicMaterial color={new THREE.Color(0x05080c)} />
          </mesh>

          {/* Exploded Evidence Stack */}
          <ExplodedEvidenceStack
            layers={stackData.layers}
            phase={phase}
            separation={separation}
            focusedLayerId={focusedLayerId}
            onSelectLayer={setFocusedLayerId}
            reducedMotion={reducedMotion}
          />
        </Canvas>

        {/* Orbit hint tooltip overlay */}
        <div className="absolute top-3 left-4 pointer-events-none z-10 font-mono text-[9px] text-[#727d89] bg-[#070b10]/70 px-2 py-1 rounded border border-[#273340]/40">
          Click & drag to rotate view · Click layer badge to isolate
        </div>
      </div>

      {/* 3. Footer Telemetry & Attribution Status */}
      <footer className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-[#273340]/70 bg-[#0b1118] px-4 py-2 font-mono text-[10px] text-[#727d89] gap-2 pointer-events-auto">
        <div className="flex items-center gap-3">
          <span className="text-[#b2bbc5]">
            {stackData.topAttributedVessel
              ? `PRIMARY CANDIDATE: ${stackData.topAttributedVessel.name} (MMSI: ${stackData.topAttributedVessel.mmsi})`
              : 'ATTRIBUTION PIPELINE: STANDBY'}
          </span>
          <span className="text-[#273340] hidden sm:inline">|</span>
          <span className="text-[#ffb020] hidden sm:inline">
            {stackData.topAttributedVessel
              ? `${(stackData.topAttributedVessel.score * 100).toFixed(0)}% COMPOSITE ATTRIBUTION SCORE`
              : 'AWAITING RECONSTRUCTION'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>{stackData.hasIncident ? 'INCIDENT LOCKED' : 'DEFAULT EXTENT'}</span>
          <span className="text-[#273340]">|</span>
          <span className="text-[#727d89]">INSTRUMENT AT SEA</span>
        </div>
      </footer>
    </div>
  )
}

export default EvidenceStackViewport
