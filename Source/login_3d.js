// login_3d.js — Phiên bản "Quantum Network"

(function () {
    if (typeof THREE === "undefined") {
        console.error("Three.js is not loaded!");
        return;
    }

    let camera, scene, renderer, composer, mouse, clock;
    let particleNetwork, crystals;

    // --- CÀI ĐẶT CHO MẠNG LƯỚI ---
    const PARTICLE_COUNT = 150;
    const LINK_DISTANCE = 25; // Khoảng cách để các hạt liên kết

    window.initCryptoScene = function () {
        const canvas = document.getElementById("bg-canvas");
        if (!canvas) return;

        clock = new THREE.Clock();
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 50;
        scene.fog = new THREE.Fog(0x030419, 60, 150);

        scene.add(new THREE.AmbientLight(0x404090, 0.8));

        // === TẠO MẠNG LƯỚI HẠT NGUYÊN TỬ ===
        particleNetwork = new THREE.Group();
        const particleGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0x4CC9F0,
            blending: THREE.AdditiveBlending, // Giúp các hạt sáng hơn khi chồng lên nhau
        });
        
        // Tạo các đường liên kết động
        const lineGeo = new THREE.BufferGeometry();
        const lineMat = new THREE.LineBasicMaterial({
            vertexColors: true, // Màu sắc của đường kẻ sẽ được xác định bởi các đỉnh
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        const lines = new THREE.LineSegments(lineGeo, lineMat);
        
        particleNetwork.add(lines); // Thêm đối tượng đường kẻ vào group
        scene.add(particleNetwork);
        
        // Tạo các hạt
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particle = new THREE.Mesh(particleGeo, particleMat);
            particle.position.set(
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100
            );
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            );
            particleNetwork.add(particle);
        }


        // === TẠO CÁC KHỐI PHA LÊ BĂNG ===
        crystals = new THREE.Group();
        const crystalGeos = [
            new THREE.OctahedronGeometry(1.2, 0),
            new THREE.IcosahedronGeometry(1.5, 0),
            new THREE.TetrahedronGeometry(1.0, 0)
        ];

        for(let i = 0; i < 20; i++) {
            const geo = crystalGeos[Math.floor(Math.random() * crystalGeos.length)];
            // Vật liệu trong suốt như băng
            const mat = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                shininess: 100,
                transparent: true,
                opacity: 0.3,
                specular: 0xdddddd
            });
            const crystal = new THREE.Mesh(geo, mat);
            crystal.position.set(
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 80
            );
            crystal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            crystal.userData.spin = new THREE.Vector3((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2);
            crystals.add(crystal);
        }
        scene.add(crystals);

        // Post-processing giữ lại hiệu ứng Bloom để làm mọi thứ phát sáng
        const renderScene = new THREE.RenderPass(scene, camera);
        const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.3, 0.5);
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);

        mouse = { x: 0, y: 0 };
        window.addEventListener("mousemove", (e) => {
            mouse.x = (e.clientX / window.innerWidth - 0.5);
            mouse.y = -(e.clientY / window.innerHeight - 0.5);
        });

        animate();
        window.addEventListener("resize", onWindowResize);
    }

    function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); }

    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        const particles = particleNetwork.children.filter(obj => obj.isMesh);
        const linesMesh = particleNetwork.children.find(obj => obj.isLineSegments);
        const linePositions = [];
        const lineColors = [];
        
        // Cập nhật vị trí các hạt
        particles.forEach(p => {
            p.position.add(p.velocity.clone().multiplyScalar(delta * 10));
            // Đảo chiều khi ra khỏi biên
            if (Math.abs(p.position.x) > 50) p.velocity.x *= -1;
            if (Math.abs(p.position.y) > 50) p.velocity.y *= -1;
            if (Math.abs(p.position.z) > 50) p.velocity.z *= -1;
        });

        // Tính toán và vẽ các đường liên kết
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                const dist = p1.position.distanceTo(p2.position);

                if (dist < LINK_DISTANCE) {
                    linePositions.push(p1.position.x, p1.position.y, p1.position.z);
                    linePositions.push(p2.position.x, p2.position.y, p2.position.z);

                    // Làm cho đường kẻ mờ đi khi khoảng cách xa dần
                    const alpha = 1.0 - dist / LINK_DISTANCE;
                    // Tạo màu chuyển đổi trên đường kẻ
                    const color1 = new THREE.Color(0xF72585);
                    const color2 = new THREE.Color(0x4CC9F0);

                    lineColors.push(color1.r, color1.g, color1.b, alpha);
                    lineColors.push(color2.r, color2.g, color2.b, alpha);
                }
            }
        }
        linesMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        linesMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 4));
        linesMesh.geometry.attributes.position.needsUpdate = true;
        linesMesh.geometry.attributes.color.needsUpdate = true;

        // Cập nhật màu và xoay các khối pha lê
        crystals.children.forEach(c => {
            c.rotation.x += c.userData.spin.x * delta;
            c.rotation.y += c.userData.spin.y * delta;
            // Dùng hàm HSL để chuyển màu mượt mà theo thời gian
            c.material.color.setHSL((time * 0.1 + c.position.x * 0.01) % 1, 0.8, 0.6);
        });
        
        camera.position.x += (mouse.x * 10 - camera.position.x) * 0.05;
        camera.position.y += (mouse.y * 10 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        composer.render();
    }

    // Hiệu ứng Warp cũ không còn phù hợp, có thể bỏ qua hoặc làm hiệu ứng mới sau
    window.triggerWarpEffect = function () { if (!window.gsap) return; gsap.to(camera, { fov: 140, duration: 1.2, ease: "power2.in", onUpdate: () => camera.updateProjectionMatrix() }); };

})();