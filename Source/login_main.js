// login_main.js — Phiên bản Auth Supabase + Hiệu ứng GSAP & Audio

document.addEventListener("DOMContentLoaded", async () => {
  const introLogo = document.getElementById("intro-logo");
  const loginContainer = document.getElementById("login-container");
  const TTP_SECRET_KEY = "ttp_secret_key"; 

  async function generateHMAC(message, secret) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const msgData = encoder.encode(message);
      const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // GỌI THẲNG LÊN GOLANG ĐỂ KIỂM TRA ANDROID_ID VẬT LÝ
  try {
    // Autologin cũng là POST nên phải cấp HMAC (Body rỗng)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = await generateHMAC("" + timestamp + nonce, TTP_SECRET_KEY);

    const autoRes = await fetch('/autologin', { 
        method: 'POST',
        headers: {
            'X-TTP-Signature': signature,
            'X-TTP-Timestamp': timestamp,
            'X-TTP-Nonce': nonce
        }
    });
    
    const autoData = await autoRes.json().catch(() => ({}));

    if (autoRes.ok && autoData.status === "ok") {
      // Golang xác nhận máy này hợp lệ, đã cấp lại Session Cookie mới!
      localStorage.setItem('ttp_key_info', JSON.stringify({ 
        name: autoData.name, 
        expiry: autoData.expiry,
        allowedFeatures: autoData.allowedFeatures 
      }));
      window.location.href = '/dashboard'; 
      return; // Cắt đứt luồng chạy, chặn hiển thị form Login
    } else {
      // Bất hợp lệ (Máy mới, hoặc Server reset session). Dọn rác trình duyệt.
      localStorage.removeItem('ttp_key_info');
    }
  } catch (e) {
    localStorage.removeItem('ttp_key_info');
  }

  // 1. Khởi tạo hiệu ứng 3D
  if (window.initCryptoScene) {
    window.initCryptoScene();
  }

  // 2. Animation Logo Intro
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
  
  // 3. Quản lý nhạc nền
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

  // 4. Logic Đăng nhập & Đăng ký (Giao tiếp với Golang)
  const verifyBtn = document.getElementById('verifyBtn');
  const registerBtn = document.getElementById('registerBtn');
  const btnText = document.getElementById('btn-text');
  const statusText = document.getElementById('status-text');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Hiệu ứng dịch chuyển khi đăng nhập thành công
  const redirectToDashboard = () => { 
    if(window.triggerWarpEffect) window.triggerWarpEffect(); 
    gsap.to("#login-form", { opacity: 0, scale: 0.9, duration: 0.8, ease: "power2.in" }); 
    setTimeout(() => { 
      const overlay = document.createElement("div"); 
      overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#000; opacity:0; z-index:9999; transition:opacity 0.5s ease;"; 
      document.body.appendChild(overlay); 
      requestAnimationFrame(() => { overlay.style.opacity = 1; }); 
      setTimeout(() => { window.location.href = '/dashboard'; }, 500); 
    }, 800); 
  };

  const sendAuth = async (endpoint, actionName) => {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();

    // KIỂM TRA ĐẦU VÀO TRƯỚC KHI GỬI
    if (!user || !pass) {
      statusText.textContent = "Vui lòng nhập đủ Tên đăng nhập và Mật khẩu!";
      statusText.style.color = "#ff453a"; 
      usernameInput.classList.add('error');
      passwordInput.classList.add('error');
      setTimeout(() => {
          usernameInput.classList.remove('error');
          passwordInput.classList.remove('error');
      }, 1000);
      return;
    }

    verifyBtn.disabled = true;
    registerBtn.disabled = true;
    const originalText = btnText.textContent;
    btnText.innerHTML = `<span class="spinner"></span> Đang ${actionName.toLowerCase()}...`;
    statusText.textContent = "";

    // TẠO CHỮ KÝ HMAC
    const payloadStr = JSON.stringify({ id: user, key: pass });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = await generateHMAC(payloadStr + timestamp + nonce, TTP_SECRET_KEY);

    try {
      const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'X-TTP-Signature': signature,
              'X-TTP-Timestamp': timestamp,
              'X-TTP-Nonce': nonce
          },
          body: payloadStr 
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === "ok") {
        statusText.textContent = data.message || `${actionName} thành công!`;
        statusText.style.color = "#32d74b"; 

        if (endpoint === '/verify') {
          localStorage.setItem('ttp_key_info', JSON.stringify({
            name: data.name,
            expiry: data.expiry,
            allowedFeatures: data.allowedFeatures
          }));
          
          statusText.textContent = "Đang vào hệ thống...";
          redirectToDashboard();
        }
      } else {
        throw new Error(data.message || `${actionName} thất bại!`);
      }
    } catch (e) {
      statusText.textContent = e.message || "Lỗi kết nối đến máy chủ!";
      statusText.style.color = "#ff453a";
      usernameInput.classList.add('error');
      passwordInput.classList.add('error');
      setTimeout(() => {
          usernameInput.classList.remove('error');
          passwordInput.classList.remove('error');
      }, 1000);
    } finally {
      verifyBtn.disabled = false;
      registerBtn.disabled = false;
      if (!btnText.innerHTML.includes("Đang vào hệ thống")) {
          btnText.textContent = originalText;
      }
    }
  };

  // 5. Gắn sự kiện Click và Enter
  if (verifyBtn) verifyBtn.addEventListener('click', () => sendAuth('/verify', 'Đăng nhập'));
  if (registerBtn) registerBtn.addEventListener('click', () => sendAuth('/register', 'Đăng ký'));
  if (passwordInput) {
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAuth('/verify', 'Đăng nhập');
      });
  }
});
