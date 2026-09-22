import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { EvidenceLayerState } from '@/ui/hooks/useEvidenceStackData'
import { EVIDENCE_PLATE_WIDTH, EVIDENCE_PLATE_DEPTH } from './project'

interface EvidenceStackLayerProps {
  layer: EvidenceLayerState
  targetY: number
  opacity: number
  isFocused: boolean
  showLabels?: boolean
  reducedMotion?: boolean
  onClick?: () => void
}

export const EvidenceStackLayer: React.FC<EvidenceStackLayerProps> = ({
  layer,
  targetY,
  opacity,
  isFocused,
  showLabels = true,
  reducedMotion = false,
  onClick,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (reducedMotion) {
      groupRef.current.position.y = targetY
      return
    }
    const factor = Math.min(1, delta * 6.0)
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * factor
  })
  const { def, status, tone, isUnavailable, polygons, lines, points, centerPoint } = layer

  // Semi-transparent plate backing material
  const plateMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(isFocused ? 0x111923 : 0x0b1118),
      transparent: true,
      opacity: 0.55 * opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [opacity, isFocused])

  // Outer border lines
  const borderGeometry = useMemo(() => {
    const hw = EVIDENCE_PLATE_WIDTH / 2
    const hd = EVIDENCE_PLATE_DEPTH / 2
    const pts = [
      new THREE.Vector3(-hw, 0, -hd),
      new THREE.Vector3(hw, 0, -hd),
      new THREE.Vector3(hw, 0, hd),
      new THREE.Vector3(-hw, 0, hd),
      new THREE.Vector3(-hw, 0, -hd),
    ]
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])

  // Corner registration tick marks (tactical blueprint marks)
  const cornerTicksGeometry = useMemo(() => {
    const hw = EVIDENCE_PLATE_WIDTH / 2
    const hd = EVIDENCE_PLATE_DEPTH / 2
    const tickLen = 0.6
    const pts: THREE.Vector3[] = [
      // Top-left
      new THREE.Vector3(-hw, 0, -hd),
      new THREE.Vector3(-hw + tickLen, 0, -hd),
      new THREE.Vector3(-hw, 0, -hd),
      new THREE.Vector3(-hw, 0, -hd + tickLen),
      // Top-right
      new THREE.Vector3(hw, 0, -hd),
      new THREE.Vector3(hw - tickLen, 0, -hd),
      new THREE.Vector3(hw, 0, -hd),
      new THREE.Vector3(hw, 0, -hd + tickLen),
      // Bottom-right
      new THREE.Vector3(hw, 0, hd),
      new THREE.Vector3(hw - tickLen, 0, hd),
      new THREE.Vector3(hw, 0, hd),
      new THREE.Vector3(hw, 0, hd - tickLen),
      // Bottom-left
      new THREE.Vector3(-hw, 0, hd),
      new THREE.Vector3(-hw + tickLen, 0, hd),
      new THREE.Vector3(-hw, 0, hd),
      new THREE.Vector3(-hw, 0, hd - tickLen),
    ]
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])

  // Line segments for layer data (footprints, trajectories, contour rings)
  const dataLinesGeometry = useMemo(() => {
    if (!lines || lines.length === 0) return null
    const pts: THREE.Vector3[] = []
    lines.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        pts.push(new THREE.Vector3(line[i][0], 0.02, line[i][1]))
        pts.push(new THREE.Vector3(line[i + 1][0], 0.02, line[i + 1][1]))
      }
    })
    if (pts.length === 0) return null
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [lines])

  // Points geometry (forward drift particles)
  const dataPointsGeometry = useMemo(() => {
    if (!points || points.length === 0) return null
    const pts = points.map(([x, z]) => new THREE.Vector3(x, 0.03, z))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [points])

  // Slick polygon shape geometry
  const slickShapeGeometry = useMemo(() => {
    if (!polygons || polygons.length === 0) return null
    const poly = polygons[0]
    if (poly.length < 3) return null
    const shape = new THREE.Shape()
    shape.moveTo(poly[0][0], poly[0][1])
    for (let i = 1; i < poly.length; i++) {
      shape.lineTo(poly[i][0], poly[i][1])
    }
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [polygons])

  // Tone styling for badge
  const toneClasses = {
    ok: 'text-[#00d98b] border-[#00d98b]/40 bg-[#00d98b]/10',
    warn: 'text-[#ffb020] border-[#ffb020]/40 bg-[#ffb020]/10',
    sonar: 'text-[#0057ff] border-[#0057ff]/40 bg-[#0057ff]/10',
    dim: 'text-[#727d89] border-[#727d89]/30 bg-[#111923]/80',
    danger: 'text-[#ff4d5a] border-[#ff4d5a]/40 bg-[#ff4d5a]/10',
  }[tone]

  return (
    <group ref={groupRef} position={[0, targetY, 0]}>
      {/* 1. Base semi-transparent plate */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        material={plateMaterial}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
      >
        <planeGeometry args={[EVIDENCE_PLATE_WIDTH, EVIDENCE_PLATE_DEPTH]} />
      </mesh>

      {/* 2. Plate edge border */}
      <primitive
        object={
          new THREE.Line(
            borderGeometry,
            new THREE.LineBasicMaterial({
              color: isFocused ? new THREE.Color(def.accentColor) : new THREE.Color(0x273340),
              transparent: true,
              opacity: (isFocused ? 0.95 : 0.45) * opacity,
            })
          )
        }
      />

      {/* 3. Corner tick marks */}
      <primitive
        object={
          new THREE.LineSegments(
            cornerTicksGeometry,
            new THREE.LineBasicMaterial({
              color: new THREE.Color(0x727d89),
              transparent: true,
              opacity: 0.65 * opacity,
            })
          )
        }
      />

      {/* 4. Layer specific graphics */}
      {/* 4a. Lines / contours / footprints */}
      {dataLinesGeometry && (
        <primitive
          object={
            new THREE.LineSegments(
              dataLinesGeometry,
              new THREE.LineBasicMaterial({
                color: new THREE.Color(def.accentColor),
                transparent: true,
                opacity: 0.85 * opacity,
              })
            )
          }
        />
      )}

      {/* 4b. Oil slick shape */}
      {slickShapeGeometry && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <primitive object={slickShapeGeometry} attach="geometry" />
          <meshBasicMaterial
            color={new THREE.Color(0x182432)}
            transparent
            opacity={0.8 * opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* 4c. Particle cloud (drift) */}
      {dataPointsGeometry && (
        <primitive
          object={
            new THREE.Points(
              dataPointsGeometry,
              new THREE.PointsMaterial({
                color: new THREE.Color(def.accentColor),
                size: 0.15,
                transparent: true,
                opacity: 0.85 * opacity,
              })
            )
          }
        />
      )}

      {/* 4d. Center target / reticle for Attribution (Layer 9) or Origin (Layer 6/8) */}
      {centerPoint && (
        <group position={[centerPoint[0], 0.03, centerPoint[1]]}>
          {/* Target reticle rings */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.42, 24]} />
            <meshBasicMaterial
              color={new THREE.Color(def.accentColor)}
              transparent
              opacity={0.9 * opacity}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 16]} />
            <meshBasicMaterial
              color={new THREE.Color(def.accentColor)}
              transparent
              opacity={0.95 * opacity}
            />
          </mesh>
        </group>
      )}

      {/* 4e. Unavailable / honest grid placeholder watermark for unavailable layers */}
      {isUnavailable && (
        <group position={[0, 0.02, 0]}>
          {/* Faint diagonal registration hash lines */}
          <primitive
            object={
              new THREE.LineSegments(
                new THREE.BufferGeometry().setFromPoints([
                  new THREE.Vector3(-3, 0, -1),
                  new THREE.Vector3(3, 0, 1),
                  new THREE.Vector3(-3, 0, 1),
                  new THREE.Vector3(3, 0, -1),
                ]),
                new THREE.LineBasicMaterial({
                  color: new THREE.Color(0x273340),
                  transparent: true,
                  opacity: 0.35 * opacity,
                })
              )
            }
          />
        </group>
      )}

      {/* 5. Minimal 3D HTML Metadata Badge & Leader Line */}
      {showLabels && (
        <Html
          position={[EVIDENCE_PLATE_WIDTH / 2 + 0.6, 0, 0]}
          center
          distanceFactor={28}
          zIndexRange={[100, 0]}
          style={{
            pointerEvents: 'auto',
            userSelect: 'none',
            opacity: Math.max(0, opacity),
            transition: 'opacity 0.2s ease',
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation()
              onClick?.()
            }}
            className={`cursor-pointer group flex flex-col gap-0.5 p-1.5 px-2 rounded border bg-[#070b10]/90 backdrop-blur-sm transition-all duration-200 ${
              isFocused
                ? 'border-[#0057ff] shadow-[0_0_12px_rgba(0,87,255,0.25)]'
                : 'border-[#273340]/70 hover:border-[#727d89]'
            }`}
            style={{ width: '165px' }}
          >
            {/* Header: Number + Title */}
            <div className="flex items-center justify-between font-mono text-[9px] tracking-wider text-[#b2bbc5]">
              <span className="font-semibold text-[#f8f7f4]">{def.numberStr}</span>
              <span className="truncate max-w-[125px] font-medium text-left">{def.title}</span>
            </div>

            {/* Subtitle / Descriptor */}
            <span className="font-mono text-[8px] text-[#727d89] truncate">
              {def.descriptor}
            </span>

            {/* Provenance badge */}
            <div className="mt-0.5 flex items-center justify-between">
              <span className={`inline-block font-mono text-[7px] px-1 py-0.2 rounded border uppercase tracking-wider ${toneClasses}`}>
                {status}
              </span>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
