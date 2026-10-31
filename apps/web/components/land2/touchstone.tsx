"use client";

import { useEffect, useRef } from "react";

type ThreeNS = {
  Scene: new () => {
    add: (o: unknown) => void;
  };
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => {
    position: { set: (x: number, y: number, z: number) => void };
    aspect: number;
    updateProjectionMatrix: () => void;
  };
  WebGLRenderer: new (opts: { alpha: boolean; antialias: boolean }) => {
    setSize: (w: number, h: number) => void;
    setPixelRatio: (n: number) => void;
    domElement: HTMLCanvasElement;
    render: (scene: unknown, camera: unknown) => void;
    dispose: () => void;
  };
  AmbientLight: new (color: number, intensity: number) => unknown;
  PointLight: new (color: number, intensity: number, distance: number) => { position: { set: (x: number, y: number, z: number) => void } };
  DirectionalLight: new (color: number, intensity: number) => { position: { set: (x: number, y: number, z: number) => void } };
  Group: new () => { add: (o: unknown) => void; rotation: { x: number; y: number; z: number } };
  DodecahedronGeometry: new (radius: number, detail: number) => {
    attributes: { position: { count: number; setXYZ: (i: number, x: number, y: number, z: number) => void } };
    computeVertexNormals: () => void;
  };
  Vector3: new () => {
    x: number;
    y: number;
    z: number;
    fromBufferAttribute: (attr: unknown, i: number) => { x: number; y: number; z: number; clone: () => { normalize: () => unknown }; addScaledVector: (v: unknown, s: number) => void };
  };
  MeshStandardMaterial: new (opts: Record<string, unknown>) => unknown;
  MeshBasicMaterial: new (opts: Record<string, unknown>) => unknown;
  Mesh: new (geo: unknown, mat: unknown) => { rotation: { x: number; y: number; z: number } };
  TorusGeometry: new (r: number, tube: number, radial: number, tubular: number) => unknown;
  BufferGeometry: new () => { setAttribute: (name: string, attr: unknown) => void };
  BufferAttribute: new (array: Float32Array, itemSize: number) => unknown;
  PointsMaterial: new (opts: Record<string, unknown>) => unknown;
  Points: new (geo: unknown, mat: unknown) => { rotation: { y: number } };
  Clock: new () => { getElapsedTime: () => number };
};

export function TouchstoneCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let dead = false;
    let frame = 0;
    let renderer: { dispose: () => void; domElement: HTMLCanvasElement } | null = null;
    let onMove: ((e: MouseEvent) => void) | null = null;
    let onResize: (() => void) | null = null;

    const boot = () => {
      const THREE = (window as unknown as { THREE?: ThreeNS }).THREE;
      if (!THREE || dead || !container) return;

      const width = container.clientWidth || 360;
      const height = container.clientHeight || 288;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.2);

      const gl = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      gl.setSize(width, height);
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      gl.domElement.style.position = "relative";
      gl.domElement.style.zIndex = "1";
      container.appendChild(gl.domElement);
      renderer = gl;

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const goldLight = new THREE.PointLight(0xffb800, 3.5, 10);
      goldLight.position.set(2, 2, 2.5);
      scene.add(goldLight);
      const rimLight = new THREE.DirectionalLight(0xffea79, 1.8);
      rimLight.position.set(-2, 3, -1);
      scene.add(rimLight);

      const stoneGroup = new THREE.Group();
      scene.add(stoneGroup);

      const geo = new THREE.DodecahedronGeometry(1.25, 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.z *= 0.65;
        v.y *= 0.95;
        const noise = Math.sin(v.x * 4) * Math.cos(v.y * 3.5) * 0.08;
        v.addScaledVector(v.clone().normalize(), noise);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      stoneGroup.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.35, metalness: 0.85 })));

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.02, 16, 100),
        new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
      );
      ring.rotation.x = Math.PI / 3;
      stoneGroup.add(ring);

      const particleCount = 40;
      const pGeo = new THREE.BufferGeometry();
      const pPositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        pPositions[i] = (Math.random() - 0.5) * 3.5;
        pPositions[i + 1] = (Math.random() - 0.5) * 3.5;
        pPositions[i + 2] = (Math.random() - 0.5) * 2.5;
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
      const particles = new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({ color: 0xffbe1a, size: 0.045, transparent: true, opacity: 0.85 }),
      );
      scene.add(particles);

      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;
      onMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 1.2;
        targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 1.2;
      };
      container.addEventListener("mousemove", onMove);

      onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        gl.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      const clock = new THREE.Clock();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = () => {
        if (dead) return;
        frame = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();
        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;
        stoneGroup.rotation.y = (reduced ? 0.4 : t * 0.28) + mouseX;
        stoneGroup.rotation.x = Math.sin(t * 0.25) * 0.15 + mouseY;
        ring.rotation.z = reduced ? 0.2 : t * 0.45;
        particles.rotation.y = reduced ? 0 : -t * 0.08;
        gl.render(scene, camera);
      };
      tick();
    };

    const existing = (window as unknown as { THREE?: ThreeNS }).THREE;
    let script: HTMLScriptElement | null = null;
    if (existing) boot();
    else {
      script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.async = true;
      script.onload = () => boot();
      document.head.appendChild(script);
    }

    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      if (onMove) container.removeEventListener("mousemove", onMove);
      if (onResize) window.removeEventListener("resize", onResize);
      renderer?.domElement.remove();
      renderer?.dispose();
      script?.remove();
    };
  }, []);

  return (
    <div className="w-full h-72 relative flex items-center justify-center cursor-grab active:cursor-grabbing" ref={ref}>
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="w-48 h-48 object-contain blur-[1px]" src="/brand/touchstone.png" />
      </div>
    </div>
  );
}
