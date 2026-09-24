import React, { useRef, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EvidenceLayerState } from '@/ui/hooks/useEvidenceStackData'
import { EvidenceStackLayer, type EvidenceStackDrive } from './EvidenceStackLayer'
import {
  type EvidencePhase,
  calculateLayerY,
  calculateLayerOpacity,
  STACKED_SEPARATION,
  EXPLODED_SEPARATION,
  CONVERGED_SEPARATION,
} from './phases'

interface ExplodedEvidenceStackProps {
  layers: EvidenceLayerState[]
  phase?: EvidencePhase
  separation?: number // Optional explicit separation 0..1
  focusedLayerId?: string | null
  onSelectLayer?: (layerId: string | null) => void
  opacity?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  showLabels?: boolean
  reducedMotion?: boolean
  /** Present => imperative scroll-driven mode (Welcome). */
  driveRef?: MutableRefObject<EvidenceStackDrive>
}

interface ConvergenceAssets {
  line: THREE.Line
  lineMaterial: THREE.LineBasicMaterial
  ringMaterial: THREE.MeshBasicMaterial
}

/**
 * Imperative frame loop for the drive-driven Welcome mode: applies subtle
 * counter-drift positional parallax and gates the convergence resolution vector.
 */
function DriveFrameLoop({
  rootRef,
  driveRef,
  basePosition,
  lineMaterial,
  ringMaterial,
  reducedMotion,
}: {
  rootRef: MutableRefObject<THREE.Group | null>
  driveRef: MutableRefObject<EvidenceStackDrive>
  basePosition: [number, number, number]
  lineMaterial: THREE.LineBasicMaterial
  ringMaterial: THREE.MeshBasicMaterial
  reducedMotion: boolean
}) {
  useFrame(() => {
    const { opacity, phase, separation, driftX } = driveRef.current
    if (rootRef.current) {
      // Restrained deterministic counter-drift parallax (skipped under reduced motion)
      rootRef.current.position.set(
        reducedMotion ? basePosition[0] : basePosition[0] + driftX,
        basePosition[1],
        basePosition[2]
      )
    }
    // Convergence resolution vector visible only once the stack converges
    const active = phase === 'converged' || separation < 0.5
    lineMaterial.opacity = active ? 0.75 * opacity : 0
    ringMaterial.opacity = active ? 0.8 * opacity : 0
  })
  return null
}

export const ExplodedEvidenceStack: React.FC<ExplodedEvidenceStackProps> = ({
  layers,
  phase = 'exploded',
  separation,
  focusedLayerId = null,
  onSelectLayer,
  opacity = 1.0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  showLabels = true,
  reducedMotion = false,
  driveRef,
}) => {
  const rootRef = useRef<THREE.Group>(null)
  const driven = driveRef !== undefined && driveRef !== null

  // Top attribution target location for the convergence resolution line
  const attributionTarget = useMemo(() => {
    const topLayer = layers.find((l) => l.def.id === 'attribution')
    return topLayer?.centerPoint || [-5.5, -3.8]
  }, [layers])

  // Once-built convergence assets for the driven mode.
  const convergence = useMemo<ConvergenceAssets | null>(() => {
    if (!driven) return null
    const [tx, tz] = attributionTarget
    // Stately line spanning the fully erupted stack
    const topY = calculateLayerY(layers.length - 1, 1.0, 'exploded') + 0.5
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tx, 0, tz),
      new THREE.Vector3(tx, topY, tz),
    ])
    const lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(0x0057ff),
      transparent: true,
      opacity: 0,
    })
    const line = new THREE.Line(geometry, lineMaterial)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x0057ff),
      transparent: true,
      opacity: 0,
    })
    return { line, lineMaterial, ringMaterial }
  }, [driven, attributionTarget, layers.length])

  // Prop-driven target separation based on explicit separation or phase
  const targetSeparation = useMemo(() => {
    if (separation !== undefined) return separation
    switch (phase) {
      case 'stacked':
        return STACKED_SEPARATION
      case 'converged':
        return CONVERGED_SEPARATION
      case 'exploded':
      default:
        return EXPLODED_SEPARATION
    }
  }, [separation, phase])

  const convergenceLineGeometry = useMemo(() => {
    const [tx, tz] = attributionTarget
    const topY = calculateLayerY(layers.length - 1, 1.0, phase) + 0.5
    const bottomY = 0.0
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tx, bottomY, tz),
      new THREE.Vector3(tx, topY, tz),
    ])
  }, [attributionTarget, layers.length, phase])

  const focusedIndex = useMemo(() => {
    if (!focusedLayerId) return null
    const idx = layers.findIndex((l) => l.def.id === focusedLayerId)
    return idx >= 0 ? idx : null
  }, [layers, focusedLayerId])

  // --- Imperative driven mode (Welcome) ---
  if (driven && convergence) {
    return (
      <group ref={rootRef} rotation={rotation} scale={scale}>
        {layers.map((layer, idx) => (
          <EvidenceStackLayer
            key={layer.def.id}
            layer={layer}
            targetY={0}
            opacity={1}
            isFocused={false}
            showLabels={showLabels}
            reducedMotion={reducedMotion}
            layerIndex={idx}
            driveRef={driveRef}
            onClick={() => onSelectLayer?.(null)}
          />
        ))}

        {/* Restrained Convergence Resolution Vector */}
        <primitive object={convergence.line} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[attributionTarget[0], 0.04, attributionTarget[1]]}
        >
          <ringGeometry args={[0.5, 0.65, 32]} />
          <primitive object={convergence.ringMaterial} attach="material" />
        </mesh>

        <DriveFrameLoop
          rootRef={rootRef}
          driveRef={driveRef}
          basePosition={position}
          lineMaterial={convergence.lineMaterial}
          ringMaterial={convergence.ringMaterial}
          reducedMotion={reducedMotion}
        />
      </group>
    )
  }

  // --- Prop-driven mode (Investigation evidence view, unchanged) ---
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* 9 Forensic Evidence Layers */}
      {layers.map((layer, idx) => {
        const targetY = calculateLayerY(idx, targetSeparation, phase)
        const isFocused = focusedLayerId === layer.def.id
        const layerOpacity = calculateLayerOpacity(idx, focusedIndex, opacity)

        return (
          <EvidenceStackLayer
            key={layer.def.id}
            layer={layer}
            targetY={targetY}
            opacity={layerOpacity}
            isFocused={isFocused}
            showLabels={showLabels}
            reducedMotion={reducedMotion}
            onClick={() => {
              if (onSelectLayer) {
                onSelectLayer(isFocused ? null : layer.def.id)
              }
            }}
          />
        )
      })}

      {/* Restrained Convergence Resolution Vector */}
      {(phase === 'converged' || (separation !== undefined && separation < 0.5)) && (
        <group>
          <primitive
            object={
              new THREE.Line(
                convergenceLineGeometry,
                new THREE.LineBasicMaterial({
                  color: new THREE.Color(0x0057ff),
                  transparent: true,
                  opacity: 0.75 * opacity,
                })
              )
            }
          />
          {/* Subtle convergence ground reticle */}
          <mesh position={[attributionTarget[0], 0.04, attributionTarget[1]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.65, 32]} />
            <meshBasicMaterial
              color={new THREE.Color(0x0057ff)}
              transparent
              opacity={0.8 * opacity}
            />
          </mesh>
        </group>
      )}
    </group>
  )
}

export default ExplodedEvidenceStack