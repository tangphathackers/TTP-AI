// login_main.js — Intro logo + redirect chuẩn, không lỗi
import { initCryptoScene } from "./login_3d.js";

document.addEventListener("DOMContentLoaded", () => {
  const introLogo = document.getElementById("intro-logo");
  const loginContainer = document.getElementById("login-container");

  // ===== Intro Logo Animation =====
  if (introLogo) {
    if (window.gsap) {
      gsap.fromTo(
        introLogo.querySelector("h1"),
        { scale: 0.6, opacity: 0 },
        { scale: 1.2, opacity: 1, duration: 1, ease: "back.out(2)" }
      );
    }

    setTimeout(() => {
      if (window.gsap) {
        gsap.to(introLogo, {
          opacity: 0,
          duration: 0.8,
          onComplete: () => introLogo.remove(),
        });
      } else {
        introLogo.remove();
      }
      // Show 3D background
      initCryptoScene();
      // Show form
      loginContainer.classList.remove("hidden");
      if (window.motion) {
        window.motion.animate(
          "#login-form",
          { y: [40, 0], opacity: [0, 1], scale: [0.96, 1] },
          { duration: 0.8, ease: "easeOut" }
        );
      }
    }, 2500);
  } else {
    // fallback nếu không có logo
    initCryptoScene();
    loginContainer.classList.remove("hidden");
  }

  // ===== DOM =====
  const verifyBtn = document.getElementById("verifyBtn");
  const registerBtn = document.getElementById("registerBtn");
  const keyInput = document.getElementById("key");
  const loader = document.getElementById("loader");
  const statusText = document.getElementById("status-text");
  const getFreeKeyBtn = document.getElementById("getFreeKeyBtn");
  const linkModal = document.getElementById("linkModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const mainLinkBtn = document.getElementById("mainLinkBtn");
  const fallback1LinkBtn = document.getElementById("fallback1LinkBtn");
  const fallback2LinkBtn = document.getElementById("fallback2LinkBtn");

  // ===== Server config linh hoạt =====
  const savedBase = localStorage.getItem("ttp_server_base") || "";
  const candidates = [];
  if (location.origin && location.origin.startsWith("http")) candidates.push(location.origin);
  if (savedBase) candidates.push(savedBase);
  candidates.push("http://127.0.0.1:8080");
  candidates.push("https://127.0.0.1:8080");
  candidates.push("http://localhost:8080");

  let activeBase = null;
  const headersJSON = { "Content-Type": "application/json" };

  const apiFetch = async (path, options = {}) => {
    let lastErr = null;
    for (const base of candidates) {
      try {
        const res = await fetch(base + path, {
          ...options,
          headers: { ...(options.headers || {}), ...headersJSON },
        });
        activeBase = base;
        return res;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Không thể kết nối server");
  };

  // ===== Helpers =====
  const setLoading = (on, msg = "") => {
    loader.classList.toggle("hidden", !on);
    verifyBtn.classList.toggle("hidden", on);
    statusText.textContent = msg;
  };

  const genLocalUUID = () => {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = [...buf].map((b) => b.toString(16).padStart(2, "0"));
    return (
      `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-` +
      `${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex.slice(10).join("")}`
    );
  };

  const getUUID = async () => {
    const cached = localStorage.getItem("ttp_uuid");
    if (cached) return cached;

    statusText.textContent = "Đang lấy ID thiết bị...";
    try {
      const res = await apiFetch("/ttp-ai-exec-unprotected-get-id", {
        method: "POST",
        body: JSON.stringify({ cmd: "settings get secure android_id" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.stdout) {
        const id = String(data.stdout).trim();
        localStorage.setItem("ttp_uuid", id);
        return id;
      }
      throw new Error("server không trả ID");
    } catch {
      const localId = "local-" + genLocalUUID();
      localStorage.setItem("ttp_uuid", localId);
      statusText.textContent = "Không lấy được android_id, dùng ID tạm.";
      return localId;
    }
  };

  const redirectToDashboard = () => {
    const base =
      activeBase ||
      (location.origin && location.origin.startsWith("http")
        ? location.origin
        : "http://127.0.0.1:8080");
    const url = base.replace(/\/+$/, "") + "/dashboard";
    try {
      window.location.replace(url);
    } catch {}
    setTimeout(() => {
      window.location.href = url;
    }, 500);
  };

  // ===== Verify Key =====
  const verifyKey = async () => {
    const key = keyInput.value.trim();
    if (!key) {
      alert("❗ Vui lòng nhập key!");
      return;
    }
    setLoading(true, "Đang xác thực...");
    try {
      const id = await getUUID();
      const res = await apiFetch("/verify", {
        method: "POST",
        body: JSON.stringify({ id, key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data && data.message) || `Lỗi server (${res.status})`);
      }
      if (data && data.status === "ok") {
        localStorage.setItem("ttp_key_info", JSON.stringify(data));
        statusText.textContent = "✅ Thành công! Đang chuyển hướng...";
        redirectToDashboard();
      } else {
        throw new Error((data && data.message) || "Key không hợp lệ.");
      }
    } catch (err) {
      setLoading(false, "");
      alert("Lỗi xác thực: " + (err?.message || err));
    }
  };

  // ===== Register Device =====
  const registerDevice = async () => {
    if (localStorage.getItem("ttp_registration_sent")) {
      alert("✅ Yêu cầu đăng ký đã được gửi trước đó.");
      return;
    }
    setLoading(true, "Đang gửi yêu cầu đăng ký...");
    try {
      const id = await getUUID();
      const res = await apiFetch("/register", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Lỗi không xác định");
      localStorage.setItem("ttp_registration_sent", "true");
      alert(data.message || "Đã gửi yêu cầu đăng ký.");
    } catch (err) {
      alert("Lỗi đăng ký: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // ===== Events =====
  verifyBtn.addEventListener("click", verifyKey);
  keyInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") verifyKey();
  });
  registerBtn.addEventListener("click", registerDevice);

  getFreeKeyBtn.addEventListener("click", () => linkModal.classList.remove("hidden"));
  closeModalBtn.addEventListener("click", () => linkModal.classList.add("hidden"));
  linkModal.addEventListener("click", (e) => {
    if (e.target === linkModal) linkModal.classList.add("hidden");
  });
  mainLinkBtn.addEventListener("click", () =>
    window.open("https://yeumoney.com/BOi3E8", "_blank")
  );
  fallback1LinkBtn.addEventListener("click", () =>
    window.open("https://link4m.com/fAZyNYQZ", "_blank")
  );
  fallback2LinkBtn.addEventListener("click", () =>
    alert("Link dự phòng 2 chưa có!")
  );
});