import { useEffect, useRef, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { caravanGeometry, caravanOffset, uteGeometry } from '../model/geometry';
import type { Setup } from '../model/types';
import { activeSetup, useActive, useStore } from '../state/store';
import { useResult, useSetup } from '../state/result';
import { LEVEL_GROUP, useUi, type ViewPreset } from '../state/ui';
import { UteModel } from './UteModel';
import { TrailerModel } from './TrailerModel';
import { DropGhost, Items } from './Items';
import { Labels } from './Labels';
import { Interaction } from './Interaction';

interface Controls {
  target: THREE.Vector3;
  update: () => void;
}

/** Front of the vehicle and back of the whole combination, in mm behind the front axle. */
function extent(setup: Setup): { front: number; end: number } {
  const g = uteGeometry(setup.ute, setup.hitch);
  const end = setup.towing ? caravanOffset(setup) + caravanGeometry(setup.caravan, setup.hitch).bodyEnd + 200 : g.sRear + 100;
  return { front: g.sFront, end };
}

/** World x (metres) of the line across the road the slope tilts the scene about: the middle of the combination. */
function slopePivot(setup: Setup): number {
  const { front, end } = extent(setup);
  return -(front + end) / 2000;
}

const slopeAngle = (grade: number) => Math.atan(grade / 100);

/** World transform that stands the level scene on the slope: climbing (+) lifts the front (+X). */
function slopeMatrix(setup: Setup, grade: number): THREE.Matrix4 {
  const px = slopePivot(setup);
  return new THREE.Matrix4()
    .makeTranslation(px, 0, 0)
    .multiply(new THREE.Matrix4().makeRotationZ(slopeAngle(grade)))
    .multiply(new THREE.Matrix4().makeTranslation(-px, 0, 0));
}

/** Everything that stands on the road: tilted together as one, with the level scene's coordinates inside. */
function SlopeTilt({ setup, children }: { setup: Setup; children: ReactNode }) {
  const grade = useUi((s) => s.slope);
  const px = slopePivot(setup);
  return (
    <group position={[px, 0, 0]} rotation={[0, 0, slopeAngle(grade)]}>
      <group name={LEVEL_GROUP} position={[-px, 0, 0]}>
        {children}
      </group>
    </group>
  );
}

/** World-space box (metres) around the ute, the caravan, or both, on the current slope. */
function bounds(preset: ViewPreset): THREE.Box3 {
  return levelBounds(preset).applyMatrix4(slopeMatrix(activeSetup(), useUi.getState().slope));
}

/** Axis-aligned box (metres) around the ute, the caravan, or both, on level ground. */
function levelBounds(preset: ViewPreset): THREE.Box3 {
  const setup = activeSetup();
  const g = uteGeometry(setup.ute, setup.hitch);
  const offset = caravanOffset(setup);
  const ute = new THREE.Box3(
    new THREE.Vector3(-g.ball.x / 1000, 0, -(g.bodyW / 2 + 250) / 1000),
    new THREE.Vector3(-g.sFront / 1000, g.zRails / 1000, (g.bodyW / 2 + 250) / 1000),
  );
  if (!setup.towing) return ute;
  const c = caravanGeometry(setup.caravan, setup.hitch);
  const half = setup.caravan.bodyWidth / 2 / 1000;
  const van = new THREE.Box3(
    new THREE.Vector3(-(offset + c.bodyEnd + 200) / 1000, 0, -half),
    new THREE.Vector3(-offset / 1000, c.roofZ / 1000, half),
  );
  if (preset === 'ute' || preset === 'front') return ute;
  if (preset === 'caravan' || preset === 'rear') return van;
  return ute.union(van);
}

const DIRECTIONS: Record<ViewPreset, [number, number, number]> = {
  iso: [0.5, 0.5, -0.85],
  ute: [0.6, 0.45, -0.75],
  caravan: [0.45, 0.45, -0.8],
  side: [0, 0.12, -1],
  top: [0, 1, 0.0005],
  front: [1, 0.22, -0.18],
  rear: [-1, 0.3, -0.2],
};

/**
 * Places the camera along the preset direction (or the given one), as close as possible while the whole box stays
 * in view.
 */
function frame(preset: ViewPreset, camera: THREE.PerspectiveCamera, direction?: THREE.Vector3) {
  const box = bounds(preset);
  const target = box.getCenter(new THREE.Vector3());
  target.y = Math.min(target.y, 1.1 + box.min.y);
  // Preset directions are taken on the slope, so a view from the front of a climbing vehicle stays above the road.
  const dir = (
    direction?.clone() ?? new THREE.Vector3(...DIRECTIONS[preset]).applyAxisAngle(new THREE.Vector3(0, 0, 1), slopeAngle(useUi.getState().slope))
  ).normalize();
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z),
  );
  const probe = camera.clone();
  let lo = 0.5;
  let hi = 200;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    probe.position.copy(target).addScaledVector(dir, mid);
    probe.lookAt(target);
    probe.updateMatrixWorld();
    const fits = corners.every((c) => {
      const p = c.clone().project(probe);
      return p.z < 1 && Math.abs(p.x) < 0.88 && Math.abs(p.y) < 0.8;
    });
    if (fits) hi = mid;
    else lo = mid;
  }
  return { target, position: target.clone().addScaledVector(dir, hi) };
}

function CameraRig() {
  const view = useUi((s) => s.view);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  useEffect(() => {
    if (!controls || size.width === 0) return;
    const { target, position } = frame(view.preset, camera);
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    // Re-frame on resize only for the first view; later resizes keep the user's camera.
  }, [view.nonce, view.preset, controls, camera, view.nonce === 0 ? size.width : 0, view.nonce === 0 ? size.height : 0]);

  // Towing on or off, another trailer type or another setup changes what is in the scene: re-centre the orbit on
  // it, keeping the angle the user is looking from.
  const sceneKey = `${useStore((s) => s.activeId)}|${useActive((s) => (s.towing ? s.caravan.kind : 'none'))}`;
  const framedKey = useRef(sceneKey);
  useEffect(() => {
    if (!controls || framedKey.current === sceneKey) return;
    framedKey.current = sceneKey;
    const { target, position } = frame(view.preset, camera, camera.position.clone().sub(controls.target));
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
  }, [sceneKey, controls, camera]);

  // Changing the slope tilts the camera with the road, so the view keeps its angle to the vehicle and the tilt shows
  // against the horizon.
  const grade = useUi((s) => s.slope);
  const tilted = useRef(grade);
  useEffect(() => {
    if (!controls || tilted.current === grade) return;
    const setup = activeSetup();
    const turn = slopeMatrix(setup, grade).multiply(slopeMatrix(setup, tilted.current).invert());
    tilted.current = grade;
    camera.position.applyMatrix4(turn);
    controls.target.applyMatrix4(turn);
    controls.update();
  }, [grade, controls, camera]);
  return null;
}

export function Scene() {
  const setup = useSetup();
  const result = useResult();
  const xray = useUi((s) => s.xray);
  const labels = useUi((s) => s.labels);
  const offset = caravanOffset(setup);
  const items = setup.towing ? setup.items : setup.items.filter((i) => i.host === 'ute');
  const { front, end } = extent(setup);
  const shadowLen = (end - front) / 1000 + 3;

  return (
    <Canvas
      // Render only when something changes: the scene is static between edits and camera moves.
      frameloop="demand"
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ fov: 35, near: 0.05, far: 400, position: [8, 5, -10] }}
      onPointerMissed={() => useUi.getState().select(null)}
    >
      <color attach="background" args={['#eceef1']} />
      <fog attach="fog" args={['#eceef1', 45, 120]} />
      {/* Procedural studio lighting for reflections: no HDR download, so it works offline. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#9da3ab']} />
        <Lightformer intensity={2.6} rotation-x={Math.PI / 2} position={[0, 7, 0]} scale={[16, 7, 1]} />
        <Lightformer intensity={1.5} rotation-y={Math.PI / 2} position={[-9, 2.2, 0]} scale={[18, 1.4, 1]} />
        <Lightformer intensity={1.5} rotation-y={-Math.PI / 2} position={[9, 2.2, 0]} scale={[18, 1.4, 1]} />
        <Lightformer intensity={1} position={[0, 1.6, 10]} scale={[12, 2.5, 1]} />
        <Lightformer intensity={1.8} color="#ffd8b0" rotation-y={Math.PI} position={[0, 3, -10]} scale={[10, 2.5, 1]} />
      </Environment>
      <hemisphereLight args={['#ffffff', '#b9b4aa', 0.45]} />
      <directionalLight
        position={[4, 14, -8]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0004}
      />
      <SlopeTilt setup={setup}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#e2e0db" roughness={1} />
        </mesh>
        <Grid
          position={[0, 0.001, 0]}
          args={[160, 160]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#cfccc5"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#bdb9b0"
          fadeDistance={45}
          fadeStrength={1.5}
          infiniteGrid={false}
        />

        <ContactShadows
          position={[-(front + end) / 2000, 0.003, 0]}
          scale={[shadowLen, 7]}
          resolution={1024}
          blur={2.2}
          opacity={0.5}
          far={2.5}
          color="#1d2228"
        />

        <UteModel ute={setup.ute} hitch={setup.hitch} xray={xray} />
        {setup.towing && <TrailerModel caravan={setup.caravan} hitch={setup.hitch} offset={offset} xray={xray} />}
        <Items items={items} offset={offset} />
        <DropGhost offset={offset} />
        {labels && <Labels setup={setup} result={result} offset={offset} />}
      </SlopeTilt>

      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={1.5} maxDistance={60} />
      <Interaction />
      <CameraRig />
    </Canvas>
  );
}
