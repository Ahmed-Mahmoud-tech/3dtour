'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * GlobeCanvas — a panorama rendered as a spinning "marble world".
 *
 * The equirectangular panorama is mapped onto a sphere viewed from the
 * OUTSIDE, so a whole filmed space becomes a small planet. Draggable,
 * auto-rotating, with a teal fresnel rim glow and an orbiting particle
 * field (hero variant only).
 *
 * Client-only (WebGL) — always import with next/dynamic { ssr: false }.
 */

const FRESNEL_SHADER = {
  uniforms: {
    uColor: { value: new THREE.Color('#10c9b7') },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float f = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
      gl_FragColor = vec4(uColor, f * 0.85);
    }
  `,
};

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Marble({ textureUrl, spinRef }) {
  const groupRef = useRef();
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  const { gl } = useThree();

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    // Max anisotropy matters a lot here: the sphere's silhouette shows the
    // texture at a grazing angle, which is exactly where low anisotropy smears.
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }, [texture, gl]);

  const fresnelMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...FRESNEL_SHADER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const auto = prefersReducedMotion ? 0.02 : 0.12;
    g.rotation.y += (auto + spinRef.current.vy) * delta;
    g.rotation.x += spinRef.current.vx * delta;
    g.rotation.x = THREE.MathUtils.clamp(g.rotation.x, -0.6, 0.6);
    // Inertia decay after the user releases a drag
    spinRef.current.vy *= 0.95;
    spinRef.current.vx *= 0.9;
    // Gentle float
    g.position.y = Math.sin(performance.now() / 1800) * 0.04;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        {/* Fully rough + non-metal so the key light can't blow a specular
            hotspot over the photo; the emissive map keeps the unlit side
            legible instead of crushing it to black. */}
        <meshStandardMaterial
          map={texture}
          roughness={1}
          metalness={0}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh material={fresnelMaterial} scale={1.02}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>
    </group>
  );
}

function Particles({ count = 350 }) {
  const pointsRef = useRef();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Shell between radius 1.7 and 3.4
      const r = 1.7 + Math.random() * 1.7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi) * 0.7;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (pointsRef.current && !prefersReducedMotion) {
      pointsRef.current.rotation.y -= delta * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#3ef0dd"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function DragControls({ spinRef }) {
  const { gl } = useThree();
  const dragState = useRef(null);

  useMemo(() => {
    const el = gl.domElement;
    el.style.touchAction = 'pan-y'; // keep vertical page scroll on touch

    const onDown = (e) => {
      dragState.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.x;
      const dy = e.clientY - dragState.current.y;
      dragState.current = { x: e.clientX, y: e.clientY };
      spinRef.current.vy = dx * 0.25;
      spinRef.current.vx = dy * 0.15;
    };
    const onUp = () => {
      dragState.current = null;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onUp);
    };
  }, [gl, spinRef]);

  return null;
}

export default function GlobeCanvas({ textureUrl, particles = false, className = '' }) {
  const spinRef = useRef({ vx: 0, vy: 0 });

  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3.1], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      // ACES (R3F's default) desaturates and flattens the panorama; the marble
      // is a photo, so render it straight.
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
      }}
      style={{ cursor: 'grab', background: 'transparent' }}
    >
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 2, 4]} intensity={0.85} color="#ffffff" />
      <pointLight position={[-4, -1, -3]} intensity={1.1} color="#10c9b7" />
      <Suspense fallback={null}>
        <Marble textureUrl={textureUrl} spinRef={spinRef} />
      </Suspense>
      {particles && <Particles />}
      <DragControls spinRef={spinRef} />
    </Canvas>
  );
}
