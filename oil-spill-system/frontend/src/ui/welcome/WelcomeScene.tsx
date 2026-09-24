import React, { useRef, memo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import OceanPlane from './OceanPlane'
import TankerModel from './TankerModel'
import OilSheen from './OilSheen'
import ReconstructionGraphics from './ReconstructionGraphics'
import { ExplodedEvidenceStack } from '../three/evidence/ExplodedEvidenceStack'
import type { EvidenceStackDrive } from '../three/evidence/EvidenceStackLayer'
import { useEvidenceStackData } from '../hooks/useEvidenceStackData'
import { type WelcomeScrollRef } from './useWelcomeScroll'

interface WelcomeSceneProps {
  scrollRef: WelcomeScrollRef
  activeSection: number
  reducedMotion?: boolean
  showStackLabels: boolean
}

// Zero-allocation, frame-rate-independent camera controller running inside Canvas.
// Reads the latest scene frame imperatively from the scroll ref each frame.
function CameraRig({
  scrollRef,
  reducedMotion,
}: {
  scrollRef: WelcomeScrollRef
  reducedMotion?: boolean
}) {
  const lookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0))
  const posTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0))
  const lookTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0))

  useFrame(({ camera }, delta) => {
    const { cameraPosition, cameraTarget } = scrollRef.current
    posTarget.current.set(cameraPosition[0], cameraPosition[1], cameraPosition[2])
    lookTarget.current.set(cameraTarget[0], cameraTarget[1], cameraTarget[2])

    if (reducedMotion) {
      camera.position.copy(posTarget.current)
      lookAtRef.current.copy(lookTarget.current)
      camera.lookAt(lookAtRef.current)
      return
    }

    // Single smoothing stage, frame-rate independent (no double-smoothing)
    const damp = 1 - Math.exp(-8 * delta)
    camera.position.lerp(posTarget.current, damp)
    lookAtRef.current.lerp(lookTarget.current, damp)
    camera.lookAt(lookAtRef.current)
  })

  return null
}

// Drives the evidence stack's imperative state from the single scroll ref.
function StackDriver({
  scrollRef,
  driveRef,
}: {
  scrollRef: WelcomeScrollRef
  driveRef: React.MutableRefObject<EvidenceStackDrive>
}) {
  useFrame(() => {
    const progress = scrollRef.current.progress
    // Stack choreography within the Reconstruction section's viewing window
    const scene04Norm = Math.max(0, Math.min(1, (progress - 0.5) / 0.34))

    let phase: EvidenceStackDrive['phase']
    if (scene04Norm < 0.35) {
      phase = 'stacked'
    } else if (scene04Norm < 0.7) {
      phase = 'exploded'
    } else {
      phase = 'converged'
    }

    let separation: number
    if (scene04Norm < 0.35) {
      separation = (scene04Norm / 0.35) * 0.35
    } else if (scene04Norm < 0.7) {
      separation = 0.35 + ((scene04Norm - 0.35) / 0.35) * 0.65
    } else {
      separation = 0.35
    }

    // Restrained deterministic counter-drift parallax derived purely from progress
    const drift = (progress - 0.5) * 1.2

    driveRef.current.separation = separation
    driveRef.current.phase = phase
    driveRef.current.opacity = scrollRef.current.reconstructionOpacity
    driveRef.current.driftX = -drift * 0.5
  })

  return null
}

export const WelcomeScene = memo(function WelcomeScene({
  scrollRef,
  activeSection,
  reducedMotion = false,
  showStackLabels = true,
}: WelcomeSceneProps) {
  const stackData = useEvidenceStackData(true)
  const stackDriveRef = useRef<EvidenceStackDrive>({
    separation: 0,
    phase: 'stacked',
    opacity: 0,
    driftX: 0,
  })

  // Reconstruction & evidence layers mount with the Reconstruction section
  // (or always under reduced motion, preserving the static scene composition)
  const showReconstruction = activeSection >= 2 || reducedMotion

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <Canvas
        style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
        camera={{ position: [0, 22, 42], fov: 42, near: 0.5, far: 300 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ scene, gl }) => {
          scene.background = new THREE.Color(0x070b10) // Abyss
          scene.fog = new THREE.Fog(0x070b10, 45, 240)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        {/* Camera choreography controller */}
        <CameraRig scrollRef={scrollRef} reducedMotion={reducedMotion} />

        {/* --- LIGHTING --- */}
        {/* Maritime ambient fill */}
        <ambientLight intensity={0.45} color={0x0b1622} />

        {/* Directional moonlight / searchlight */}
        <directionalLight
          position={[25, 45, 20]}
          intensity={1.35}
          color={0xdbe7f5}
          castShadow={false}
        />

        {/* Low-angle maritime horizon kicker light */}
        <directionalLight
          position={[-30, 10, -25]}
          intensity={0.65}
          color={0x182c40}
        />

        {/* --- 3D SCENE OBJECTS --- */}
        <OceanPlane reducedMotion={reducedMotion} />

        <TankerModel scrollRef={scrollRef} reducedMotion={reducedMotion} />

        <OilSheen scrollRef={scrollRef} reducedMotion={reducedMotion} />

        {showReconstruction && (
          <ReconstructionGraphics
            scrollRef={scrollRef}
            reducedMotion={reducedMotion}
          />
        )}

        {/* 9-Layer Exploded Evidence Stack in the Reconstruction section */}
        {showReconstruction && (
          <StackDriver scrollRef={scrollRef} driveRef={stackDriveRef} />
        )}
        {showReconstruction && (
          <ExplodedEvidenceStack
            layers={stackData.layers}
            driveRef={stackDriveRef}
            position={[-5, 0.4, -12]}
            rotation={[0, -0.15, 0]}
            scale={0.7}
            showLabels={showStackLabels}
            reducedMotion={reducedMotion}
          />
        )}
      </Canvas>
    </div>
  )
})

export default WelcomeScene