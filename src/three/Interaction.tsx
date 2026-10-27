import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Host } from '../model/types';
import { caravanOffset, dirFromWorld, fromWorld, placeFromHit } from '../model/geometry';
import { activeSetup, useStore } from '../state/store';
import { sceneBridge, useUi, type SceneHit } from '../state/ui';

/** Exposes ray picking to DOM drop handlers and moves items while they are dragged in the scene. */
export function Interaction() {
  const { camera, gl, scene } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    const pick = (clientX: number, clientY: number, excludeId?: string): SceneHit | null => {
      const rect = gl.domElement.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const targets: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        if (!(o as THREE.Mesh).isMesh || !o.userData.surface) return;
        if (excludeId !== undefined && o.userData.itemId === excludeId) return;
        targets.push(o);
      });
      const hit = raycaster.intersectObjects(targets, false).find((h) => h.face);
      if (!hit || !hit.face) return null;
      const host = hit.object.userData.host as Host;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const offset = caravanOffset(activeSetup());
      return {
        host,
        point: fromWorld(host, hit.point, offset),
        normal: dirFromWorld(normal),
        surface: hit.object.userData.surface as string,
      };
    };
    sceneBridge.current = {
      pick,
      snapshot: () => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      },
    };
    return () => {
      sceneBridge.current = null;
    };
  }, [camera, gl, scene, raycaster]);

  useEffect(() => {
    let moved = false;
    const onMove = (e: PointerEvent) => {
      const id = useUi.getState().draggingId;
      if (!id) return;
      const hit = sceneBridge.current?.pick(e.clientX, e.clientY, id);
      if (!hit) return;
      const setup = activeSetup();
      const item = setup.items.find((i) => i.id === id);
      if (!item) return;
      const pl = placeFromHit(item, hit, setup);
      if (pl.host === item.host && pl.pos.x === item.pos.x && pl.pos.y === item.pos.y && pl.pos.z === item.pos.z) return;
      const store = useStore.getState();
      if (!moved) {
        store.pushHistory();
        moved = true;
      }
      store.update(
        (s) => {
          const it = s.items.find((i) => i.id === id);
          if (it) {
            it.host = pl.host;
            it.pos = pl.pos;
          }
        },
        { history: false },
      );
    };
    const onUp = () => {
      if (!useUi.getState().draggingId) return;
      useUi.getState().setDragging(null);
      moved = false;
      document.body.style.cursor = '';
      if (controls) controls.enabled = true;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [controls]);

  return null;
}
