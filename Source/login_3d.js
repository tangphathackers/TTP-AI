// login_3d.js — Phiên bản "Cosmic Rave v3"

(function () {
    if (!THREE || !THREE.OrbitControls || !THREE.DragControls || !THREE.EffectComposer) {

        console.error("Thiếu thư viện Three.js hoặc Controls!");
        return;
    }

    let camera, scene, renderer, composer, clock;
    let particles = [], dataBlocks, asteroids, quantumGate;
    let orbitControls, dragControls;
    let draggableObjects = [];
    
    let quantumGateCore, originalVertexPositions;
    
    let pointLightPink, pointLightCyan;
    let mousePos = new THREE.Vector2();
    
    // Biến cho các hiệu ứng đặc biệt
    let bloomPass, glitchPass;
    let staticLinesMesh; // Mạng lưới nền ổn định
    let explosions = [];

    // Các hằng số cài đặt
    const SHOOTING_STAR_COUNT = 10;
    let shootingStars = [], shootingStarMesh;
    const ASTEROID_COUNT = 25;
    const PARTICLE_COUNT = 200;
    const LINK_DISTANCE = 30;

    // --- BẮT ĐẦU KHỞI TẠO CẢNH 3D ---
    window.initCryptoScene = function () {
        const canvas = document.getElementById("bg-canvas");
        if (!canvas) return;

        clock = new THREE.Clock();
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 60;
        scene.fog = new THREE.Fog(0x030419, 70, 160);

        // Ánh sáng
        scene.add(new THREE.AmbientLight(0x404090, 0.8));
        pointLightPink = new THREE.PointLight(0xF72585, 1.5, 200);
        scene.add(pointLightPink);
        pointLightCyan = new THREE.PointLight(0x4CC9F0, 1.5, 200);
        scene.add(pointLightCyan);
                // --- PHẦN 2: KHỞI TẠO CÁC VẬT THỂ 3D ---
        
        // 1. Các Hạt
        const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });
        const particleGeo = new THREE.SphereGeometry(0.2, 8, 8);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = new THREE.Mesh(particleGeo, particleMat.clone());
            p.position.set((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);
            p.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5);
            p.originalPos = p.position.clone();
            particles.push(p);
            scene.add(p);
        }

        // 2. Mạng Lưới Nền Tĩnh
        const staticLineMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true });
        staticLinesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), staticLineMat);
        scene.add(staticLinesMesh);
        
        // 3. Các Khối Hình Học
        dataBlocks = new THREE.Group();
        const geometries = [
            new THREE.RoundedBoxGeometry(1.5, 1.5, 1.5, 6, 0.2), new THREE.IcosahedronGeometry(1.2, 0),
            new THREE.OctahedronGeometry(1.2, 0), new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6)
        ];
        const ringGeo = new THREE.TorusGeometry(1.8, 0.05, 16, 100);
        const materials = [
            new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: .4, metalness: .8, roughness: .2 }),
            new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: .5, metalness: .7, roughness: .3 }),
            new THREE.MeshPhysicalMaterial({ roughness: 0.1, transmission: 1.0, thickness: 1.5 }),
            new THREE.MeshStandardMaterial({ color: 0xFFFFFF, wireframe: true, transparent: true, opacity: .3 })
        ];
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 });
        
        for (let i = 0; i < 100; i++) {
            const geo = geometries[Math.floor(Math.random() * geometries.length)];
            const mat = materials[Math.floor(Math.random() * materials.length)].clone();
            const block = new THREE.Mesh(geo, mat);
            block.position.set((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
            block.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            block.scale.setScalar(Math.random() * 0.8 + 0.3);
            block.userData.spin = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
            if (Math.random() > 0.8 && mat.type !== 'MeshPhysicalMaterial') {
                const ring = new THREE.Mesh(ringGeo, ringMaterial.clone());
                ring.rotation.x = Math.random() * Math.PI; ring.rotation.y = Math.random() * Math.PI;
                block.add(ring);
            }
            dataBlocks.add(block);
            draggableObjects.push(block);
        }
        scene.add(dataBlocks);
        
        // 4. Các Thiên Thạch
        asteroids = new THREE.Group();
        const asteroidGeos = [new THREE.IcosahedronGeometry(1.5, 0), new THREE.DodecahedronGeometry(1.2, 0)];
        const baseAsteroidMat = new THREE.MeshStandardMaterial({roughness:0.8, metalness:0.1});
        for (let i = 0; i < ASTEROID_COUNT; i++) {
            const geo = asteroidGeos[Math.floor(Math.random() * asteroidGeos.length)];
            const mat = baseAsteroidMat.clone();
            mat.color.setHSL(Math.random() * 0.1 + 0.6, 0.3, Math.random() * 0.2 + 0.1);
            const asteroid = new THREE.Mesh(geo, mat);
            asteroid.position.set((Math.random() - 0.5) * 200, 100 + 40 * Math.random(), (Math.random() - 0.5) * 200);
            asteroid.scale.setScalar(1.5 + 2.5 * Math.random());
            asteroid.userData.velocity = new THREE.Vector3(2 * (Math.random() - 0.5), -3 - 4 * Math.random(), 2 * (Math.random() - 0.5));
            asteroid.userData.spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.5);
            asteroid.userData.life = 3 + 4 * Math.random();
            asteroids.add(asteroid);
        }
        scene.add(asteroids);

        // 5. Trung tâm Vũ trụ (NCS Style)
        quantumGate = new THREE.Group();
        const coreGeo = new THREE.IcosahedronGeometry(12, 10);
        originalVertexPositions = Array.from(coreGeo.attributes.position.array);
        // SỬA LẠI (THÊM `transparent: true`)
const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff,
    emissiveIntensity: 0.5,
    metalness: 0.8, roughness: 0.2,
    transparent: true // Rất quan trọng!
});
        quantumGateCore = new THREE.Mesh(coreGeo, coreMat);
        
        const gateRing = new THREE.Mesh(
             new THREE.TorusGeometry(15, 0.1, 16, 100),
             new THREE.MeshBasicMaterial({color: 0xffffff})
        );
        gateRing.rotation.x = Math.PI/2;
        quantumGate.add(quantumGateCore, gateRing);
        scene.add(quantumGate);

        // 6. Sao băng
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SHOOTING_STAR_COUNT * 2 * 3), 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SHOOTING_STAR_COUNT * 2 * 3), 3));
        const starMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true });
        shootingStarMesh = new THREE.LineSegments(starGeo, starMat);
        scene.add(shootingStarMesh);
        for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
            shootingStars.push({ lifetime: 0 });
        }
                // --- PHẦN 3: TƯƠNG TÁC, HIỆU ỨNG & HÀM PHỤ ---

        // 1. Tương tác Controls
        orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.05;
        orbitControls.enablePan = false;
        orbitControls.enableZoom = false;
        orbitControls.autoRotate = true;
        orbitControls.autoRotateSpeed = 0.1;
        
        dragControls = new THREE.DragControls(draggableObjects, camera, renderer.domElement);
        dragControls.addEventListener("dragstart", (e) => {
            orbitControls.enabled = false;
            e.object.userData.isBeingDragged = true;
        });
        dragControls.addEventListener("dragend", (e) => {
            orbitControls.enabled = true;
            e.object.userData.isBeingDragged = false;
        });
        window.addEventListener("mousemove", onMouseMove, false);

        // 2. Thiết lập Hiệu ứng Post-Processing
        const renderScene = new THREE.RenderPass(scene, camera);
        bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.6);
        glitchPass = new THREE.GlitchPass();
        glitchPass.enabled = false;

        composer = new THREE.EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);
        composer.addPass(glitchPass);

        // 3. Timeline "Bass Drop" của GSAP
        gsap.to(camera, {
            fov: 68,
            duration: 0.1,
            ease: 'power2.inOut',
            repeat: -1,
            yoyo: true,
            repeatDelay: 1.4
        });
        gsap.to(bloomPass, {
            strength: 2.5,
            duration: 0.1,
            ease: 'power2.inOut',
            repeat: -1,
            yoyo: true,
            repeatDelay: 1.4
        });
        gsap.to([pointLightPink, pointLightCyan], {
            intensity: 3,
            duration: 0.1,
            ease: 'power2.inOut',
            repeat: -1,
            yoyo: true,
            repeatDelay: 1.4
        });
        
        // --- KẾT THÚC HÀM INIT ---
        animate();
        window.addEventListener("resize", onWindowResize);
    }

    // --- CÁC HÀM PHỤ TRỢ ---
    
    // Hàm kích hoạt hiệu ứng Glitch
    function triggerGlitch() {
        if (!glitchPass) return;
        glitchPass.enabled = true;
        setTimeout(() => {
            glitchPass.enabled = false;
        }, 150);
    }

    // Hàm tạo Vụ nổ
    function createExplosion(position) {
        const explosion = new THREE.Group();
        const flash = new THREE.PointLight(0xffeebb, 12, 180, 2);
        flash.position.copy(position);
        scene.add(flash);
        gsap.to(flash, { intensity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => scene.remove(flash) });

        for (let i = 0; i < 100; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
            mat.color.setHSL(Math.random() * 0.1 + 0.05, 1, 0.7);
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), mat);
            p.position.copy(position);
            p.userData.velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 15);
            p.userData.lifetime = 1 + Math.random() * 1;
            explosion.add(p);
        }
        scene.add(explosion);
        explosions.push(explosion);
    }

    // Hàm cập nhật vị trí chuột
    function onMouseMove(event) {
        mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Hàm thay đổi kích thước cửa sổ
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    }
        // --- PHẦN 4: VÒNG LẶP ANIMATION CHÍNH ---

    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        orbitControls.update();

        // 1. Kích hoạt Glitch ngẫu nhiên
        if (Math.random() > 0.992) {
            triggerGlitch();
        }
        
        // 2. Trung tâm Lượng tử "đập" nhanh hơn
        quantumGate.rotation.y += delta * 0.2;
        quantumGate.rotation.x += delta * 0.1;
        const coreColor = new THREE.Color().setHSL((time * 0.2) % 1, 0.9, 0.6);
        quantumGateCore.material.color = coreColor;
        quantumGateCore.material.emissive = coreColor;
        quantumGate.children[1].material.color.setHSL((time * 0.2 + 0.5) % 1, 0.9, 0.8);
        const pulseSpeed = 1.5; // Tốc độ "thở", bạn có thể chỉnh số này
    const pulse = (Math.sin(time * pulseSpeed) + 1) / 2; // Dao động từ 0 đến 1

    // Điều khiển cường độ phát sáng: từ 0.1 (gần mờ) đến 1.0 (sáng rực)
    quantumGateCore.material.emissiveIntensity = 0.1 + pulse * 0.9;
    
    // Điều khiển độ trong suốt: từ 0.3 (rất trong) đến 1.0 (đặc)
    quantumGateCore.material.opacity = 0.3 + pulse * 0.7;
        const positions = quantumGateCore.geometry.attributes.position.array;
        const noiseFactor = 1 + 0.8 * Math.sin(time * 4);
        for (let i = 0; i < positions.length; i += 3) {
            const ox = originalVertexPositions[i];
            const oy = originalVertexPositions[i + 1];
            const oz = originalVertexPositions[i + 2];
            const displacement = noiseFactor + 0.4 * Math.sin(time * 5 + ox * 0.5) * Math.cos(time * 3.5 + oy * 0.5);
            const vec = new THREE.Vector3(ox, oy, oz).normalize().multiplyScalar(displacement);
            positions[i] = ox + vec.x;
            positions[i + 1] = oy + vec.y;
            positions[i + 2] = oz + vec.z;
        }
        quantumGateCore.geometry.attributes.position.needsUpdate = true;
        quantumGateCore.geometry.computeVertexNormals();

        // 3. Cập nhật Thiên thạch & Vụ nổ
        asteroids.children.forEach(a => {
            a.userData.life -= delta;
            if (a.userData.life <= 0 || a.position.y < -100) {
                createExplosion(a.position);
                a.position.y = 120 + 20 * Math.random();
                a.position.x = (Math.random() - 0.5) * 200;
                a.position.z = (Math.random() - 0.5) * 200;
                a.userData.life = 3 + 4 * Math.random();
            }
            a.rotation.x += a.userData.spin.x * delta;
            a.rotation.y += a.userData.spin.y * delta;
            a.position.add(a.userData.velocity.clone().multiplyScalar(delta));
        });

        explosions.forEach((e, i) => {
            let allDead = true;
            e.children.forEach(p => {
                if (p.userData.lifetime > 0) {
                    allDead = false;
                    p.userData.lifetime -= delta;
                    p.userData.velocity.y -= 2 * delta;
                    p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
                    p.material.opacity = Math.max(0, p.userData.lifetime);
                } else {
                    p.visible = false;
                }
            });
            if (allDead) {
                scene.remove(e);
                explosions.splice(i, 1);
            }
        });
        
        // 4. Cập nhật Tương tác & Mạng lưới
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mousePos, camera);
        const intersectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
              mouseWorldPos = new THREE.Vector3;
        raycaster.ray.intersectPlane(intersectionPlane, mouseWorldPos);
        
        particles.forEach(p => {
            const d = p.position.distanceTo(mouseWorldPos);
            if (d < 15) { p.velocity.add(p.position.clone().sub(mouseWorldPos).normalize().multiplyScalar(0.2)); }
            p.velocity.add(p.originalPos.clone().sub(p.position).multiplyScalar(0.001));
            p.velocity.multiplyScalar(0.96);
            p.position.add(p.velocity.clone().multiplyScalar(10 * delta));
            p.material.color.setHSL((time * 0.3 + p.position.x * 0.01) % 1, 0.9, 0.6);
        });

        const linePositions = [];
        const lineColors = [];
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i]; const p2 = particles[j]; const dist = p1.position.distanceTo(p2.position);
                if (dist < LINK_DISTANCE) {
                    linePositions.push(p1.position.x, p1.position.y, p1.position.z, p2.position.x, p2.position.y, p2.position.z);
                    const alpha = 1.0 - dist / LINK_DISTANCE;
                    lineColors.push(p1.material.color.r, p1.material.color.g, p1.material.color.b, alpha, p2.material.color.r, p2.material.color.g, p2.material.color.b, alpha);
                }
            }
        }
        staticLinesMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        staticLinesMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 4));
        staticLinesMesh.geometry.attributes.position.needsUpdate = true;
        staticLinesMesh.geometry.attributes.color.needsUpdate = true;
        
        // 5. Cập nhật các khối & Sao băng
        dataBlocks.children.forEach(c => {
            if (!c.userData.isBeingDragged) {
                c.rotation.x += c.userData.spin.x * delta;
                c.rotation.y += c.userData.spin.y * delta;
            }
            const hslColor = new THREE.Color().setHSL((time * 0.2 + c.position.y * 0.005) % 1, 0.9, 0.6);
            if (c.material.isMeshStandardMaterial || c.material.isMeshPhysicalMaterial) {
                c.material.color = hslColor;
                if (c.material.emissive) c.material.emissive = hslColor;
            }
            if (c.children.length > 0) {
                c.children[0].material.color.setHSL((time * 0.2 + c.position.y * 0.005 + 0.5) % 1, 0.9, 0.8);
            }
        });
        
        const starPositions = shootingStarMesh.geometry.attributes.position.array;
        const starColors = shootingStarMesh.geometry.attributes.color.array;
        shootingStars.forEach((star, index) => {
             if (star.lifetime > 0) {
                star.lifetime -= delta;
                star.position.add(star.velocity.clone().multiplyScalar(delta));
                const head = star.position;
                const tail = head.clone().sub(star.velocity.clone().normalize().multiplyScalar(4.0));
                starPositions.set([head.x, head.y, head.z, tail.x, tail.y, tail.z], index * 6);
                starColors.set([star.color.r, star.color.g, star.color.b, star.color.r, star.color.g, star.color.b], index * 6);
            } else if (Math.random() > 0.995) {
                star.lifetime = Math.random() * 2 + 1;
                star.position = new THREE.Vector3((Math.random() - 0.5) * 150, 80, (Math.random() - 0.5) * 150);
                star.velocity = new THREE.Vector3((Math.random() - 0.5) * 20, -100 - 50 * Math.random(), (Math.random() - 0.5) * 20);
                star.color = new THREE.Color().setHSL(Math.random(), 0.8, 0.7);
            } else {
                starPositions.fill(0, index * 6, index * 6 + 6);
            }
        });
        shootingStarMesh.geometry.attributes.position.needsUpdate = true;
        shootingStarMesh.geometry.attributes.color.needsUpdate = true;
        
        // 6. Cập nhật Ánh sáng & Render
        pointLightPink.position.x = 60 * Math.sin(0.5 * time); pointLightPink.position.y = 60 * Math.cos(0.3 * time); pointLightPink.position.z = 60 * Math.cos(0.4 * time);
        pointLightCyan.position.x = 60 * Math.cos(0.3 * time); pointLightCyan.position.y = 60 * Math.sin(0.5 * time); pointLightCyan.position.z = 60 * Math.sin(0.2 * time);
        
        camera.updateProjectionMatrix();
        composer.render();
    }
    
    // Hàm Warp effect (khi đăng nhập thành công)
    window.triggerWarpEffect = function () {
        gsap && gsap.to(camera, {
            fov: 140,
            duration: 1.2,
            ease: "power2.in",
            onUpdate: () => camera.updateProjectionMatrix()
        });
    };
// Đóng IIFE
})();