import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import OceanPlane from './OceanPlane'
import TankerModel from './TankerModel'
import OilSheen from './OilSheen'
import ReconstructionGraphics from './ReconstructionGraphics'
import { ExplodedEvidenceStack } from '../three/evidence/ExplodedEvidenceStack'
import { useEvidenceStackData } from '../hooks/useEvidenceStackData'
import type { EvidencePhase } from '../three/evidence/phases'
import type { SceneScrollState } from './useWelcomeScroll'

interface WelcomeSceneProps {
  scrollState: SceneScrollState
  reducedMotion?: boolean
}

// Camera controller component running inside Canvas
function CameraRig({
  targetPos,
  targetLookAt,
  reducedMotion,
}: {
  targetPos: [number, number, number]
  targetLookAt: [number, number, number]
  reducedMotion?: boolean
}) {
  const lookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(...targetLookAt))

  useFrame(({ camera }) => {
    if (reducedMotion) {
      camera.position.set(...targetPos)
      camera.lookAt(...targetLookAt)
      return
    }

    // Smooth damping toward target position (frame-rate independent lerp)
    camera.position.lerp(new THREE.Vector3(...targetPos), 0.08)

    // Smooth damping toward lookAt point
    lookAtRef.current.lerp(new THREE.Vector3(...targetLookAt), 0.08)
    camera.lookAt(lookAtRef.current)
  })

  return null
}

export const WelcomeScene: React.FC<WelcomeSceneProps> = ({
  scrollState,
  reducedMotion = false,
}) => {
  const stackData = useEvidenceStackData(true)

  // In Scene 04: scroll progress is approximately 0.58 to 0.82
  const progress = scrollState.progress
  const scene04Norm = Math.max(0, Math.min(1, (progress - 0.58) / 0.24))

  // Determine stack phase & separation from scroll progress
  const stackPhase: EvidencePhase =
    scene04Norm < 0.35 ? 'stacked' : scene04Norm < 0.7 ? 'exploded' : 'converged'
  const stackSeparation =
    scene04Norm < 0.35
      ? (scene04Norm / 0.35) * 0.35
      : scene04Norm < 0.7
        ? 0.35 + ((scene04Norm - 0.35) / 0.35) * 0.65
        : 0.35

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
        <CameraRig
          targetPos={scrollState.cameraPosition}
          targetLookAt={scrollState.cameraTarget}
          reducedMotion={reducedMotion}
        />

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

        <TankerModel
          reducedMotion={reducedMotion}
          opacity={scrollState.vesselOpacity}
        />

        <OilSheen
          reducedMotion={reducedMotion}
          opacity={scrollState.sheenOpacity}
        />

        <ReconstructionGraphics
          reducedMotion={reducedMotion}
          opacity={scrollState.reconstructionOpacity}
        />

        {/* 9-Layer Exploded Evidence Stack in Scene 04 */}
        {scrollState.reconstructionOpacity > 0.01 && (
          <ExplodedEvidenceStack
            layers={stackData.layers}
            phase={stackPhase}
            separation={stackSeparation}
            opacity={scrollState.reconstructionOpacity}
            position={[-5, 0.4, -12]}
            rotation={[0, -0.15, 0]}
            scale={0.7}
            showLabels={true}
            reducedMotion={reducedMotion}
          />
        )}
      </Canvas>
    </div>
  )
}

export default WelcomeScene

