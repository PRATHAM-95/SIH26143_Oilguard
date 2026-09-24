import React, { useRef, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { EvidenceLayerState } from '@/ui/hooks/useEvidenceStackData'
import { EVIDENCE_PLATE_WIDTH, EVIDENCE_PLATE_DEPTH } from './project'
import {
  type EvidencePhase,
  calculateLayerY,
  calculateLayerOpacity,
} from './phases'

/**
 * Imperative drive values for the Welcome scroll-driven evidence stack.
 * When a component is in "driven" mode it reads these values per frame and
 * mutates only opacity/position — no per-scroll React rendering or object churn.
 */
export interface EvidenceStackDrive {
  separation: number // 0..1
  phase: EvidencePhase
  opacity: number // 0..1 base
  driftX: number // world-space x drift for restrained parallax
}

interface EvidenceStackLayerProps {
  layer: EvidenceLayerState
  targetY: number
  opacity: number
  isFocused: boolean
  showLabels?: boolean
  reducedMotion?: boolean
  onClick?: () => void
  /** Present => imperative scroll-driven mode (Welcome). */
  layerIndex?: number
  driveRef?: MutableRefObject<EvidenceStackDrive>
}

/** Per-layer multiplicative opacity factors (keep in sync with prop-driven path). */
const OPACITY_FACTORS = {
  plate: 0.55,
  border: 0.45,
  corner: 0.65,
  dataLines: 0.85,
  slick: 0.8,
  points: 0.85,
  reticleRing: 0.9,
  reticleCircle: 0.95,
  unavailable: 0.35,
} as const

interface LayerAssets {
  plateMaterial: THREE.MeshBasicMaterial
  borderLine: THREE.Line
  borderMaterial: THREE.LineBasicMaterial
  cornerTicks: THREE.LineSegments
  cornerMaterial: THREE.LineBasicMaterial
  dataLines: THREE.LineSegments | null
  dataLinesMaterial: THREE.LineBasicMaterial | null
  slickMaterial: THREE.MeshBasicMaterial | null
  slickGeometry: THREE.ShapeGeometry | null
  points: THREE.Points | null
  pointsMaterial: THREE.PointsMaterial | null
  reticleRingMaterial: THREE.MeshBasicMaterial | null
  reticleCircleMaterial: THREE.MeshBasicMaterial | null
  unavailable: THREE.LineSegments | null
  unavailableMaterial: THREE.LineBasicMaterial | null
}

function buildLayerAssets(layer: EvidenceLayerState): LayerAssets {
  const accentColor = new THREE.Color(layer.def.accentColor)
  const hw = EVIDENCE_PLATE_WIDTH / 2
  const hd = EVIDENCE_PLATE_DEPTH / 2

  const plateMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x0b1118),
    transparent: true,
    opacity: OPACITY_FACTORS.plate,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  // Outer border lines
  const borderPts = [
    new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(-hw, 0, hd),
    new THREE.Vector3(-hw, 0, -hd),
  ]
  const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPts)
  const borderMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x273340),
    transparent: true,
    opacity: OPACITY_FACTORS.border,
  })
  const borderLine = new THREE.Line(borderGeometry, borderMaterial)

  // Corner registration tick marks (tactical blueprint marks)
  const tickLen = 0.6
  const tickPts: THREE.Vector3[] = [
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
  const cornerTicksGeometry = new THREE.BufferGeometry().setFromPoints(tickPts)
  const cornerMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x727d89),
    transparent: true,
    opacity: OPACITY_FACTORS.corner,
  })
  const cornerTicks = new THREE.LineSegments(cornerTicksGeometry, cornerMaterial)

  // Line segments for layer data (footprints, trajectories, contour rings)
  let dataLines: THREE.LineSegments | null = null
  let dataLinesMaterial: THREE.LineBasicMaterial | null = null
  if (layer.lines && layer.lines.length > 0) {
    const pts: THREE.Vector3[] = []
    layer.lines.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        pts.push(new THREE.Vector3(line[i][0], 0.02, line[i][1]))
        pts.push(new THREE.Vector3(line[i + 1][0], 0.02, line[i + 1][1]))
      }
    })
    if (pts.length > 0) {
      const geometry = new THREE.BufferGeometry().setFromPoints(pts)
      dataLinesMaterial = new THREE.LineBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: OPACITY_FACTORS.dataLines,
      })
      dataLines = new THREE.LineSegments(geometry, dataLinesMaterial)
    }
  }

  // Points geometry (forward drift particles)
  let points: THREE.Points | null = null
  let pointsMaterial: THREE.PointsMaterial | null = null
  if (layer.points && layer.points.length > 0) {
    const pts = layer.points.map(([x, z]) => new THREE.Vector3(x, 0.03, z))
    const geometry = new THREE.BufferGeometry().setFromPoints(pts)
    pointsMaterial = new THREE.PointsMaterial({
      color: accentColor,
      size: 0.15,
      transparent: true,
      opacity: OPACITY_FACTORS.points,
    })
    points = new THREE.Points(geometry, pointsMaterial)
  }

  // Slick polygon shape geometry
  let slickGeometry: THREE.ShapeGeometry | null = null
  if (layer.polygons && layer.polygons.length > 0) {
    const poly = layer.polygons[0]
    if (poly.length >= 3) {
      const shape = new THREE.Shape()
      shape.moveTo(poly[0][0], poly[0][1])
      for (let i = 1; i < poly.length; i++) {
        shape.lineTo(poly[i][0], poly[i][1])
      }
      shape.closePath()
      slickGeometry = new THREE.ShapeGeometry(shape)
    }
  }
  const slickMaterial = slickGeometry
    ? new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x182432),
        transparent: true,
        opacity: OPACITY_FACTORS.slick,
        side: THREE.DoubleSide,
      })
    : null

  // Center target reticle (Attribution / Origin layers)
  let reticleRingMaterial: THREE.MeshBasicMaterial | null = null
  let reticleCircleMaterial: THREE.MeshBasicMaterial | null = null
  if (layer.centerPoint) {
    reticleRingMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: OPACITY_FACTORS.reticleRing,
    })
    reticleCircleMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: OPACITY_FACTORS.reticleCircle,
    })
  }

  // Unavailable honest-grid placeholder watermark
  let unavailable: THREE.LineSegments | null = null
  let unavailableMaterial: THREE.LineBasicMaterial | null = null
  if (layer.isUnavailable) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3, 0, -1),
      new THREE.Vector3(3, 0, 1),
      new THREE.Vector3(-3, 0, 1),
      new THREE.Vector3(3, 0, -1),
    ])
    unavailableMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(0x273340),
      transparent: true,
      opacity: OPACITY_FACTORS.unavailable,
    })
    unavailable = new THREE.LineSegments(geometry, unavailableMaterial)
  }

  return {
    plateMaterial,
    borderLine,
    borderMaterial,
    cornerTicks,
    cornerMaterial,
    dataLines,
    dataLinesMaterial,
    slickMaterial,
    slickGeometry,
    points,
    pointsMaterial,
    reticleRingMaterial,
    reticleCircleMaterial,
    unavailable,
    unavailableMaterial,
  }
}

export const EvidenceStackLayer: React.FC<EvidenceStackLayerProps> = ({
  layer,
  targetY,
  opacity,
  isFocused,
  showLabels = true,
  reducedMotion = false,
  onClick,
  layerIndex,
  driveRef,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const labelRef = useRef<HTMLDivElement | null>(null)

  const driven = driveRef !== undefined && driveRef !== null && layerIndex !== undefined

  // Once-built assets for the imperative driven mode (Welcome).
  const assets = useMemo<LayerAssets | null>(
    () => (driven ? buildLayerAssets(layer) : null),
    // Assets are immutable once built; the frame loop mutates only opacity/position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [driven]
  )

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (driven && assets) {
      const drive = driveRef!.current
      const sep = Math.max(0, Math.min(1, drive.separation))
      const target = calculateLayerY(layerIndex!, sep, drive.phase)
      const baseOpacity = Math.max(0, Math.min(1, drive.opacity))
      const op = calculateLayerOpacity(layerIndex!, null, baseOpacity)

      assets.plateMaterial.opacity = OPACITY_FACTORS.plate * op
      assets.borderMaterial.opacity = OPACITY_FACTORS.border * op
      assets.cornerMaterial.opacity = OPACITY_FACTORS.corner * op
      if (assets.dataLinesMaterial) assets.dataLinesMaterial.opacity = OPACITY_FACTORS.dataLines * op
      if (assets.slickMaterial) assets.slickMaterial.opacity = OPACITY_FACTORS.slick * op
      if (assets.pointsMaterial) assets.pointsMaterial.opacity = OPACITY_FACTORS.points * op
      if (assets.reticleRingMaterial) assets.reticleRingMaterial.opacity = OPACITY_FACTORS.reticleRing * op
      if (assets.reticleCircleMaterial) assets.reticleCircleMaterial.opacity = OPACITY_FACTORS.reticleCircle * op
      if (assets.unavailableMaterial) assets.unavailableMaterial.opacity = OPACITY_FACTORS.unavailable * op

      if (labelRef.current) {
        labelRef.current.style.opacity = String(Math.max(0, baseOpacity))
      }

      if (reducedMotion) {
        groupRef.current.position.y = target
        return
      }
      const factor = Math.min(1, delta * 6.0)
      groupRef.current.position.y += (target - groupRef.current.position.y) * factor
      return
    }

    // Prop-driven mode (Investigation evidence view)
    if (reducedMotion) {
      groupRef.current.position.y = targetY
      return
    }
    const factor = Math.min(1, delta * 6.0)
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * factor
  })

  const { def, status, tone, centerPoint } = layer

  // Tone styling for badge
  const toneClasses = {
    ok: 'text-[#00d98b] border-[#00d98b]/40 bg-[#00d98b]/10',
    warn: 'text-[#ffb020] border-[#ffb020]/40 bg-[#ffb020]/10',
    sonar: 'text-[#0057ff] border-[#0057ff]/40 bg-[#0057ff]/10',
    dim: 'text-[#727d89] border-[#727d89]/30 bg-[#111923]/80',
    danger: 'text-[#ff4d5a] border-[#ff4d5a]/40 bg-[#ff4d5a]/10',
  }[tone]

  // Prop-driven plate material (Investigation path, unchanged)
  const plateMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(isFocused ? 0x111923 : 0x0b1118),
      transparent: true,
      opacity: 0.55 * opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [opacity, isFocused])

  // Prop-driven border/corner/data geometries (Investigation path, unchanged)
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

  const dataLinesGeometry = useMemo(() => {
    if (!layer.lines || layer.lines.length === 0) return null
    const pts: THREE.Vector3[] = []
    layer.lines.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        pts.push(new THREE.Vector3(line[i][0], 0.02, line[i][1]))
        pts.push(new THREE.Vector3(line[i + 1][0], 0.02, line[i + 1][1]))
      }
    })
    if (pts.length === 0) return null
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [layer.lines])

  const dataPointsGeometry = useMemo(() => {
    if (!layer.points || layer.points.length === 0) return null
    const pts = layer.points.map(([x, z]) => new THREE.Vector3(x, 0.03, z))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [layer.points])

  const slickShapeGeometry = useMemo(() => {
    if (!layer.polygons || layer.polygons.length === 0) return null
    const poly = layer.polygons[0]
    if (poly.length < 3) return null
    const shape = new THREE.Shape()
    shape.moveTo(poly[0][0], poly[0][1])
    for (let i = 1; i < poly.length; i++) {
      shape.lineTo(poly[i][0], poly[i][1])
    }
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [layer.polygons])

  const labelNode = showLabels ? (
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
        ref={labelRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        className={`cursor-pointer group flex flex-col gap-0.5 p-1.5 px-2 rounded border bg-[#070b10]/90 backdrop-blur-sm transition-all duration-200 ${
          isFocused
            ? 'border-[#0057ff] shadow-[0_0_12px_rgba(0,87,255,0.25)]'
            : 'border-[#273340]/70 hover:border-[#727d89]'
        }`}
        style={{ width: '165px', opacity: driven ? 0 : undefined }}
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
  ) : null

  // --- Imperative driven mode (Welcome) ---
  if (driven && assets) {
    return (
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* 1. Base semi-transparent plate */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          material={assets.plateMaterial}
          onClick={(e) => {
            e.stopPropagation()
            onClick?.()
          }}
        >
          <planeGeometry args={[EVIDENCE_PLATE_WIDTH, EVIDENCE_PLATE_DEPTH]} />
        </mesh>

        {/* 2. Plate edge border */}
        <primitive object={assets.borderLine} />

        {/* 3. Corner tick marks */}
        <primitive object={assets.cornerTicks} />

        {/* 4. Layer specific graphics */}
        {assets.dataLines && <primitive object={assets.dataLines} />}

        {assets.slickGeometry && assets.slickMaterial && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <primitive object={assets.slickGeometry} attach="geometry" />
            <primitive object={assets.slickMaterial} attach="material" />
          </mesh>
        )}

        {/* 4c. Particle cloud (drift) */}
        {assets.points && <primitive object={assets.points} />}

        {/* 4d. Center target / reticle for Attribution (Layer 9) or Origin (Layer 6/8) */}
        {centerPoint && assets.reticleRingMaterial && assets.reticleCircleMaterial && (
          <group position={[centerPoint[0], 0.03, centerPoint[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.42, 24]} />
              <primitive object={assets.reticleRingMaterial} attach="material" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 16]} />
              <primitive object={assets.reticleCircleMaterial} attach="material" />
            </mesh>
          </group>
        )}

        {/* 4e. Unavailable / honest grid placeholder watermark */}
        {assets.unavailable && <primitive object={assets.unavailable} />}

        {/* 5. Minimal 3D HTML Metadata Badge & Leader Line */}
        {labelNode}
      </group>
    )
  }

  // --- Prop-driven mode (Investigation evidence view, unchanged) ---
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
      {layer.isUnavailable && (
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
      {labelNode}
    </group>
  )
}

export default EvidenceStackLayer