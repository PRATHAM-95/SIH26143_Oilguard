import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { WelcomeScrollRef } from './useWelcomeScroll'

interface ReconstructionGraphicsProps {
  scrollRef: WelcomeScrollRef
  reducedMotion?: boolean
}

interface ReconAssets {
  originPos: THREE.Vector3
  materials: {
    trajectory: THREE.LineBasicMaterial
    vesselTrack: THREE.LineDashedMaterial
    correlation: THREE.LineDashedMaterial
    graticule: THREE.LineBasicMaterial
    originRing: THREE.MeshBasicMaterial
    originInnerRing: THREE.MeshBasicMaterial
    radarSweep: THREE.MeshBasicMaterial
    waypoint: THREE.MeshBasicMaterial
  }
  trajectoryLine: THREE.Line
  vesselTrackLine: THREE.Line
  correlationLine: THREE.Line
  gridLineSegments: THREE.LineSegments
  driftLine: THREE.Line
  vesselTrackPoints: THREE.Vector3[]
}

// Build all three.js objects ONCE; opacity/position are mutated per frame.
function buildReconAssets(): ReconAssets {
  const originPos = new THREE.Vector3(-6, 0.15, -14)

  // Backtracking trajectory curve (from slick centroid to origin)
  const trajectoryPoints = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-1.2, 0.15, -6),
    new THREE.Vector3(-4.0, 0.15, -10),
    originPos
  ).getPoints(36)
  const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(trajectoryPoints)

  // AIS vessel transit track (historical line)
  const vesselTrackPoints = [
    new THREE.Vector3(12, 0.15, 20),
    new THREE.Vector3(6, 0.15, 10),
    new THREE.Vector3(0, 0.15, 0),
    new THREE.Vector3(-6, 0.15, -10),
    new THREE.Vector3(-12, 0.15, -20),
    new THREE.Vector3(-18, 0.15, -30),
  ]
  const vesselTrackGeometry = new THREE.BufferGeometry().setFromPoints(vesselTrackPoints)

  // Correlation vector line between past vessel track and origin
  const correlationGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-6, 0.15, -10),
    originPos,
  ])

  // Coordinate graticule grid lines
  const gridPoints: THREE.Vector3[] = []
  const size = 30
  const step = 6
  for (let x = -size; x <= size; x += step) {
    gridPoints.push(new THREE.Vector3(x, 0.05, -size))
    gridPoints.push(new THREE.Vector3(x, 0.05, size))
  }
  for (let z = -size; z <= size; z += step) {
    gridPoints.push(new THREE.Vector3(-size, 0.05, z))
    gridPoints.push(new THREE.Vector3(size, 0.05, z))
  }
  const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints)

  // Wind drift vector line
  const driftGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(2.5, 0, -1.8),
  ])

  // Materials with controlled opacity and maritime colors (opacity driven per frame)
  const materials = {
    trajectory: new THREE.LineBasicMaterial({
      color: 0x0057ff, // Signal Blue
      transparent: true,
      opacity: 0,
    }),
    vesselTrack: new THREE.LineDashedMaterial({
      color: 0xb2bbc5, // Mist
      transparent: true,
      opacity: 0,
      dashSize: 1.2,
      gapSize: 0.6,
    }),
    correlation: new THREE.LineDashedMaterial({
      color: 0xffb020, // Warn highlight
      transparent: true,
      opacity: 0,
      dashSize: 0.8,
      gapSize: 0.4,
    }),
    graticule: new THREE.LineBasicMaterial({
      color: 0x273340, // Chartline
      transparent: true,
      opacity: 0,
    }),
    originRing: new THREE.MeshBasicMaterial({
      color: 0x0057ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    }),
    originInnerRing: new THREE.MeshBasicMaterial({
      color: 0x00d98b, // OK green
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    }),
    radarSweep: new THREE.MeshBasicMaterial({
      color: 0x0057ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    }),
    waypoint: new THREE.MeshBasicMaterial({
      color: 0xf8f7f4,
      transparent: true,
      opacity: 0,
    }),
  }

  const trajectoryLine = new THREE.Line(trajectoryGeometry, materials.trajectory)
  const vesselTrackLine = new THREE.Line(vesselTrackGeometry, materials.vesselTrack)
  vesselTrackLine.computeLineDistances()
  const correlationLine = new THREE.Line(correlationGeometry, materials.correlation)
  correlationLine.computeLineDistances()
  const gridLineSegments = new THREE.LineSegments(gridGeometry, materials.graticule)
  const driftLine = new THREE.Line(driftGeometry, materials.trajectory)

  return {
    originPos,
    materials,
    trajectoryLine,
    vesselTrackLine,
    correlationLine,
    gridLineSegments,
    driftLine,
    vesselTrackPoints,
  }
}

export const ReconstructionGraphics: React.FC<ReconstructionGraphicsProps> = ({
  scrollRef,
  reducedMotion = false,
}) => {
  const assets = useMemo(() => buildReconAssets(), [])

  const groupRef = useRef<THREE.Group>(null)
  const sweepRef = useRef<THREE.Group>(null)
  const pulseRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const opacity = scrollRef.current.reconstructionOpacity
    // Opacity-threshold early return: skip all work while the layer is hidden
    if (opacity <= 0.001) return

    const m = assets.materials
    m.trajectory.opacity = opacity * 0.9
    m.vesselTrack.opacity = opacity * 0.75
    m.correlation.opacity = opacity * 0.85
    m.graticule.opacity = opacity * 0.35
    m.originRing.opacity = opacity * 0.85
    m.originInnerRing.opacity = opacity * 0.65
    m.radarSweep.opacity = opacity * 0.4
    m.waypoint.opacity = opacity * 0.9

    if (reducedMotion) return

    // Restrained deterministic counter-drift parallax (skipped under reduced motion)
    if (groupRef.current) {
      const drift = (scrollRef.current.progress - 0.5) * 1.2
      groupRef.current.position.x = drift * 0.35
    }

    const t = clock.getElapsedTime()
    if (sweepRef.current) {
      sweepRef.current.rotation.y = t * 1.2
    }
    if (pulseRef.current) {
      const s = 1.0 + Math.sin(t * 2.5) * 0.12
      pulseRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group ref={groupRef}>
      {/* 1. Coordinate Graticule Grid */}
      <primitive object={assets.gridLineSegments} />

      {/* 2. Reverse Drift Trajectory Vector */}
      <primitive object={assets.trajectoryLine} />

      {/* 3. AIS Transit Track */}
      <primitive object={assets.vesselTrackLine} />

      {/* 4. Correlation Vector */}
      <primitive object={assets.correlationLine} />

      {/* 5. Waypoints along AIS Track */}
      {assets.vesselTrackPoints.map((pt, i) => (
        <group key={`wp-${i}`} position={pt}>
          <mesh material={assets.materials.waypoint}>
            <sphereGeometry args={[0.16, 8, 8]} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={assets.materials.graticule}>
            <ringGeometry args={[0.3, 0.36, 16]} />
          </mesh>
        </group>
      ))}

      {/* 6. Release Origin Target Locus */}
      <group position={assets.originPos}>
        {/* Outer Ring */}
        <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} material={assets.materials.originRing}>
          <ringGeometry args={[2.2, 2.32, 48]} />
        </mesh>

        {/* Mid Ring with tick marks */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={assets.materials.originRing}>
          <ringGeometry args={[1.4, 1.48, 36]} />
        </mesh>

        {/* Inner Origin Bullseye */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={assets.materials.originInnerRing}>
          <ringGeometry args={[0.4, 0.48, 24]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={assets.materials.originRing}>
          <sphereGeometry args={[0.18, 12, 12]} />
        </mesh>

        {/* Rotating Radar / Backtracking Sweep Wedge */}
        <group ref={sweepRef}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={assets.materials.radarSweep}>
            <ringGeometry args={[0.1, 2.2, 24, 1, 0, Math.PI / 4]} />
          </mesh>
        </group>
      </group>

      {/* 7. Current & Wind Vector Indicators */}
      <group position={[-12, 0.15, -4]}>
        {/* Wind vector */}
        <mesh rotation={[0, -Math.PI / 3, 0]}>
          <coneGeometry args={[0.25, 0.7, 8]} />
        </mesh>
        <primitive object={assets.driftLine} />
      </group>
    </group>
  )
}

export default ReconstructionGraphics