import * as THREE from 'three'
import { useMemo, Suspense } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { useGLTF, MeshRefractionMaterial, AccumulativeShadows, RandomizedLight, Environment, OrbitControls, Loader, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { RGBELoader } from 'three-stdlib'
import { useControls } from 'leva'

function Ring({ ringMap, diamondMap, glbUrl, metalColor, gemColor, aberration, ...props }: any) {
  const { scene } = useGLTF(glbUrl)

  const { diamondGeo, ringGeo, diamondPos, diamondQuat, diamondScale, ringPos, ringQuat, ringScale, autoScale, center } = useMemo(() => {
    let diamond: THREE.Mesh | null = null
    let ring: THREE.Mesh | null = null

    scene.updateWorldMatrix(true, true)
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const n = mesh.name
      if (!diamond && (n.includes('Diamond') || n.includes('Gem'))) diamond = mesh
      if (!ring && (n.includes('Metal') || n.includes('Ring'))) ring = mesh
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
              <MeshRefractionMaterial
                envMap={diamondMap as THREE.CubeTexture}
                aberrationStrength={aberration}
                toneMapped={true}
                color={gemColor}
                bounces={3}
                ior={2.4}
                fresnel={1}
              />
            </mesh>
          )}
          {ringGeo && ringPos && (
            <mesh
              castShadow receiveShadow
              geometry={ringGeo}
              position={ringPos} quaternion={ringQuat} scale={ringScale}
            >
              <meshPhysicalMaterial
                color={metalColor}
                roughness={0.005}
                metalness={1}
                envMapIntensity={4}
                clearcoat={1}
                clearcoatRoughness={0}
                specularIntensity={1}
                reflectivity={1}
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  )
}



function Scene() {
  const { metalColor, gemColor, aberration, model } = useControls({
    model: {
      options: {
        'Classic Solitaire': '/ring-1.glb',
        'Modern Band': '/ring.glb',
        'Transformed': '/ring-transformed.glb'
      }
    },
    metalColor: {
      value: "#D8C08C",
      label: 'Metal',
      options: {
        '14k Yellow Gold': '#D8C08C',
        'Rose Gold': '#E0B59E',
        'White Gold': '#CCCCCC',
        'Platinum': '#E8E8F2',
        'Silver': '#C8C8D0'
      }
    },
    gemColor: {
      value: '#ffffff',
      label: 'Gemstone'
    },
    aberration: {
      value: 0.01,
      min: 0,
      max: 0.1,
      step: 0.01,
      label: 'Refraction'
    }
  })

  const ringEnv = useLoader(RGBELoader, 'last.hdr')
  ringEnv.mapping = THREE.EquirectangularReflectionMapping

  const diamondEnv = useLoader(RGBELoader, 'startup.hdr')
  diamondEnv.mapping = THREE.EquirectangularReflectionMapping

  return (
    <>
      <color attach="background" args={['#fdfcf9']} />
      <ambientLight intensity={0.1} />
      <spotLight position={[5, 10, 5]} angle={0.15} penumbra={1} intensity={2} castShadow shadow-bias={-0.0001} />
      <pointLight position={[-5, 5, -5]} intensity={1} color="#ffffff" />

      <Environment map={ringEnv} background={false} blur={0} rotation={[0, Math.PI / 2, 0]} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        enablePan={false}
        minDistance={3}
        maxDistance={10}
      />

      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Ring
            ringMap={ringEnv}
            diamondMap={diamondEnv}
            glbUrl={model}
            metalColor={metalColor}
            gemColor={gemColor}
            aberration={aberration}
            rotation={[0, Math.PI / 2, Math.PI / 2]}
          />

          <ContactShadows
            resolution={1024}
            scale={10}
            blur={2}
            opacity={0.15}
            far={1}
            color="#000000"
            position={[0, -0.85, 0]}
          />

          <group position={[0, -0.85, 0]}>
            <AccumulativeShadows temporal frames={100} alphaTest={0.95} opacity={0.6} scale={20}>
              <RandomizedLight amount={8} radius={10} ambient={0.5} position={[5, 10, -2.5]} bias={0.001} size={3} />
            </AccumulativeShadows>
          </group>
        </group>
      </Suspense>

      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} intensity={0.75} levels={9} mipmapBlur />
      </EffectComposer>
    </>
  )
}

export default function App() {
  return (
    <div className="container">
      <Canvas
        shadows
        camera={{ position: [5, 3, 5], fov: 35 }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          antialias: true
        }}
      >
        <Scene />
      </Canvas>
      <Loader />
    </div>
  )
}
