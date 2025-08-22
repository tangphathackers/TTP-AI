// login_3d.js — Khối 3D thay tinh vân
export function initCryptoScene() {
  if (typeof THREE === "undefined") return;
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 20);

  // Ánh sáng
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const pointLight = new THREE.PointLight(0x22d3ee, 1.2, 80);
  pointLight.position.set(10, 10, 20);
  scene.add(pointLight);

  // Tạo nhiều khối
  const group = new THREE.Group();
  scene.add(group);

  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const icoGeo = new THREE.IcosahedronGeometry(0.8, 0);
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.3 })
  ];

  const cubes = [];
  for (let i = 0; i < 80; i++) {
    const geo = Math.random() > 0.5 ? cubeGeo : icoGeo;
    const mat = materials[Math.floor(Math.random() * materials.length)].clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 40
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.scale.setScalar(Math.random() * 0.6 + 0.3);
    cubes.push(mesh);
    group.add(mesh);
  }

  // Mouse parallax
  const mouse = { x: 0, y: 0 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
    mouse.y = -(e.clientY / window.innerHeight - 0.5) * 0.5;
  });

  // Animate
  function animate() {
    requestAnimationFrame(animate);

    cubes.forEach((cube, i) => {
      cube.rotation.x += 0.003 + i * 0.00005;
      cube.rotation.y += 0.002 + i * 0.00005;
      cube.position.y += Math.sin(Date.now() * 0.001 + i) * 0.002; // trôi nhẹ
    });

    camera.position.x += (mouse.x * 10 - camera.position.x) * 0.05;
    camera.position.y += (mouse.y * 10 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  // Resize
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
}