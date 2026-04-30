import * as THREE from 'three'
import { useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { useGLTF, MeshRefractionMaterial, AccumulativeShadows, RandomizedLight, Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { RGBELoader } from 'three-stdlib'

function Ring({ map, glbUrl, ...props }: { map: THREE.Texture; glbUrl: string;[key: string]: unknown }) {
  const { scene } = useGLTF(glbUrl)

  const { diamondGeo, ringGeo, ringMat, diamondPos, diamondQuat, diamondScale, ringPos, ringQuat, ringScale, autoScale, center } = useMemo(() => {
    let diamond: THREE.Mesh | null = null
    let ring: THREE.Mesh | null = null

    scene.updateWorldMatrix(true, true)
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const n = mesh.name
      if (!diamond && (n.includes('Diamond') || n.includes('Gem'))) diamond = mesh
      if (!ring && n.includes('Metal')) ring = mesh
    })

    const decompose = (mesh: THREE.Mesh) => {
      const pos = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      const scale = new THREE.Vector3()
      mesh.matrixWorld.decompose(pos, quat, scale)
      return { pos, quat, scale }
    }

    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const autoScale = maxDim > 0 ? 2.5 / maxDim : 1

    const dt = diamond ? decompose(diamond) : null
    const rt = ring ? decompose(ring) : null

    return {
      diamondGeo: diamond?.geometry ?? null,
      ringGeo: ring?.geometry ?? null,
      ringMat: ring ? (ring.material as THREE.Material) : null,
      diamondPos: dt?.pos, diamondQuat: dt?.quat, diamondScale: dt?.scale,
      ringPos: rt?.pos, ringQuat: rt?.quat, ringScale: rt?.scale,
      autoScale,
      center: box.getCenter(new THREE.Vector3())
    }
  }, [scene])

  return (
    <group {...props} dispose={null}>
      <group scale={autoScale}>
        <group position={[-center.x, -center.y, -center.z]}>
          {diamondGeo && diamondPos && (
            <mesh geometry={diamondGeo} position={diamondPos} quaternion={diamondQuat} scale={diamondScale}>
              <MeshRefractionMaterial envMap={map as THREE.CubeTexture} aberrationStrength={0.02} toneMapped={false} />
            </mesh>
          )}
          {ringGeo && ringPos && (
            <mesh
              castShadow receiveShadow
              geometry={ringGeo} material={ringMat!}
              position={ringPos} quaternion={ringQuat} scale={ringScale}
              material-envMapIntensity={4}
            />
          )}
        </group>
      </group>
    </group>
  )
}

export default function App() {
  const texture = useLoader(RGBELoader, 'ring.hdr')
  texture.mapping = THREE.EquirectangularReflectionMapping

  return (
    <Canvas shadows camera={{ position: [5, 5, 5], fov: 35, near: 0.001, far: 100 }}>
      <color attach="background" args={['#f0f0f0']} />
      <ambientLight intensity={0.5} />
      <Environment map={texture} />
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI} />
      <group position={[0, -1, 0]}>
        <Ring map={texture} glbUrl="/ring.glb" rotation={[0, Math.PI / 2, Math.PI / 2]} />
        <AccumulativeShadows temporal frames={100} alphaTest={0.95} opacity={1} scale={20}>
          <RandomizedLight amount={8} radius={10} ambient={0.5} position={[0, 10, -2.5]} bias={0.001} size={3} />
        </AccumulativeShadows>
      </group>
      <EffectComposer>
        <Bloom luminanceThreshold={1} intensity={0.85} levels={9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
