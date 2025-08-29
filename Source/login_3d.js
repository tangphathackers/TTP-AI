// login_3d.js — Phiên bản cuối cùng: Nền theo chuột, Form đứng yên

(function() {
  if (typeof THREE === "undefined") {
    console.error("Three.js is not loaded!");
    return;
  }

  let camera, scene, renderer, composer, group, mouse;
  let dataBlocks = [], starField;

  window.initCryptoScene = function() {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas) return;

    renderer = new THREE.WebGLRenderer({ canvas, antiaspect: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;
    scene.fog = new THREE.Fog(0x0b0f19, 30, 80);

    // Code dựng cảnh 3D (sao, khối, ánh sáng) không thay đổi
    const ambient=new THREE.AmbientLight(16777215,.4);scene.add(ambient);const pointLight=new THREE.PointLight(2282222,1.5,120);pointLight.position.set(0,0,30);scene.add(pointLight);const starVertices=[];for(let i=0;i<1e4;i++){const t=THREE.MathUtils.randFloatSpread(200),e=THREE.MathUtils.randFloatSpread(200),o=THREE.MathUtils.randFloatSpread(200);starVertices.push(t,e,o)}const starGeometry=new THREE.BufferGeometry;starGeometry.setAttribute("position",new THREE.Float32BufferAttribute(starVertices,3));const starMaterial=new THREE.PointsMaterial({color:8947848,size:.1,sizeAttenuation:!0});starField=new THREE.Points(starGeometry,starMaterial);scene.add(starField);group=new THREE.Group;scene.add(group);const roundedBoxGeo=new THREE.RoundedBoxGeometry(1,1,1,6,.1),icoGeo=new THREE.IcosahedronGeometry(.8,0),ringGeo=new THREE.TorusGeometry(1.2,.03,8,50),materials=[new THREE.MeshStandardMaterial({color:2282222,emissive:2282222,emissiveIntensity:.5,metalness:.8,roughness:.2}),new THREE.MeshStandardMaterial({color:11032055,emissive:11032055,emissiveIntensity:.4,metalness:.7,roughness:.3}),new THREE.MeshStandardMaterial({color:15484057,emissive:15484057,emissiveIntensity:.4,metalness:.7,roughness:.3}),new THREE.MeshStandardMaterial({color:16777215,wireframe:!0,transparent:!0,opacity:.15})],ringMaterial=new THREE.MeshBasicMaterial({color:10264015});for(let i=0;i<70;i++){const t=Math.random()>.3?roundedBoxGeo:icoGeo,e=materials[Math.floor(Math.random()*materials.length)],o=new THREE.Mesh(t,e);const s=15*Math.random()+10,a=2*Math.random()*Math.PI,r=Math.acos(2*Math.random()-1);o.position.set(s*Math.sin(r)*Math.cos(a),s*Math.sin(r)*Math.sin(a),s*Math.cos(r)-15);o.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);const n=Math.random()*.8+.3;o.scale.setScalar(n);o.userData={baseScale:n,orbitRadius:o.position.clone().length(),orbitSpeed:.001*(Math.random()-.5),initialPos:o.position.clone()};if(Math.random()>.8){const t=new THREE.Mesh(ringGeo,ringMaterial);t.rotation.x=Math.PI/2,o.add(t)}dataBlocks.push(o),group.add(o)}

    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 0.6);
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // === KHÔI PHỤC LẠI EVENT LISTENER CHO CHUỘT ===
    mouse = { x: 0, y: 0 };
    window.addEventListener("mousemove", (e) => {
      // Chỉ cập nhật tọa độ chuột, không làm gì khác
      mouse.x = (e.clientX / window.innerWidth - 0.5);
      mouse.y = -(e.clientY / window.innerHeight - 0.5);
    });
    // ===============================================

    animate();
    window.addEventListener("resize", onWindowResize);
  }

  function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); }

  function animate() {
  requestAnimationFrame(animate);
  const time = Date.now();
  
  // Animation quỹ đạo của các khối
  dataBlocks.forEach((b) => {
    b.rotation.y += 0.002;
    b.position.x = b.userData.initialPos.x * Math.cos(time * 0.001 + b.userData.orbitSpeed) - b.userData.initialPos.z * Math.sin(time * 0.001 + b.userData.orbitSpeed);
    b.position.z = b.userData.initialPos.x * Math.sin(time * 0.001 + b.userData.orbitSpeed) + b.userData.initialPos.z * Math.cos(time * 0.001 + b.userData.orbitSpeed);
  });
  
  // Thêm hiệu ứng chuyển động cho camera
  camera.position.x += (mouse.x * 5 - camera.position.x) * 0.05;
  camera.position.y += (mouse.y * 5 - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  
  composer.render();
}
  
  // Hàm Warp Effect không đổi
  window.triggerWarpEffect=function(){if(!window.gsap)return;gsap.to(camera,{fov:140,duration:1.2,ease:"power2.in",onUpdate:()=>camera.updateProjectionMatrix()});dataBlocks.forEach(b=>{gsap.to(b.position,{z:b.position.z+50,duration:1.2,ease:"power2.in"})});if(starField)gsap.to(starField.material,{size:1.5,duration:1.2,ease:"power2.in"})};
})();