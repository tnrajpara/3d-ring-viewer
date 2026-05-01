import * as THREE from 'three'
import { useMemo, Suspense } from 'react'
import { Canvas, useLoader, type ThreeElements } from '@react-three/fiber'
import { useGLTF, MeshRefractionMaterial, AccumulativeShadows, RandomizedLight, Environment, OrbitControls, Loader, ContactShadows, Center } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { RGBELoader } from 'three-stdlib'
import { useControls } from 'leva'

type RingProps = ThreeElements['group'] & {
    diamondMap: THREE.Texture
    glbUrl: string
    metalColor: string
    gemColor: string
    aberration: number
}

function Ring({ diamondMap, glbUrl, metalColor, gemColor, aberration, ...props }: RingProps) {
    const { scene } = useGLTF(glbUrl)

    const { diamonds, metals, autoScale } = useMemo(() => {
        const diamonds: any[] = []
        const metals: any[] = []

        scene.updateWorldMatrix(true, true)
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                const name = mesh.name.toLowerCase()

                // Decompose world matrix to get flat transform relative to scene root
                const pos = new THREE.Vector3()
                const quat = new THREE.Quaternion()
                const scale = new THREE.Vector3()
                mesh.matrixWorld.decompose(pos, quat, scale)

                const item = {
                    geometry: mesh.geometry,
                    position: pos,
                    quaternion: quat,
                    scale: scale
                }

                if (name.includes('diamond') || name.includes('gem')) {
                    diamonds.push(item)
                } else if (name.includes('metal') || name.includes('ring') || name.includes('gold')) {
                    metals.push(item)
                } else {
                    // Include other meshes as metal by default if they don't match gem patterns
                    metals.push(item)
                }
            }
        })

        const box = new THREE.Box3().setFromObject(scene)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const autoScale = maxDim > 0 ? 2.5 / maxDim : 1

        return { diamonds, metals, autoScale }
    }, [scene])

    return (
        <group {...props} dispose={null}>
            <Center>
                <group scale={autoScale}>
                    {diamonds.map((d, i) => (
                        <mesh key={`diamond-${i}`} geometry={d.geometry} position={d.position} quaternion={d.quaternion} scale={d.scale}>
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
                    ))}
                    {metals.map((m, i) => (
                        <mesh
                            key={`metal-${i}`}
                            castShadow
                            receiveShadow
                            geometry={m.geometry}
                            position={m.position}
                            quaternion={m.quaternion}
                            scale={m.scale}
                        >
                            <meshPhysicalMaterial
                                color={metalColor}
                                roughness={0.02}
                                metalness={1}
                                envMapIntensity={1}
                                clearcoat={1}
                                clearcoatRoughness={0}
                                iridescence={0.05}
                                iridescenceIOR={1.5}
                                specularIntensity={2}
                                reflectivity={1}
                            />
                        </mesh>
                    ))}
                </group>
            </Center>
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
            value: "#E5C482",
            label: 'Metal',
            options: {
                '14k Yellow Gold': '#C5A059',
                'Rose Gold': '#B78A7B',
                'White Gold': '#E8E8E8',
                'Platinum': '#F0F0F5',
                'Silver': '#D1D1D6'
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

    const ringEnv = useLoader(RGBELoader, 'final-8.hdr')

    const diamondEnv = useLoader(RGBELoader, '6.58.hdr')

    // eslint-disable-next-line react-hooks/immutability
    ringEnv.mapping = THREE.EquirectangularReflectionMapping
    // eslint-disable-next-line react-hooks/immutability
    diamondEnv.mapping = THREE.EquirectangularReflectionMapping

    return (
        <>
            <color attach="background" args={['rgb(229, 228,226)']} />
            <ambientLight intensity={0.02} />
            <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={2} castShadow shadow-bias={-0.0001} />
            <pointLight position={[-10, 10, -10]} intensity={1} color="#ffffff" />

            <Environment map={ringEnv} background={false} blur={0} environmentRotation={[0, Math.PI / 4, 0]} />

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
                        diamondMap={diamondEnv}
                        glbUrl={model}
                        metalColor={metalColor}
                        gemColor={gemColor}
                        aberration={aberration}
                        rotation={[0, 0, 0]}
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

            <EffectComposer enableNormalPass={false}>
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
                    toneMappingExposure: 1.2,
                    antialias: true
                }}
            >
                <Scene />
            </Canvas>
            <Loader />
        </div>
    )
}