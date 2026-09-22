import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ReconstructionGraphicsProps {
  opacity?: number
  reducedMotion?: boolean
}

export const ReconstructionGraphics: React.FC<ReconstructionGraphicsProps> = ({
  opacity = 0,
  reducedMotion = false,
}) => {
  const sweepRef = useRef<THREE.Group>(null)
  const pulseRef = useRef<THREE.Mesh>(null)

  // Origin point coordinates in world space
  const originPos = useMemo(() => new THREE.Vector3(-6, 0.15, -14), [])

  // Backtracking trajectory curve (from slick centroid to origin)
  const trajectoryPoints = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.2, 0.15, -6),
      new THREE.Vector3(-4.0, 0.15, -10),
      originPos
    )
    return curve.getPoints(36)
  }, [originPos])

  const trajectoryGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(trajectoryPoints)
  }, [trajectoryPoints])

  // AIS vessel transit track (historical line)
  const vesselTrackPoints = useMemo(() => {
    return [
      new THREE.Vector3(12, 0.15, 20),
      new THREE.Vector3(6, 0.15, 10),
      new THREE.Vector3(0, 0.15, 0),
      new THREE.Vector3(-6, 0.15, -10),
      new THREE.Vector3(-12, 0.15, -20),
      new THREE.Vector3(-18, 0.15, -30),
    ]
  }, [])

  const vesselTrackGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(vesselTrackPoints)
  }, [vesselTrackPoints])

  // Correlation vector line between past vessel track and origin
  const correlationGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-6, 0.15, -10),
      originPos,
    ])
  }, [originPos])

  // Coordinate graticule grid lines
  const gridGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    const size = 30
    const step = 6
    for (let x = -size; x <= size; x += step) {
      points.push(new THREE.Vector3(x, 0.05, -size))
      points.push(new THREE.Vector3(x, 0.05, size))
    }
    for (let z = -size; z <= size; z += step) {
      points.push(new THREE.Vector3(-size, 0.05, z))
      points.push(new THREE.Vector3(size, 0.05, z))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])

  // Wind drift vector line
  const driftGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(2.5, 0, -1.8),
    ])
  }, [])

  // Materials with controlled opacity and maritime colors
  const materials = useMemo(() => {
    return {
      trajectory: new THREE.LineBasicMaterial({
        color: 0x0057ff, // Signal Blue
        transparent: true,
        opacity: opacity * 0.9,
      }),
      vesselTrack: new THREE.LineDashedMaterial({
        color: 0xb2bbc5, // Mist
        transparent: true,
        opacity: opacity * 0.75,
        dashSize: 1.2,
        gapSize: 0.6,
      }),
      correlation: new THREE.LineDashedMaterial({
        color: 0xffb020, // Warn highlight
        transparent: true,
        opacity: opacity * 0.85,
        dashSize: 0.8,
        gapSize: 0.4,
      }),
      graticule: new THREE.LineBasicMaterial({
        color: 0x273340, // Chartline
        transparent: true,
        opacity: opacity * 0.35,
      }),
      originRing: new THREE.MeshBasicMaterial({
        color: 0x0057ff,
        transparent: true,
        opacity: opacity * 0.85,
        side: THREE.DoubleSide,
      }),
      originInnerRing: new THREE.MeshBasicMaterial({
        color: 0x00d98b, // OK green
        transparent: true,
        opacity: opacity * 0.65,
        side: THREE.DoubleSide,
      }),
      radarSweep: new THREE.MeshBasicMaterial({
        color: 0x0057ff,
        transparent: true,
        opacity: opacity * 0.4,
        side: THREE.DoubleSide,
      }),
      waypoint: new THREE.MeshBasicMaterial({
        color: 0xf8f7f4,
        transparent: true,
        opacity: opacity * 0.9,
      }),
    }
  }, [opacity])

  // Three.js Line primitives
  const trajectoryLine = useMemo(
    () => new THREE.Line(trajectoryGeometry, materials.trajectory),
    [trajectoryGeometry, materials.trajectory]
  )

  const vesselTrackLine = useMemo(() => {
    const l = new THREE.Line(vesselTrackGeometry, materials.vesselTrack)
    l.computeLineDistances()
    return l
  }, [vesselTrackGeometry, materials.vesselTrack])

  const correlationLine = useMemo(() => {
    const l = new THREE.Line(correlationGeometry, materials.correlation)
    l.computeLineDistances()
    return l
  }, [correlationGeometry, materials.correlation])

  const gridLineSegments = useMemo(
    () => new THREE.LineSegments(gridGeometry, materials.graticule),
    [gridGeometry, materials.graticule]
  )

  const driftLine = useMemo(
    () => new THREE.Line(driftGeometry, materials.trajectory),
    [driftGeometry, materials.trajectory]
  )

  useFrame(({ clock }) => {
    if (opacity <= 0.001) return

    if (!reducedMotion) {
      const t = clock.getElapsedTime()
      if (sweepRef.current) {
        sweepRef.current.rotation.y = t * 1.2
      }
      if (pulseRef.current) {
        const s = 1.0 + Math.sin(t * 2.5) * 0.12
        pulseRef.current.scale.set(s, s, s)
      }
    }
  })

  if (opacity <= 0.001) return null

  return (
    <group>
      {/* 1. Coordinate Graticule Grid */}
      <primitive object={gridLineSegments} />

      {/* 2. Reverse Drift Trajectory Vector */}
      <primitive object={trajectoryLine} />

      {/* 3. AIS Transit Track */}
      <primitive object={vesselTrackLine} />

      {/* 4. Correlation Vector */}
      <primitive object={correlationLine} />

      {/* 5. Waypoints along AIS Track */}
      {vesselTrackPoints.map((pt, i) => (
        <group key={`wp-${i}`} position={pt}>
          <mesh material={materials.waypoint}>
            <sphereGeometry args={[0.16, 8, 8]} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={materials.graticule}>
            <ringGeometry args={[0.3, 0.36, 16]} />
          </mesh>
        </group>
      ))}

      {/* 6. Release Origin Target Locus */}
      <group position={originPos}>
        {/* Outer Ring */}
        <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} material={materials.originRing}>
          <ringGeometry args={[2.2, 2.32, 48]} />
        </mesh>

        {/* Mid Ring with tick marks */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={materials.originRing}>
          <ringGeometry args={[1.4, 1.48, 36]} />
        </mesh>

        {/* Inner Origin Bullseye */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={materials.originInnerRing}>
          <ringGeometry args={[0.4, 0.48, 24]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={materials.originRing}>
          <sphereGeometry args={[0.18, 12, 12]} />
        </mesh>

        {/* Rotating Radar / Backtracking Sweep Wedge */}
        <group ref={sweepRef}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={materials.radarSweep}>
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
        <primitive object={driftLine} />
      </group>
    </group>
  )
}

export default ReconstructionGraphics
