import * as THREE from 'three'
import { useMemo, Suspense } from 'react'
import { Canvas, type ThreeElements, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, MeshRefractionMaterial, Environment, OrbitControls, Loader, ContactShadows, Center, Instances, Instance, Preload, AdaptiveDpr, useEnvironment, AccumulativeShadows, RandomizedLight } from '@react-three/drei'
import { EffectComposer, Bloom, BrightnessContrast } from '@react-three/postprocessing'
import { useControls } from 'leva'

type RingProps = ThreeElements['group'] & {
    diamondMap: THREE.Texture
    glbUrl: string
    metalColor: string
    gemColor: string
    aberration: number
}

type RingNode = {
    geometry: THREE.BufferGeometry
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: THREE.Vector3
}

type SceneContentProps = {
    model: string
    ringEnv: THREE.Texture
    diamondEnv: THREE.Texture
    metalColor: string
    gemColor: string
    aberration: number
}

function Ring({ diamondMap, glbUrl, metalColor, gemColor, aberration, ...props }: RingProps) {
    const { scene } = useGLTF(glbUrl)

    const { diamonds, metals, autoScale } = useMemo(() => {
        const diamonds: RingNode[] = []
        const metals: RingNode[] = []

        scene.updateWorldMatrix(true, true)
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                const name = mesh.name.toLowerCase()

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
                } else {
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
                    {/* Individual Diamonds (No Instancing for best refraction quality) */}
                    {diamonds.map((d, i) => (
                        <mesh key={`diamond-${i}`} geometry={d.geometry} position={d.position} quaternion={d.quaternion} scale={d.scale}>
                            <MeshRefractionMaterial
                                envMap={diamondMap}
                                aberrationStrength={aberration}
                                toneMapped={true}
                                color={gemColor}
                                bounces={3}
                                ior={2.4}
                                fresnel={1}
                                fastChroma={true}
                            />
                        </mesh>
                    ))}

                    {/* Instanced Metals */}
                    {metals.length > 0 && (
                        <Instances geometry={metals[0].geometry}>
                            <meshPhysicalMaterial
                                color={metalColor}
                                roughness={0.1}
                                metalness={1}
                                envMapIntensity={2.0}
                                clearcoat={1}
                                clearcoatRoughness={0.1}
                                iridescence={0}
                                specularIntensity={1}
                                reflectivity={1}
                            />
                            {metals.map((m, i) => (
                                <Instance key={`metal-${i}`} position={m.position} quaternion={m.quaternion} scale={m.scale} />
                            ))}
                        </Instances>
                    )}
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
            }
        },
        metalColor: {
            label: 'Metal',
            options: {
                'yellow-gold': '#D8C08C',   // vjson Gold
                'rose-gold': '#E0B59E',   // vjson Rose Gold
                'white-gold': '#CCCCCC',   // vjson White Gold
                'platinum': '#E8E8F2',   // extra
                'silver': '#C8C8D0',   // extra
            }
        },
        gemColor: {
            value: '#ffffff',
            label: 'Gemstone'
        },
        aberration: {
            value: 0.02,
            min: 0,
            max: 0.1,
            step: 0.01,
            label: 'Refraction'
        }
    })

    const ringEnv = useEnvironment({ files: 'KS_METAL_MASTER.hdr' })
    const diamondEnv = useEnvironment({ files: 'KS_METAL_MASTER.hdr' })

    return (
        <SceneContent
            model={model}
            ringEnv={ringEnv}
            diamondEnv={diamondEnv}
            metalColor={metalColor}
            gemColor={gemColor}
            aberration={aberration}
        />
    )
}

function EnvironmentController() {
    const { scene } = useThree()
    useFrame(({ camera }) => {
        // Dynamic environment rotation based on camera position
        // This ensures highlights always follow the viewer for premium metal look
        const angle = Math.atan2(camera.position.x, camera.position.z) + 4.7
        const s = scene as THREE.Scene & { environmentRotation?: THREE.Euler }
        if (s.environmentRotation) {
            s.environmentRotation.set(0, angle, 0)
        }
    })
    return null
}

function SceneContent({ model, ringEnv, diamondEnv, metalColor, gemColor, aberration }: SceneContentProps) {
    return (
        <>
            <ambientLight intensity={0.7} />
            <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={2} castShadow shadow-bias={-0.0001} />
            <pointLight position={[0, 4, 0]} intensity={1.5} distance={15} />

            <EnvironmentController />
            <Environment map={ringEnv} background={false} blur={0} />

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
                        key={model}
                        diamondMap={diamondEnv}
                        glbUrl={model}
                        metalColor={metalColor}
                        gemColor={gemColor}
                        aberration={aberration}
                        rotation={[0, 0, 0]}
                    />

                    <ContactShadows
                        resolution={512}
                        scale={10}
                        blur={2.5}
                        opacity={0.4}
                        far={1}
                        color="#000000"
                        position={[0, -0.85, 0]}
                    />

                    <AccumulativeShadows temporal frames={60} alphaTest={0.85} opacity={0.4} scale={10} position={[0, -0.85, 0]}>
                        <RandomizedLight amount={8} radius={5} ambient={0.5} position={[5, 5, -5]} bias={0.001} />
                    </AccumulativeShadows>
                </group>
            </Suspense>

            <EffectComposer enableNormalPass={false}>
                <Bloom luminanceThreshold={1.3} intensity={0.35} mipmapBlur />
                <BrightnessContrast brightness={0} contrast={0.3} />
            </EffectComposer>
            <Preload all />
            <AdaptiveDpr pixelated />
        </>
    )
}

export default function App() {
    return (
        <div className="container" style={{ width: '100vw', height: '100vh', background: 'rgb(229,228,226)' }}>
            <Canvas
                shadows={false}
                dpr={[1, 1.5]}
                frameloop="demand"
                camera={{ position: [5, 3, 5], fov: 25 }}
                gl={{
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.15,
                    antialias: true,
                    stencil: false,
                    alpha: true,
                    powerPreference: 'high-performance'
                }}
            >
                <Scene />
            </Canvas>
            <Loader />
        </div>
    )
}
