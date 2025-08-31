// login_main.js (v3)
document.addEventListener("DOMContentLoaded", () => {
    const introLogo = document.getElementById("intro-logo");
    const loginContainer = document.getElementById("login-container");

    const loginForm = document.getElementById("login-form");
    const musicPlayerContainer = document.getElementById("music-player-container");
    const toggleMusicBtn = document.getElementById("toggleMusicBtn");
    const toggleMusicContainer = document.getElementById("toggle-music-container");
    const musicIframe = document.getElementById("music-iframe");

    if (window.initCryptoScene) {
        window.initCryptoScene();
    }

    // Tạm thời ẩn nút đi
    if (toggleMusicContainer) {
        toggleMusicContainer.style.display = 'none';
    }

    if (introLogo && window.gsap) {
        const tl = gsap.timeline();
        tl.fromTo( introLogo.querySelector("h1"), { scale: 0.6, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 1.5, ease: "elastic.out(1, 0.7)" });
        tl.to(introLogo, { 
            delay: 1, 
            opacity: 0, 
            duration: 1, 
            onComplete: () => {
                introLogo.remove();
                loginContainer.classList.remove("opacity-0", "invisible");
                gsap.fromTo( "#login-form", { y: 50, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" });
                
                // HIỂN THỊ NÚT BẤM SAU KHI INTRO KẾT THÚC
                if (toggleMusicContainer) {
                    toggleMusicContainer.style.display = 'block';
                    gsap.fromTo(toggleMusicContainer, { opacity: 0 }, { opacity: 1, duration: 0.5 });
                }
            },
        });
    } else {
        if(introLogo) introLogo.remove();
        loginContainer.classList.remove("opacity-0", "invisible");
        // Nếu không có intro, hiện nút ngay
        if (toggleMusicContainer) {
            toggleMusicContainer.style.display = 'block';
        }
    }

    // --- LOGIC NỘI DUNG ĐỘNG, NHẠC NỀN, VÀ API (GIỮ NGUYÊN) ---

    (function generateKeyHints() {
        const hintsContainer = document.getElementById('key-hints-container');
        if (!hintsContainer) return;
        const FREE_KEY_VALUE = "TTP";
        const VIP_KEY_URL = "https://zalo.me/g/ichtzt219";
        const hintsHTML = `<span class="free-hint">🔑 Key miễn phí: <strong>${FREE_KEY_VALUE}</strong></span><span class="vip-hint"> | VIP Key 👉 <a href="${VIP_KEY_URL}" target="_blank" rel="noopener noreferrer">Liên hệ Zalo</a></span>`;
        hintsContainer.innerHTML = hintsHTML;
    })();
    
    const ambienceSound = document.getElementById("audio-ambience");
    let isAudioInitialized = false;
    function initializeAudio() { if (isAudioInitialized || !ambienceSound) return; isAudioInitialized = true; ambienceSound.volume = 0.2; ambienceSound.play().catch(e => {}); document.body.removeEventListener('click', initializeAudio); document.body.removeEventListener('mousemove', initializeAudio); }
    document.body.addEventListener('click', initializeAudio);
    document.body.addEventListener('mousemove', initializeAudio);

    const verifyBtn = document.getElementById("verifyBtn"), keyInput = document.getElementById("key"), loader = document.getElementById("loader"), statusText = document.getElementById("status-text"), registerBtn = document.getElementById("registerBtn"), getFreeKeyBtn = document.getElementById("getFreeKeyBtn"), linkModal = document.getElementById("linkModal"), closeModalBtn = document.getElementById("closeModalBtn"), mainLinkBtn = document.getElementById("mainLinkBtn"), fallback1LinkBtn = document.getElementById("fallback1LinkBtn"), fallback2LinkBtn = document.getElementById("fallback2LinkBtn");
    function triggerErrorEffect() { statusText.style.color = 'var(--error-glow)'; keyInput.classList.add('error'); setTimeout(() => { keyInput.classList.remove('error'); statusText.style.color = ''; }, 1000); }
    const verifyKey = async () => {
    const key = keyInput.value.trim();
    if (!key) {
      statusText.textContent = "❗ Vui lòng nhập key!";
      triggerErrorEffect();
      alert("Lỗi: Vui lòng nhập key của bạn!");
      return;
    }
    setLoading(true, "Đang xác thực...");
    try {
      const id = await getUUID();
      const res = await apiFetch("/verify", { method: "POST", body: JSON.stringify({ id, key }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Lỗi server (${res.status})`);
      if (data?.status === "ok") {
        localStorage.setItem("ttp_key_info", JSON.stringify(data));
        statusText.style.color = '#4ade80';
        statusText.textContent = "✅ Thành công! Đang dịch chuyển...";
        redirectToDashboard();
      } else {
        throw new Error(data?.message || "Key không hợp lệ.");
      }
    } catch (err) {
      setLoading(false, "");
      const errorMessage = err?.message || err;
      statusText.textContent = "❌ Lỗi: " + errorMessage;
      triggerErrorEffect();
      alert("Lỗi xác thực:\n" + errorMessage);
    }
  };
  
  const redirectToDashboard = () => { if(window.triggerWarpEffect) window.triggerWarpEffect(); const base = activeBase || (location.origin && location.origin.startsWith("http") ? location.origin : "http://127.0.0.1:8080"); const url = base.replace(/\/+$/, "") + "/dashboard"; gsap.to("#login-form", { opacity: 0, scale: 0.9, duration: 0.8, ease: "power2.in" }); setTimeout(() => { const overlay = document.createElement("div"); overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#000; opacity:0; z-index:9999; transition:opacity 0.5s ease;"; document.body.appendChild(overlay); requestAnimationFrame(() => { overlay.style.opacity = 1; }); setTimeout(() => { try { window.location.replace(url); } catch(e){} setTimeout(() => { window.location.href = url; }, 200); }, 500); }, 800); };
  
  let activeBase = null;const savedBase=localStorage.getItem("ttp_server_base")||"";const candidates=[];location.origin&&location.origin.startsWith("http")&&candidates.push(location.origin);savedBase&&candidates.push(savedBase);candidates.push("http://127.0.0.1:8080");candidates.push("https://127.0.0.1:8080");candidates.push("http://localhost:8080");const headersJSON={"Content-Type":"application/json"};const apiFetch=async(t,e={})=>{let s=null;for(const o of candidates)try{const r=await fetch(o+t,{...e,headers:{...e.headers||{},...headersJSON}});return activeBase=o,r}catch(t){s=t}throw s||new Error("Không thể kết nối server")},setLoading=(t,e="")=>{loader.classList.toggle("hidden",!t);verifyBtn.classList.toggle("hidden",t);statusText.textContent=e};const getUUID=async()=>{const t=localStorage.getItem("ttp_uuid");if(t)return t;statusText.textContent="Đang lấy ID thiết bị...";try{const t=await apiFetch("/ttp-ai-exec-unprotected-get-id",{method:"POST",body:JSON.stringify({cmd:"settings get secure android_id"})}),e=await t.json().catch(()=>({}));if(t.ok&&e&&e.stdout){const t=String(e.stdout).trim();return localStorage.setItem("ttp_uuid",t),t}throw new Error("server không trả ID")}catch(t){const e="local-"+(function(){const t=new Uint8Array(16);crypto.getRandomValues(t),t[6]=15&t[6]|64,t[8]=63&t[8]|128;const e=[...t].map(t=>t.toString(16).padStart(2,"0"));return`${e[0]}${e[1]}${e[2]}${e[3]}-${e[4]}${e[5]}-${e[6]}${e[7]}-${e[8]}${e[9]}-${e.slice(10).join("")}`}());return localStorage.setItem("ttp_uuid",e),statusText.textContent="Không lấy được android_id, dùng ID tạm.",e}};const registerDevice=async()=>{if(localStorage.getItem("ttp_registration_sent"))return void alert("✅ Yêu cầu đăng ký đã được gửi trước đó.");setLoading(!0,"Đang gửi yêu cầu đăng ký...");try{const t=await getUUID(),e=await apiFetch("/register",{method:"POST",body:JSON.stringify({id:t})}),s=await e.json().catch(()=>({}));if(!e.ok)throw new Error(s?.message||"Lỗi không xác định");localStorage.setItem("ttp_registration_sent","true"),alert(s.message||"Đã gửi yêu cầu đăng ký.")}catch(t){alert("Lỗi đăng ký: "+(t?.message||t))}finally{setLoading(!1)}};

    // --- GẮN CÁC EVENT LISTENERS ---

    verifyBtn.addEventListener("click",verifyKey);
    keyInput.addEventListener("keyup",t=>{"Enter"===t.key&&verifyKey()});
    registerBtn.addEventListener("click",registerDevice);
    getFreeKeyBtn.addEventListener("click",()=>linkModal.classList.remove("hidden"));
    closeModalBtn.addEventListener("click",()=>linkModal.classList.add("hidden"));
    linkModal.addEventListener("click",t=>{t.target===linkModal&&linkModal.classList.add("hidden")});
    mainLinkBtn.addEventListener("click",()=>window.open("https://yeumoney.com/BOi3E8","_blank"));
    fallback1LinkBtn.addEventListener("click",()=>window.open("https://link4m.com/fAZyNYQZ","_blank"));
    fallback2LinkBtn.addEventListener("click",()=>alert("Link dự phòng 2 chưa có!"));
  
    // === LOGIC CỦA NÚT BẤM CHUYỂN CHẾ ĐỘ ===
    // === THAY THẾ BẰNG TOÀN BỘ KHỐI NÀY ===
if (toggleMusicBtn && loginForm && musicPlayerContainer) {
    let isMusicMode = false;
    
    // Đặt music player ngay từ đầu để nó không bị lệch
    gsap.set(musicPlayerContainer, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        xPercent: -50,
        yPercent: -60,
    });

    toggleMusicBtn.addEventListener("click", () => {
        isMusicMode = !isMusicMode;

        if (isMusicMode) {
            // Chuyển sang chế độ Nghe nhạc
            gsap.to(loginForm, {
                opacity: 0,
                scale: 0.5, // Thu nhỏ form đăng nhập lại
                duration: 0.5,
                ease: 'power2.in',
                onComplete: () => {
                    loginForm.classList.add("invisible");
                }
            });

            // Đồng thời, cho music player hiện ra từ trung tâm
            musicPlayerContainer.classList.remove("invisible");
            gsap.fromTo(musicPlayerContainer, 
                { opacity: 0, scale: 0.5 }, // Bắt đầu từ nhỏ
                { opacity: 1, scale: 1, duration: 1.0, ease: 'elastic.out(1, 0.7)', delay: 0.3 } // Phóng to ra
            );

            toggleMusicBtn.innerHTML = "🔑 Quay lại Đăng nhập";
        } else {
            // Chuyển về chế độ Đăng nhập
            const currentSrc = musicIframe.src;
            musicIframe.src = currentSrc; // Thủ thuật tải lại để dừng nhạc

            gsap.to(musicPlayerContainer, {
                opacity: 0,
                scale: 0.5, // Thu nhỏ music player
                duration: 0.5,
                ease: 'power2.in',
                onComplete: () => {
                    musicPlayerContainer.classList.add("invisible");
                }
            });

            // Đồng thời, cho form đăng nhập hiện ra
            loginForm.classList.remove("invisible");
            gsap.fromTo(loginForm, 
                { opacity: 0, scale: 0.5 }, // Bắt đầu từ nhỏ
                { opacity: 1, scale: 1, duration: 1.0, ease: 'elastic.out(1, 0.7)', delay: 0.3 } // Phóng to ra
            );

            toggleMusicBtn.innerHTML = "🎶 Chế độ Nghe nhạc";
        }
    });
}

}); // Đóng DOMContentLoaded