import * as THREE from 'three'
import { useMemo, Suspense } from 'react'
import { Canvas, useLoader, type ThreeElements } from '@react-three/fiber'
import { useGLTF, MeshRefractionMaterial, ContactShadows, Environment, OrbitControls, Loader, Center, useEnvironment } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { RGBELoader } from 'three-stdlib'
import { useControls } from 'leva'

type RingProps = ThreeElements['group'] & {
    diamondMap: THREE.Texture
    glbUrl: string
    diamondGltfUrl?: string
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

function Ring({ diamondMap, glbUrl, diamondGltfUrl, metalColor, gemColor, aberration, ...props }: RingProps) {
    const { scene } = useGLTF(glbUrl)
    const diamondGltf = useGLTF(diamondGltfUrl)

    const { diamonds, metals, autoScale } = useMemo(() => {
        const diamonds: RingNode[] = []
        const metals: RingNode[] = []

        let externalDiamondGeometry: THREE.BufferGeometry | null = null
        const externalDiamondScale = new THREE.Vector3(1, 1, 1)

        if (diamondGltf) {
            diamondGltf.scene.traverse((child) => {
                if ((child as THREE.Mesh).isMesh && !externalDiamondGeometry) {
                    const mesh = child as THREE.Mesh
                    externalDiamondGeometry = mesh.geometry
                    mesh.updateWorldMatrix(true, false)
                    mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), externalDiamondScale)
                }
            })
        }

        scene.updateWorldMatrix(true, true)
        scene.traverse((child) => {
            const name = child.name.toLowerCase()

            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
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

                if (name.includes('diamond') || name.includes('gem') || name.includes('stone') || name.includes('rnd')) {
                    diamonds.push(item)
                } else if (name.includes('metal') || name.includes('ring') || name.includes('gold') || name.includes('body')) {
                    metals.push(item)
                } else {
                    metals.push(item)
                }
            } else if (name.includes('anchor') && externalDiamondGeometry) {
                const pos = new THREE.Vector3()
                const quat = new THREE.Quaternion()
                const scale = new THREE.Vector3()
                child.matrixWorld.decompose(pos, quat, scale)

                const finalScale = scale.clone().multiply(externalDiamondScale)

                diamonds.push({
                    geometry: externalDiamondGeometry,
                    position: pos,
                    quaternion: quat,
                    scale: finalScale
                })
            }
        })

        const totalBox = new THREE.Box3()
        metals.forEach(m => {
            const b = m.geometry.boundingBox || m.geometry.computeBoundingBox() || m.geometry.boundingBox!
            totalBox.expandByPoint(new THREE.Vector3().copy(m.position).add(new THREE.Vector3(b.min.x * m.scale.x, b.min.y * m.scale.y, b.min.z * m.scale.z)))
            totalBox.expandByPoint(new THREE.Vector3().copy(m.position).add(new THREE.Vector3(b.max.x * m.scale.x, b.max.y * m.scale.y, b.max.z * m.scale.z)))
        })
        diamonds.forEach(d => {
            const b = d.geometry.boundingBox || d.geometry.computeBoundingBox() || d.geometry.boundingBox!
            totalBox.expandByPoint(new THREE.Vector3().copy(d.position).add(new THREE.Vector3(b.min.x * d.scale.x, b.min.y * d.scale.y, b.min.z * d.scale.z)))
            totalBox.expandByPoint(new THREE.Vector3().copy(d.position).add(new THREE.Vector3(b.max.x * d.scale.x, b.max.y * d.scale.y, b.max.z * d.scale.z)))
        })

        const size = totalBox.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const targetSize = 2.0
        const autoScale = maxDim > 0.0001 ? targetSize / maxDim : 1

        return { diamonds, metals, autoScale }
    }, [scene, diamondGltf])

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
                                bounces={4}
                                ior={2.4}
                                fresnel={1}
                                fastChroma={true}
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
                                roughness={0.01}
                                metalness={1}
                                envMapIntensity={1.0}
                                reflectivity={1.0}
                                clearcoat={1}
                                clearcoatRoughness={0}
                                iridescence={0.02}
                                iridescenceIOR={1.5}
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
                'Test (Ring + Stones)': "/test.gltf",
                'Classic Solitaire': '/ring-1.glb',
                'Modern Band': '/ring.glb',
                'Stone Only': '/test-diamond.gltf',
            }
        },
        metalColor: {
            label: 'Metal',
            options: {
                '14k Yellow Gold': '#D8C08C',
                'Rose Gold': '#E0B59E',
                'White Gold': '#CCCCCC',
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

    const ringEnvRaw = useLoader(RGBELoader, 'final-8.hdr')

    const ringEnv = useMemo(() => {
        const t = ringEnvRaw.clone()
        t.mapping = THREE.EquirectangularReflectionMapping
        t.needsUpdate = true
        return t
    }, [ringEnvRaw])

    // useEnvironment returns a proper PMREM CubeTexture — what MeshRefractionMaterial actually needs
    const diamondEnv = useEnvironment({ files: '6.58.hdr' })

    return (
        <>
            <color attach="background" args={['#f0f0f0']} />
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={1} castShadow shadow-bias={-0.0001} />
            <pointLight position={[-10, 10, -10]} intensity={0.5} color="#ffffff" />

            <Environment map={ringEnv} />

            <OrbitControls
                makeDefault
                minDistance={3}
                maxDistance={12}
                enablePan={false}
                dampingFactor={0.05}
                autoRotate
                autoRotateSpeed={0.5}

            />

            <Suspense fallback={null}>
                <group position={[0, -0.5, 0]}>
                    <Ring
                        key={model}
                        diamondMap={diamondEnv}
                        glbUrl={model}
                        diamondGltfUrl={model === "/test.gltf" ? "/test-diamond.gltf" : undefined}
                        metalColor={metalColor}
                        gemColor={gemColor}
                        aberration={aberration}
                    />

                    <ContactShadows
                        resolution={1024}
                        scale={8}
                        blur={2}
                        opacity={0.2}
                        far={1.5}
                        color="#000000"
                        position={[0, -0.01, 0]}
                    />
                </group>
            </Suspense>

            <EffectComposer multisampling={8}>
                <Bloom luminanceThreshold={1.2} intensity={0.5} levels={8} mipmapBlur />
            </EffectComposer>
        </>
    )
}

export default function App() {
    return (
        <div className="container" style={{ width: '100vw', height: '100vh', background: '#f0f0f0' }}>
            <Canvas
                shadows
                camera={{ position: [0, 2, 8], fov: 20 }}
                gl={{
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.0,
                    antialias: true,
                    preserveDrawingBuffer: true
                }}
            >
                <Scene />
            </Canvas>
            <Loader />
        </div>
    )
}
