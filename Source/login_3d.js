// login_3d.js — nền 3D với các khối lập phương chuyển động
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

export function initCryptoScene() {
  const canvas = document.getElementById("bg");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 20;

  // Light
  const ambient = new THREE.AmbientLight(0x66ffff, 0.6);
  const point = new THREE.PointLight(0xffffff, 1.2);
  point.position.set(10, 15, 25);
  scene.add(ambient, point);

  // Geometry: nhiều khối cube phát sáng
  const cubes = [];
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x00f9ff,
    metalness: 0.7,
    roughness: 0.2,
    emissive: 0x005577,
    emissiveIntensity: 0.8,
  });

  for (let i = 0; i < 40; i++) {
    const size = Math.random() * 0.8 + 0.3;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = cubeMaterial.clone();
    mat.color.setHSL(Math.random(), 0.8, 0.5);

    const cube = new THREE.Mesh(geo, mat);
    cube.position.set(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 30
    );
    scene.add(cube);
    cubes.push(cube);
  }

  // Mouse parallax
  const mouse = { x: 0, y: 0 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Animate
  function animate() {
    requestAnimationFrame(animate);

    cubes.forEach((cube, i) => {
      cube.rotation.x += 0.005 + i * 0.0001;
      cube.rotation.y += 0.006 + i * 0.0001;
      cube.position.x += Math.sin(Date.now() * 0.001 + i) * 0.0005;
      cube.position.y += Math.cos(Date.now() * 0.0012 + i) * 0.0005;
    });

    camera.position.x += (mouse.x * 5 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 2 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}