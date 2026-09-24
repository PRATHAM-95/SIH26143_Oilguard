import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sheenVertexShader, sheenFragmentShader } from './shaders/sheenShader'
import type { WelcomeScrollRef } from './useWelcomeScroll'

interface OilSheenProps {
  scrollRef: WelcomeScrollRef
  reducedMotion?: boolean
}

export const OilSheen: React.FC<OilSheenProps> = ({
  scrollRef,
  reducedMotion = false,
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColorPetroleum: { value: new THREE.Color(0x060a0e) }, // Deep hydrocarbon
      uColorSheen: { value: new THREE.Color(0x182432) },     // Metallic bronze-slate
      uColorGlance: { value: new THREE.Color(0x243545) },    // Restrained petroleum sheen
      uFogColor: { value: new THREE.Color(0x070b10) },
      uFogNear: { value: 30.0 },
      uFogFar: { value: 160.0 },
    }),
    []
  )

  useFrame((_, delta) => {
    if (!materialRef.current) return
    const opacity = scrollRef.current.sheenOpacity
    // Smoothly update opacity uniform
    materialRef.current.uniforms.uOpacity.value = opacity
    // Skip the (comparatively expensive) interference time animation while hidden
    if (opacity > 0.001 && !reducedMotion) {
      materialRef.current.uniforms.uTime.value += delta * 0.7
    }
  })

  // Positioned slightly above ocean plane (y = 0.08) to prevent z-fighting
  // Trailing aft-port of the vessel in its wake
  return (
    <group position={[-1.2, 0.08, -12]}>
      {/* Primary plume plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0.15]}>
        <planeGeometry args={[36, 18, 32, 16]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={sheenVertexShader}
          fragmentShader={sheenFragmentShader}
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export default OilSheen