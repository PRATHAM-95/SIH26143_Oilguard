import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface TankerModelProps {
  reducedMotion?: boolean
  opacity?: number
}

export const TankerModel: React.FC<TankerModelProps> = ({
  reducedMotion = false,
  opacity = 1.0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const radarRef = useRef<THREE.Mesh>(null)

  // Materials with dark maritime palette
  const materials = useMemo(() => {
    return {
      hullDark: new THREE.MeshStandardMaterial({
        color: 0x111923, // Deck dark neutral
        roughness: 0.82,
        metalness: 0.25,
        transparent: opacity < 1.0,
        opacity,
      }),
      waterlineBoot: new THREE.MeshStandardMaterial({
        color: 0x241517, // Subdued deep oxide/anti-fouling band
        roughness: 0.88,
        metalness: 0.1,
        transparent: opacity < 1.0,
        opacity,
      }),
      deckPlate: new THREE.MeshStandardMaterial({
        color: 0x16202c, // Deck surface
        roughness: 0.75,
        metalness: 0.3,
        transparent: opacity < 1.0,
        opacity,
      }),
      superstructure: new THREE.MeshStandardMaterial({
        color: 0x273340, // Chartline slate tone
        roughness: 0.65,
        metalness: 0.35,
        transparent: opacity < 1.0,
        opacity,
      }),
      bridgeGlass: new THREE.MeshStandardMaterial({
        color: 0x050c14,
        roughness: 0.2,
        metalness: 0.85,
        transparent: opacity < 1.0,
        opacity,
      }),
      pipes: new THREE.MeshStandardMaterial({
        color: 0x3d4b5c,
        roughness: 0.5,
        metalness: 0.6,
        transparent: opacity < 1.0,
        opacity,
      }),
      funnel: new THREE.MeshStandardMaterial({
        color: 0x0e151e,
        roughness: 0.7,
        metalness: 0.4,
        transparent: opacity < 1.0,
        opacity,
      }),
      accentRed: new THREE.MeshBasicMaterial({
        color: 0xff4d5a,
        transparent: opacity < 1.0,
        opacity,
      }),
      accentGreen: new THREE.MeshBasicMaterial({
        color: 0x00d98b,
        transparent: opacity < 1.0,
        opacity,
      }),
      mastWhite: new THREE.MeshBasicMaterial({
        color: 0xf8f7f4,
        transparent: opacity < 1.0,
        opacity,
      }),
    }
  }, [opacity])

  // Custom tapered bow geometry using buffer vertices
  const bowGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    // Vertices for a tapered commercial tanker bow
    // From midship width (4.8, y=-0.6 to 1.8, z=7) to bow stem (z=14)
    const vertices = new Float32Array([
      // Starboard bow flank
      2.4, -0.6, 7.0,   0.0, -0.4, 14.0,   2.4, 1.8, 7.0,
      2.4, 1.8, 7.0,    0.0, -0.4, 14.0,   0.0, 2.0, 14.0,
      // Port bow flank
      -2.4, 1.8, 7.0,   0.0, -0.4, 14.0,  -2.4, -0.6, 7.0,
      0.0, 2.0, 14.0,   0.0, -0.4, 14.0,  -2.4, 1.8, 7.0,
      // Bow deck
      -2.4, 1.8, 7.0,   2.4, 1.8, 7.0,     0.0, 2.0, 14.0,
      // Bow bottom / keel
      -2.4, -0.6, 7.0,  0.0, -0.4, 14.0,   2.4, -0.6, 7.0,
    ])
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geom.computeVertexNormals()
    return geom
  }, [])

  // Stately tanker bobbing (pitch, roll, heave)
  useFrame(({ clock }) => {
    if (radarRef.current && !reducedMotion) {
      radarRef.current.rotation.y += 0.04
    }

    if (!groupRef.current) return

    if (!reducedMotion) {
      const t = clock.getElapsedTime() * 0.7
      // Subtle pitch (fore/aft rocking)
      groupRef.current.rotation.x = Math.sin(t * 0.8) * 0.018
      // Subtle roll (port/starboard list)
      groupRef.current.rotation.z = Math.cos(t * 0.5) * 0.014
      // Subtle heave (vertical rise and fall)
      groupRef.current.position.y = Math.sin(t * 0.75) * 0.12
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* --- MAIN HULL MIDSECTION --- */}
      {/* Main hull body */}
      <mesh
        position={[0, 0.6, -1.0]}
        material={materials.hullDark}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[4.8, 2.4, 16.0]} />
      </mesh>

      {/* Waterline boot-topping band (anti-fouling bottom) */}
      <mesh position={[0, -0.4, -1.0]} material={materials.waterlineBoot}>
        <boxGeometry args={[4.84, 0.45, 16.04]} />
      </mesh>

      {/* Tapered Bow Section */}
      <mesh geometry={bowGeometry} material={materials.hullDark} castShadow />

      {/* Transom Stern Taper */}
      <mesh position={[0, 0.6, -10.5]} material={materials.hullDark} castShadow>
        <boxGeometry args={[4.4, 2.4, 3.2]} />
      </mesh>

      {/* --- MAIN DECK & CARGO AREA --- */}
      {/* Deck plating overlay */}
      <mesh position={[0, 1.82, 0.0]} material={materials.deckPlate}>
        <boxGeometry args={[4.7, 0.06, 17.5]} />
      </mesh>

      {/* Cargo Tank Hatch Coamings (6 tanks) */}
      {[-5.0, -3.0, -1.0, 1.0, 3.0, 5.0].map((z, idx) => (
        <group key={`tank-${idx}`} position={[0, 1.9, z]}>
          <mesh material={materials.hullDark} position={[0, 0, 0]}>
            <boxGeometry args={[3.6, 0.16, 1.4]} />
          </mesh>
          {/* Tank dome */}
          <mesh material={materials.pipes} position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.15, 12]} />
          </mesh>
        </group>
      ))}

      {/* Longitudinal Cargo Pipeline Rack */}
      <mesh position={[0.7, 2.05, 0.0]} rotation={[Math.PI / 2, 0, 0]} material={materials.pipes}>
        <cylinderGeometry args={[0.07, 0.07, 14.0, 8]} />
      </mesh>
      <mesh position={[0.9, 2.05, 0.0]} rotation={[Math.PI / 2, 0, 0]} material={materials.pipes}>
        <cylinderGeometry args={[0.07, 0.07, 14.0, 8]} />
      </mesh>
      <mesh position={[-0.7, 2.05, 0.0]} rotation={[Math.PI / 2, 0, 0]} material={materials.pipes}>
        <cylinderGeometry args={[0.07, 0.07, 14.0, 8]} />
      </mesh>

      {/* Midship Manifold (Cargo loading/discharge manifold) */}
      <group position={[0, 2.1, 0.0]}>
        <mesh material={materials.superstructure}>
          <boxGeometry args={[4.2, 0.35, 0.8]} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.25, 0]} material={materials.pipes}>
          <cylinderGeometry args={[0.16, 0.16, 4.4, 12]} />
        </mesh>
        {/* Hose handling derrick crane */}
        <mesh position={[0, 1.1, 0]} material={materials.superstructure}>
          <cylinderGeometry args={[0.06, 0.08, 1.8, 8]} />
        </mesh>
        <mesh position={[0.6, 1.8, 0]} rotation={[0, 0, -Math.PI / 4]} material={materials.pipes}>
          <cylinderGeometry args={[0.04, 0.04, 1.5, 6]} />
        </mesh>
      </group>

      {/* Forecastle Head (Bow structure) */}
      <group position={[0, 2.0, 11.5]}>
        <mesh material={materials.superstructure}>
          <boxGeometry args={[3.2, 0.35, 3.5]} />
        </mesh>
        {/* Anchor windlasses */}
        <mesh position={[-0.8, 0.3, 0.4]} material={materials.pipes}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 10]} />
        </mesh>
        <mesh position={[0.8, 0.3, 0.4]} material={materials.pipes}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 10]} />
        </mesh>
        {/* Fore mast with white head light */}
        <mesh position={[0, 1.4, 0.8]} material={materials.superstructure}>
          <cylinderGeometry args={[0.04, 0.06, 2.2, 8]} />
        </mesh>
        <mesh position={[0, 2.5, 0.8]} material={materials.mastWhite}>
          <sphereGeometry args={[0.08, 8, 8]} />
        </mesh>
      </group>

      {/* --- STERN SUPERSTRUCTURE & NAVIGATION BRIDGE --- */}
      <group position={[0, 1.8, -8.0]}>
        {/* Tier 1 Accommodation block */}
        <mesh position={[0, 0.6, 0]} material={materials.superstructure} castShadow>
          <boxGeometry args={[4.2, 1.2, 3.8]} />
        </mesh>

        {/* Tier 2 Officers deck */}
        <mesh position={[0, 1.6, 0]} material={materials.superstructure} castShadow>
          <boxGeometry args={[3.8, 0.8, 3.4]} />
        </mesh>

        {/* Tier 3 Navigation Bridge */}
        <mesh position={[0, 2.4, 0.2]} material={materials.superstructure} castShadow>
          <boxGeometry args={[3.4, 0.8, 2.6]} />
        </mesh>

        {/* Extended Bridge Wings (port & starboard viewing catwalks) */}
        <mesh position={[0, 2.5, 0.4]} material={materials.superstructure}>
          <boxGeometry args={[5.4, 0.2, 0.8]} />
        </mesh>

        {/* Continuous Glazed Bridge Window Band */}
        <mesh position={[0, 2.55, 1.52]} material={materials.bridgeGlass}>
          <boxGeometry args={[3.2, 0.28, 0.05]} />
        </mesh>
        <mesh position={[-2.65, 2.55, 0.4]} rotation={[0, Math.PI / 2, 0]} material={materials.bridgeGlass}>
          <boxGeometry args={[0.7, 0.28, 0.05]} />
        </mesh>
        <mesh position={[2.65, 2.55, 0.4]} rotation={[0, Math.PI / 2, 0]} material={materials.bridgeGlass}>
          <boxGeometry args={[0.7, 0.28, 0.05]} />
        </mesh>

        {/* Navigational Sidelights */}
        {/* Port side (Red) */}
        <mesh position={[-2.72, 2.65, 0.4]} material={materials.accentRed}>
          <sphereGeometry args={[0.07, 8, 8]} />
        </mesh>
        {/* Starboard side (Green) */}
        <mesh position={[2.72, 2.65, 0.4]} material={materials.accentGreen}>
          <sphereGeometry args={[0.07, 8, 8]} />
        </mesh>

        {/* Funnel / Exhaust Stack */}
        <group position={[0, 3.2, -1.0]}>
          <mesh rotation={[-0.1, 0, 0]} material={materials.funnel} castShadow>
            <cylinderGeometry args={[0.45, 0.55, 1.8, 16]} />
          </mesh>
          {/* Funnel top cowl */}
          <mesh position={[0, 0.95, -0.1]} material={materials.hullDark}>
            <cylinderGeometry args={[0.48, 0.48, 0.12, 16]} />
          </mesh>
        </group>

        {/* Main Radar Mast atop Bridge */}
        <group position={[0, 2.8, 0.2]}>
          {/* Main vertical mast spar */}
          <mesh position={[0, 1.0, 0]} material={materials.superstructure}>
            <cylinderGeometry args={[0.05, 0.08, 2.0, 8]} />
          </mesh>
          {/* Cross-tree yards */}
          <mesh position={[0, 1.4, 0]} material={materials.superstructure}>
            <boxGeometry args={[1.6, 0.04, 0.04]} />
          </mesh>
          {/* Rotating Radar Scanner */}
          <mesh ref={radarRef} position={[0, 2.05, 0]} material={materials.mastWhite}>
            <boxGeometry args={[0.9, 0.06, 0.12]} />
          </mesh>
          {/* Masthead white light */}
          <mesh position={[0, 2.15, 0]} material={materials.mastWhite}>
            <sphereGeometry args={[0.06, 6, 6]} />
          </mesh>
        </group>
      </group>

      {/* Freefall Lifeboat Capsule at Transom Stern */}
      <mesh position={[0, 2.2, -11.6]} rotation={[-0.4, 0, 0]} material={materials.accentRed}>
        <boxGeometry args={[0.6, 0.45, 1.2]} />
      </mesh>
    </group>
  )
}

export default TankerModel
