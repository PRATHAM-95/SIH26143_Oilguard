import React, { useMemo } from 'react'
import * as THREE from 'three'
import type { EvidenceLayerState } from '@/ui/hooks/useEvidenceStackData'
import { EvidenceStackLayer } from './EvidenceStackLayer'
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
}) => {
  // Target separation based on explicit separation or phase
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

  // Top attribution target location for the convergence resolution line
  const attributionTarget = useMemo(() => {
    const topLayer = layers.find((l) => l.def.id === 'attribution')
    return topLayer?.centerPoint || [-5.5, -3.8]
  }, [layers])

  // Convergence vertical resolution line
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
