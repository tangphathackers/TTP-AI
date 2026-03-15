// login_main.js — Phiên bản tích hợp Supabase Auth + GSAP + Audio

document.addEventListener("DOMContentLoaded", () => {
  const introLogo = document.getElementById("intro-logo");
  const loginContainer = document.getElementById("login-container");

  // Khởi tạo 3D
  if (window.initCryptoScene) {
    window.initCryptoScene();
  }

  // Animation Logo Intro
  if (introLogo && window.gsap) {
    const tl = gsap.timeline();
    tl.fromTo( introLogo.querySelector("h1"), { scale: 0.6, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 1.5, ease: "elastic.out(1, 0.7)" });
    tl.to(introLogo, { delay: 1, opacity: 0, duration: 1, onComplete: () => {
        introLogo.remove();
        loginContainer.classList.remove("opacity-0", "invisible");
        gsap.fromTo( "#login-form", { y: 50, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" });
      },
    });
  } else {
    if(introLogo) introLogo.remove();
    loginContainer.classList.remove("opacity-0", "invisible");
  }

  // === QUẢN LÝ NHẠC NỀN ===
  const ambienceSound = document.getElementById("audio-ambience");
  let isAudioInitialized = false;
  function initializeAudio() {
    if (isAudioInitialized || !ambienceSound) return;
    isAudioInitialized = true;
    ambienceSound.volume = 0.2;
    ambienceSound.play().catch(e => {});
    document.body.removeEventListener('click', initializeAudio);
    document.body.removeEventListener('mousemove', initializeAudio);
  }
  document.body.addEventListener('click', initializeAudio);
  document.body.addEventListener('mousemove', initializeAudio);


  // === LOGIC XÁC THỰC TÀI KHOẢN MỚI (SUPABASE) ===
  const verifyBtn = document.getElementById("verifyBtn");
  const registerBtn = document.getElementById("registerBtn");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const statusText = document.getElementById("status-text");
  
  // Hiệu ứng dịch chuyển khi đăng nhập thành công
  const redirectToDashboard = () => { 
    if(window.triggerWarpEffect) window.triggerWarpEffect(); 
    gsap.to("#login-form", { opacity: 0, scale: 0.9, duration: 0.8, ease: "power2.in" }); 
    setTimeout(() => { 
      const overlay = document.createElement("div"); 
      overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#000; opacity:0; z-index:9999; transition:opacity 0.5s ease;"; 
      document.body.appendChild(overlay); 
      requestAnimationFrame(() => { overlay.style.opacity = 1; }); 
      setTimeout(() => { window.location.href = "/dashboard"; }, 500); 
    }, 800); 
  };

  // Hàm gọi API Đăng nhập / Đăng ký
  const sendAuth = async (endpoint, actionName, btnElement) => {
    const user = usernameInput ? usernameInput.value.trim() : "";
    const pass = passwordInput ? passwordInput.value.trim() : "";

    if (!user || !pass) {
      statusText.textContent = "❗ Vui lòng nhập Tên đăng nhập và Mật khẩu!";
      statusText.style.color = 'var(--error-glow, #ff5b5b)';
      if(usernameInput) usernameInput.classList.add('error');
      if(passwordInput) passwordInput.classList.add('error');
      setTimeout(() => {
        if(usernameInput) usernameInput.classList.remove('error');
        if(passwordInput) passwordInput.classList.remove('error');
      }, 1000);
      return;
    }

    const originalText = btnElement.textContent;
    btnElement.innerHTML = `<span style="display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 1s linear infinite; margin-right:8px;"></span> Đang xử lý...`;
    btnElement.disabled = true;

    try {
      // Gọi API nội bộ của Golang (Go sẽ lo phần kết nối với Supabase)
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user, key: pass }) // Vẫn giữ key 'id' và 'key' để Go đọc được struct
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === "ok") {
        statusText.style.color = '#4ade80';
        statusText.textContent = data.message || `✅ ${actionName} thành công!`;
        
        if (endpoint === '/verify') {
          localStorage.setItem("ttp_key_info", JSON.stringify(data));
          statusText.textContent = "✅ Thành công! Đang dịch chuyển...";
          redirectToDashboard();
        }
      } else {
        throw new Error(data.message || `${actionName} thất bại.`);
      }
    } catch (err) {
      statusText.style.color = '#ff5b5b';
      statusText.textContent = "❌ Lỗi: " + err.message;
      if(usernameInput) usernameInput.classList.add('error');
      if(passwordInput) passwordInput.classList.add('error');
      setTimeout(() => {
        if(usernameInput) usernameInput.classList.remove('error');
        if(passwordInput) passwordInput.classList.remove('error');
      }, 1000);
    } finally {
      btnElement.textContent = originalText;
      btnElement.disabled = false;
    }
  };

  // Gán sự kiện
  if(verifyBtn) verifyBtn.addEventListener("click", () => sendAuth("/verify", "Đăng nhập", verifyBtn));
  if(registerBtn) registerBtn.addEventListener("click", () => sendAuth("/register", "Đăng ký", registerBtn));
  if(passwordInput) passwordInput.addEventListener("keyup", (e) => { if (e.key === "Enter") sendAuth("/verify", "Đăng nhập", verifyBtn); });

  // CSS Animation cho icon xoay
  const style = document.createElement('style');
  style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
});
