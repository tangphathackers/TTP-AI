// login_3d.js — Warp Space Effect
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js";

export function initCryptoScene() {
  const canvas = document.getElementById("bg");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Warp tunnel geometry
  const geometry = new THREE.BufferGeometry();
  const particleCount = 2000;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 8 + 2;
    const z = (Math.random() - 0.5) * 100; // trải dài trên trục z
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = z;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x00f9ff,
    size: 0.05,
    transparent: true,
    opacity: 0.8,
  });

  const tunnel = new THREE.Points(geometry, material);
  scene.add(tunnel);

  // Animation
  function animate() {
    requestAnimationFrame(animate);

    const pos = tunnel.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 2] += 0.2; // di chuyển dọc trục z
      if (pos.array[i * 3 + 2] > 5) {
        pos.array[i * 3 + 2] = -100; // reset để tạo vòng lặp
      }
    }
    pos.needsUpdate = true;

    tunnel.rotation.z += 0.0005; // xoắn nhẹ
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}