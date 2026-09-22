import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { oceanVertexShader, oceanFragmentShader } from './shaders/oceanShader'

interface OceanPlaneProps {
  reducedMotion?: boolean
}

export const OceanPlane: React.FC<OceanPlaneProps> = ({ reducedMotion = false }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveHeight: { value: reducedMotion ? 0.2 : 1.0 },
      uColorAbyss: { value: new THREE.Color(0x070b10) },
      uColorTrench: { value: new THREE.Color(0x0b1118) },
      uColorCrest: { value: new THREE.Color(0x1a2634) },
      uFogColor: { value: new THREE.Color(0x070b10) },
      uFogNear: { value: 45.0 },
      uFogFar: { value: 240.0 },
      uLightDir: { value: new THREE.Vector3(0.4, 0.85, 0.35).normalize() },
    }),
    [reducedMotion]
  )

  useFrame((_, delta) => {
    if (!materialRef.current) return
    if (!reducedMotion) {
      materialRef.current.uniforms.uTime.value += delta * 0.9
    }
  })

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[360, 360, 80, 80]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={oceanVertexShader}
        fragmentShader={oceanFragmentShader}
        uniforms={uniforms}
        wireframe={false}
      />
    </mesh>
  )
}

export default OceanPlane
