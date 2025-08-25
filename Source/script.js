// --- TTP-AI Interface v30.2
// --- MODULES & IMPORTS ---
import { initParticles } from './particles.js';
// --- SECURE COMMUNICATIONS MODULE ---
const SecureComms = (() => {
const serverHost = "127.0.0.1:8080";
async function sendRequest(endpoint, payload) {
const response = await fetch(`https://` + serverHost + endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
credentials: 'include',
body: JSON.stringify(payload)
});
const responseData = await response.json();
if (!response.ok) {
if (response.status === 401 || response.status === 403) {
alert("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
localStorage.removeItem("ttp_key_info");
window.location.href = '/';
}
throw new Error(responseData.message || `Lỗi HTTP: ${response.status}`);
}
return responseData;
}
return {
exec: (cmd) => sendRequest('/ttp-ai-exec', { cmd }),
chat: (prompt) => sendRequest('/chat-ai', { prompt }),
getDeviceDetails: () => sendRequest('/get-device-details', {}),
getCommands: () => sendRequest('/get-commands', {}),
executeCombo: (aliases) => sendRequest('/execute-combo', { aliases }), // <-- HÀM MỚI
};
})();
// --- GLOBAL REFERENCES & STATE ---
const refs = {
outputToast: document.getElementById('output'),
commandLog: document.getElementById('commandLog'),
keyInfoDiv: document.getElementById('keyInfo'),
deviceInfoDiv: document.getElementById('deviceInfo'),
batteryInfoDiv: document.getElementById('batteryInfo'),
tempInfoDiv: document.getElementById('tempInfo'),
cpuCoreGraphDiv: document.getElementById('cpuCoreGraph'),
runDiagnosticsBtn: document.getElementById('runDiagnosticsBtn'),
suggestionContent: document.getElementById('aiSuggestionContent'),
diagnosticActions: document.getElementById('diagnostic-actions'),
initialMessage: document.getElementById('aiInitialMessage'),
chatInput: document.getElementById('chat-input'),
chatSendBtn: document.getElementById('chat-send-btn'),
chatContainer: document.getElementById('chat-container'),
logSelector: document.getElementById('logSelector'),
refreshLogBtn: document.getElementById('refreshLogBtn'),
logViewerContent: document.getElementById('logViewerContent'),
infoTooltip: document.getElementById('info-tooltip'),
infoTooltipTitle: document.getElementById('info-tooltip-title'),
infoTooltipDesc: document.getElementById('info-tooltip-desc'),
// Combo Lab Refs (MỚI)
availableCommandsList: document.getElementById('available-commands-list'),
selectedCommandsList: document.getElementById('selected-commands-list'),
executeComboBtn: document.getElementById('execute-combo-btn'),
clearComboBtn: document.getElementById('clear-combo-btn'),
comboResults: document.getElementById('combo-results'),
};
let commandCounter = 0;
let infoTooltipTimeout;
// --- CORE HELPER & UI FUNCTIONS ---
const showInfoTooltip = (title, description) => {
clearTimeout(infoTooltipTimeout);
refs.infoTooltipTitle.textContent = title;
refs.infoTooltipDesc.textContent = description;
refs.infoTooltip.classList.add('visible');
infoTooltipTimeout = setTimeout(() => {
refs.infoTooltip.classList.remove('visible');
}, 5000);
};
const showToast = (message, type = 'pending', duration = 3000) => {
refs.outputToast.textContent = message;
refs.outputToast.className = `toast visible toast--${type}`;
setTimeout(() => { refs.outputToast.className = 'toast'; }, duration);
};
const logCommand = (cmdFriendlyName, result) => {
if (commandCounter === 0) refs.commandLog.innerHTML = '';
commandCounter++;
const timestamp = new Date().toLocaleTimeString('vi-VN');
const statusClass = result.errno === 0 ? 'status-success' : 'status-error';
const statusText = result.errno === 0 ? 'OK' : `LỖI(${result.errno})`;
const logEntry = `<div class="log-entry"><span class="timestamp">[${timestamp}]</span><span class="status ${statusClass}">${statusText}</span><span class="cmd-name">${cmdFriendlyName}</span></div>`;
refs.commandLog.insertAdjacentHTML('afterbegin', logEntry);
};
const executeCommand = async (cmd, friendlyName, buttonElement) => {
if (buttonElement && buttonElement.disabled) return;
const originalText = buttonElement.textContent;
buttonElement.disabled = true;
buttonElement.innerHTML = `<span class="spinner"></span> Đang xử lý...`;
buttonElement.classList.add('executing');
try {
const result = await SecureComms.exec(cmd);
if (result && result.action === 'redirect' && result.url) {
window.open(result.url, '_blank');
buttonElement.innerHTML = `✅ Đã mở!`;
buttonElement.classList.replace('executing', 'success');
return;
}
logCommand(friendlyName, result);
if (result.errno === 0) {
buttonElement.innerHTML = `✅ Hoàn tất!`;
buttonElement.classList.replace('executing', 'success');
const output = result.stdout;
const defaultMessages = ["✅ Lệnh đã chạy thành công.", "✅ Lệnh chạy nền đã được gửi đi thành công."];
if (output && !defaultMessages.includes(output)) {
showToast(`✅ ${friendlyName}: Hoàn tất!`, 'success');
setTimeout(() => alert(`Kết quả từ "${friendlyName}":\n\n${output}`), 100);
} else {
showToast(output || defaultMessages[0], 'success');
}
} else {
buttonElement.innerHTML = `❌ Thất bại!`;
buttonElement.classList.replace('executing', 'error');
const errorOutput = result.stderr || "Không có thông báo lỗi chi tiết.";
showToast(`❌ ${friendlyName}: Thất bại!`, 'error', 5000);
setTimeout(() => alert(`Lỗi khi chạy ${friendlyName}:\n\n${errorOutput}`), 100);
}
} catch (error) {
buttonElement.innerHTML = `❌ Lỗi!`;
buttonElement.classList.replace('executing', 'error');
showToast(`Lỗi giao tiếp: ${error.message}`, 'error', 5000);
} finally {
if (!buttonElement.innerHTML.includes("Đã mở")) {
setTimeout(() => {
buttonElement.innerHTML = originalText;
buttonElement.disabled = false;
buttonElement.classList.remove('executing', 'success', 'error');
}, 2500);
}
}
};
// TÌM HÀM populateDynamicUI VÀ THAY THẾ TOÀN BỘ NỘI DUNG CỦA NÓ

const populateDynamicUI = async () => {
try {
const allCommands = await SecureComms.getCommands();
const keyInfo = JSON.parse(localStorage.getItem('ttp_key_info') || '{}');
const allowedFeatures = keyInfo.allowedFeatures || [];
if (!Array.isArray(allCommands)) {
throw new Error("Dữ liệu lệnh nhận từ server không hợp lệ.");
}
const containers = {};
allCommands.forEach(command => {
if (command.category && !containers[command.category]) {
containers[command.category] = document.createDocumentFragment();
}
});
allCommands.forEach(command => {
const containerFragment = containers[command.category];
if (!containerFragment) return;
const button = document.createElement('button');
button.id = `ttp-${command.alias}`;
button.className = 'button';
button.textContent = command.name;
if (command.alias === 'resetall' || command.alias === 'reboot') || command.alias === 'resetsystem') {
button.classList.add('button-danger');
}
if (command.isVip) {
button.classList.add('is-vip');
}
const isAllowed = allowedFeatures.includes(command.alias);
if (isAllowed) {
let pressTimer;
const startPress = (e) => {
e.preventDefault();
pressTimer = setTimeout(() => showInfoTooltip(command.name, command.description), 700);
};
const endPress = () => clearTimeout(pressTimer);
button.addEventListener('mousedown', startPress);
button.addEventListener('mouseup', endPress);
button.addEventListener('mouseleave', endPress);
button.addEventListener('touchstart', startPress, { passive: true });
button.addEventListener('touchend', endPress);
button.addEventListener('click', () => {
if (command.alias === 'resetall' || command.alias === 'reboot') || command.alias === 'resetsystem') {
if (!confirm(`Hành động "${command.name}" có thể gây nguy hiểm. Bạn có chắc chắn?`)) {
return;
}
}
switch (command.type) {
case 'dynamic_script':
const scriptURL = prompt("Nhập link raw GitHub của script bạn muốn chạy:", command.url);
if (scriptURL) {
const cmd = `dynamic-run ${scriptURL}`;
executeCommand(cmd, `Chạy Động: ${scriptURL.split('/').pop()}`, button);
}
break;
case 'redirect':
window.open(command.url, '_blank');
button.innerHTML = `✅ Đã mở!`;
setTimeout(() => { button.innerHTML = command.name; }, 2000);
break;
default:
executeCommand(`remote-alias:${command.alias}`, command.name, button);
break;
}
});
} else {
button.disabled = true;
button.classList.add('disabled-feature');
const reason = command.isVip
? 'Tính năng này yêu cầu Key VIP. Hãy nâng cấp!'
: 'Bạn không có quyền truy cập tính năng này.';
button.addEventListener('click', () => showInfoTooltip("Tính Năng Bị Khóa", reason));
}
containerFragment.appendChild(button);
});
for (const category in containers) {
const realContainer = document.getElementById(`category-${category}`);
if (realContainer) {
realContainer.appendChild(containers[category]);
}
}
} catch (e) {
console.error("Lỗi nghiêm trọng khi tải danh sách lệnh:", e);
alert("Không thể tải danh sách tính năng từ server. Vui lòng thử lại.");
}
};
// --- SYSTEM MONITORING & OTHER FEATURES ---
const fetchDeviceInfo = async () => {
    try {
        const details = await SecureComms.getDeviceDetails();
        let deviceInfoHTML = `<b>Thiết bị:</b> ${details["ro.product.manufacturer"]} ${details["ro.product.model"]}`;
        deviceInfoHTML += `<br><b>Phiên bản Android:</b> ${details["ro.build.version.release"]} (SDK ${details["ro.build.version.sdk"]})`;
        deviceInfoHTML += `<br><b>Kiến trúc CPU:</b> ${details["ro.product.cpu.abi"]}`;
        
        if (details["android_id"]) {
            deviceInfoHTML += `<br><b>Android ID:</b> ${details["android_id"]}`;
        }
        
        deviceInfoHTML += `<br><b>Mật độ điểm ảnh:</b> ${details["ro.sf.lcd_density"]} DPI`;

        if (details["GLES_Version"]) {
            deviceInfoHTML += `<br><b>GLES Version:</b> ${details["GLES_Version"]}`;
        }

        refs.deviceInfoDiv.innerHTML = deviceInfoHTML;
    } catch (e) {
        refs.deviceInfoDiv.textContent = 'Lỗi khi tải thông tin thiết bị.';
    }
};
// TÌM VÀ THAY THẾ HÀM NÀY
const updateSystemStats = async () => {
    try {
        const command = "dumpsys battery | grep -E 'level|temperature'";
        const result = await SecureComms.exec(command);
        if (result.errno !== 0) throw new Error(result.stderr || "Lệnh dumpsys thất bại");
        
        let batteryLevel = 'N/A', temp = 'N/A';
        const lines = result.stdout.trim().split('\n');
        
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length < 2) return;
            
            const key = parts[0].trim();
            const value = parts[1]?.trim(); // <-- SỬA Ở ĐÂY
            
            if (key === 'level') {
                batteryLevel = value;
            } else if (key === 'temperature' && value) { // Thêm kiểm tra 'value' tồn tại
                temp = (parseInt(value, 10) / 10).toFixed(1);
            }
        });

        refs.batteryInfoDiv.innerHTML = `<div class="label">PIN</div><div class="value">${batteryLevel}%</div>`;
        refs.tempInfoDiv.innerHTML = `<div class="label">NHIỆT ĐỘ</div><div class="value">${temp}°C</div>`;
    } catch (e) {
        console.error("Lỗi cập nhật thông số:", e);
        refs.batteryInfoDiv.innerHTML = `<div class="label">PIN</div><div class="value">Lỗi</div>`;
        refs.tempInfoDiv.innerHTML = `<div class="label">NHIỆT ĐỘ</div><div class="value">Lỗi</div>`;
    }
};
const updateCpuGraph = async () => {
try {
const coresRes = await SecureComms.exec('grep -c "processor" /proc/cpuinfo');
const numCores = parseInt(coresRes.stdout.trim(), 10);
if (refs.cpuCoreGraphDiv.childElementCount !== numCores && numCores > 0) {
refs.cpuCoreGraphDiv.innerHTML = '';
for (let i = 0; i < numCores; i++) {
refs.cpuCoreGraphDiv.innerHTML += `
<div class="core-bar-container">
<span class="core-label">Core ${i}</span>
<div class="core-bar-wrapper">
<div class="core-bar" id="core-bar-${i}" style="width: 0%;"></div>
</div>
<span class="core-freq" id="core-freq-${i}">0 <span>MHz</span></span>
</div>`;
}
}
const freqRes = await SecureComms.exec('cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq');
const maxFreqRes = await SecureComms.exec('cat /sys/devices/system/cpu/cpu*/cpufreq/cpuinfo_max_freq');
const freqs = freqRes.stdout.trim().split('\n');
const maxFreqs = maxFreqRes.stdout.trim().split('\n');
for (let i = 0; i < numCores; i++) {
const bar = document.getElementById(`core-bar-${i}`);
const freqText = document.getElementById(`core-freq-${i}`);
if (bar && freqText && freqs[i] && maxFreqs[i]) {
const currentFreq = parseInt(freqs[i], 10);
const maxFreq = parseInt(maxFreqs[i], 10);
const percentage = (currentFreq / maxFreq) * 100;
bar.style.width = `${Math.min(100, percentage)}%`;
const currentMHz = Math.round(currentFreq / 1000);
freqText.innerHTML = `${currentMHz} <span>MHz</span>`;
}
}
} catch(e) {
console.error("Lỗi cập nhật CPU:", e);
if (refs.cpuCoreGraphDiv.innerHTML === '') {
refs.cpuCoreGraphDiv.innerHTML = '<p style="font-size: 0.8em; color: var(--text-secondary); text-align: center;">Không thể đọc thông tin CPU.</p>';
}
}
};
// TÌM VÀ THAY THẾ HÀM NÀY
// TÌM VÀ THAY THẾ LẠI TOÀN BỘ HÀM NÀY ĐỂ ĐỒNG BỘ
const runDiagnostics = async () => {
    refs.runDiagnosticsBtn.textContent = 'ĐANG PHÂN TÍCH...';
    refs.runDiagnosticsBtn.disabled = true;
    refs.suggestionContent.style.display = 'none';
    refs.diagnosticActions.querySelector('.button.ai-action')?.remove();
    try {
        const tempResult = await SecureComms.exec("dumpsys battery | grep temperature");
        const memResult = await SecureComms.exec('cat /proc/meminfo | grep MemTotal');
        
        // === SỬA LỖI TƯƠNG TỰ Ở ĐÂY ===
        const tempValue = tempResult.stdout.split(':')[1]?.trim();
        const temp = tempValue ? (parseInt(tempValue, 10) / 10).toFixed(1) : 'không rõ';

        const memValue = memResult.stdout.trim().split(/\s+/)[1];
        const memGb = memValue ? (parseInt(memValue, 10) / 1024 / 1024).toFixed(1) : 'không rõ';
        // === KẾT THÚC SỬA LỖI ===

        const availableCommands = JSON.stringify(["giamlag", "boost", "muot", "ram", "none"]);
        const prompt = `Bạn đang trò chuyện với TTP-AI – chuyên gia tối ưu điện thoại với chỉ số IQ 3000. Dữ liệu hệ thống: nhiệt độ ${temp}°C, RAM ${memGb}GB. Phân tích và trả lời BẮT BUỘC chỉ bằng một chuỗi JSON hợp lệ, KHÔNG bao gồm markdown ticks (\\\`\\\`\\\`). JSON phải có 2 key: "suggestion" (lời khuyên Tiếng Việt ngắn gọn, dưới 50 từ) và "command_alias" (chọn MỘT lệnh phù hợp nhất từ danh sách sau: ${availableCommands}). Nếu hệ thống đã ổn, trả về "none". Hãy thêm chút hài hước của tuổi teen để làm người dùng bật cười, hoặc một chút kinh dị. Thêm lời chúc của TTP-AI gửi đến họ theo thời gian thực. Code ví dụ: {"suggestion": "Nhiệt độ hơi cao, hãy thử giảm lag.", "command_alias": "giamlag"}. Nhiệt độ thấp chạy "boost"`;
        
        const aiResponse = await SecureComms.chat(prompt);
        let aiReplyText = aiResponse.reply;
        let parsedData;
        if (aiReplyText.startsWith("```json")) aiReplyText = aiReplyText.replace(/^```json\s*|```$/g, "").trim();
        try { parsedData = JSON.parse(aiReplyText); }
        catch (e) { parsedData = { suggestion: aiReplyText, command_alias: 'none' }; }
        
        refs.initialMessage.style.display = 'none';
        refs.suggestionContent.textContent = parsedData.suggestion || "AI không đưa ra lời khuyên.";
        refs.suggestionContent.style.display = 'block';

        if (parsedData.command_alias && parsedData.command_alias !== 'none') {
            const commandMap = { giamlag: 'Chạy Giảm Lag', boost: 'Chạy Tăng Tốc', muot: 'Chạy Làm Mượt', ram: 'Tối Ưu RAM' };
            const friendlyName = commandMap[parsedData.command_alias];
            if (friendlyName) {
                const actionButton = document.createElement('button');
                actionButton.className = 'button ai-action';
                actionButton.textContent = friendlyName;
                actionButton.addEventListener('click', () => executeCommand(`remote-alias:${parsedData.command_alias}`, friendlyName, actionButton));
                refs.diagnosticActions.appendChild(actionButton);
            }
        }
    } catch (e) {
        refs.suggestionContent.textContent = `Lỗi chẩn đoán: ${e.message}`;
        refs.suggestionContent.style.display = 'block';
    } finally {
        refs.runDiagnosticsBtn.textContent = 'Chạy Lại Chẩn Đoán';
        refs.runDiagnosticsBtn.disabled = false;
    }
};
// TÌM VÀ THAY THẾ TOÀN BỘ HÀM NÀY
const setupLogViewer = () => {
    // Nếu các phần tử không tồn tại, thoát sớm để tránh lỗi
    if (!refs.logSelector || !refs.refreshLogBtn || !refs.logViewerContent) {
        return;
    }
    
    // --- Hàm cốt lõi để tải nội dung log ---
    // Nó nhận tên log cần tải làm tham số
    const loadLogContent = async (logName) => {
        if (!logName) {
            refs.logViewerContent.innerHTML = '<p>Chưa chọn log nào để xem.</p>';
            return;
        }

        refs.logViewerContent.textContent = 'Đang tải log...';
        // Vô hiệu hóa cả hai nút trong khi tải để tránh người dùng nhấn liên tục
        refs.refreshLogBtn.disabled = true;
        refs.logSelector.disabled = true;

        try {
            const result = await SecureComms.exec(`tail -n 100 /sdcard/TTP-WEB/logs/${logName}.log`);
            
            if (result.errno === 0 && result.stdout) {
                // Sử dụng textContent để tránh các vấn đề XSS và hiển thị đúng các ký tự đặc biệt
                refs.logViewerContent.textContent = result.stdout;
            } else if (result.stderr && !result.stderr.includes("No such file")) {
                refs.logViewerContent.textContent = `Lỗi khi đọc file log:\n${result.stderr}`;
            } else {
                refs.logViewerContent.textContent = 'File log trống hoặc chưa được tạo.';
            }
        } catch (error) {
            refs.logViewerContent.textContent = `Lỗi nghiêm trọng khi tải log: ${error.message}`;
        } finally {
            // Kích hoạt lại cả hai nút sau khi tải xong
            refs.refreshLogBtn.disabled = false;
            refs.logSelector.disabled = false;
        }
    };

    // --- Gán sự kiện ---

    // 1. Sự kiện cho menu dropdown
    refs.logSelector.addEventListener('change', () => {
        // Khi người dùng thay đổi lựa chọn, lấy giá trị mới và gọi hàm tải log
        const selectedLog = refs.logSelector.value;
        loadLogContent(selectedLog);
    });

    // 2. Sự kiện cho nút "Làm mới"
    refs.refreshLogBtn.addEventListener('click', () => {
        // Khi người dùng nhấn nút, lấy giá trị HIỆN TẠI của dropdown và gọi hàm tải log
        const selectedLog = refs.logSelector.value;
        loadLogContent(selectedLog);
    });

    // --- Khởi tạo ban đầu ---

    // Tạo danh sách các log có thể xem
    const daemonScripts = ['cuongche', 'giamlag', 'fixnoti', 'okgoogle', 'fixnotilife']; // Cập nhật danh sách nếu cần
    daemonScripts.forEach(scriptName => {
        const option = document.createElement('option');
        option.value = scriptName;
        option.textContent = `Log: ${scriptName}.sh`;
        refs.logSelector.appendChild(option);
    });
};
const setupChat = () => {
const addMessageToChat = (text, senderClass) => {
const messageDiv = document.createElement('div');
messageDiv.className = `message ${senderClass}`;
const bubbleDiv = document.createElement('div');
bubbleDiv.className = 'bubble';
bubbleDiv.textContent = text;
messageDiv.appendChild(bubbleDiv);
refs.chatContainer.appendChild(messageDiv);
refs.chatContainer.scrollTop = refs.chatContainer.scrollHeight;
};
const sendChatMessage = async () => {
const prompt = refs.chatInput.value.trim();
if (!prompt) return;
addMessageToChat(prompt, "user");
refs.chatInput.value = "";
refs.chatSendBtn.disabled = true;
addMessageToChat("Đang suy nghĩ...", "ai loading");
try {
const result = await SecureComms.chat(prompt);
document.querySelector(".message.loading")?.remove();
addMessageToChat(result.reply, "ai");
} catch (error) {
document.querySelector(".message.loading")?.remove();
addMessageToChat(`Lỗi: ${error.message}`, "ai");
} finally {
refs.chatSendBtn.disabled = false;
refs.chatInput.focus();
}
};
refs.chatSendBtn.addEventListener('click', sendChatMessage);
refs.chatInput.addEventListener('keyup', e => {
if (e.key === 'Enter') sendChatMessage();
});
};
// TÌM VÀ THAY THẾ TOÀN BỘ HÀM NÀY
// TÌM VÀ THAY THẾ LẠI TOÀN BỘ HÀM NÀY
const setupTabs = () => {
    const tabLinks = document.querySelectorAll('.tab-link');
    
    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (link.classList.contains('active')) {
                return; // Không làm gì nếu đã active
            }

            // Lấy ID của panel mục tiêu từ thuộc tính data-tab
            const panelId = link.getAttribute('data-tab');
            const targetPanel = document.getElementById(panelId);

            // Tắt active ở tất cả các link khác
            tabLinks.forEach(item => {
                item.classList.remove('active');
            });

            // Tắt active ở tất cả các panel nội dung tab khác
            document.querySelectorAll('.tab-content.glass-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // Bật active cho link và panel được chọn
            link.classList.add('active');
            if (targetPanel) {
                targetPanel.classList.add('active');
            }

            // Cuộn thanh tab để nút được chọn vào giữa
            link.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        });
    });
};
const setupWebShell = () => {
const shellInput = document.getElementById('shell-input');
const shellOutput = document.getElementById('shell-output');
const shellPrompt = document.querySelector('.shell-prompt');
const shellSendBtn = document.getElementById('shell-send-btn');
if (!shellInput || !shellOutput || !shellPrompt || !shellSendBtn) return;
const commandHistory = [];
let historyIndex = -1;
const printToShell = (text, type = 'output') => {
const line = document.createElement('div');
if (type === 'prompt') {
line.className = 'prompt-line';
line.innerHTML = `<span style="color: var(--success-color);">${shellPrompt.textContent}</span> ${text}`;
} else if (type === 'error') {
line.className = 'error-line';
line.textContent = text;
} else {
line.textContent = text;
}
shellOutput.appendChild(line);
shellOutput.scrollTop = shellOutput.scrollHeight;
};
const executeShellCommand = async () => {
const command = shellInput.value.trim();
shellInput.value = '';
shellInput.focus();
if (!command) return;
printToShell(command, 'prompt');
if (commandHistory[commandHistory.length - 1] !== command) {
commandHistory.push(command);
}
historyIndex = commandHistory.length;
try {
const result = await SecureComms.exec(command);
if (result.stdout) {
printToShell(result.stdout, 'output');
}
if (result.stderr) {
printToShell(result.stderr, 'error');
}
} catch (error) {
printToShell(`Lỗi giao tiếp: ${error.message}`, 'error');
}
};
shellInput.addEventListener('keydown', (e) => {
if (e.key === 'Enter') {
e.preventDefault();
executeShellCommand();
} else if (e.key === 'ArrowUp') {
e.preventDefault();
if (historyIndex > 0) {
historyIndex--;
shellInput.value = commandHistory[historyIndex];
}
} else if (e.key === 'ArrowDown') {
e.preventDefault();
if (historyIndex < commandHistory.length - 1) {
historyIndex++;
shellInput.value = commandHistory[historyIndex];
} else {
historyIndex = commandHistory.length;
shellInput.value = '';
}
}
});
shellSendBtn.addEventListener('click', executeShellCommand);
};
// TÌM VÀ THAY THẾ HÀM NÀY
// TÌM VÀ THAY THẾ LẠI TOÀN BỘ HÀM NÀY
// TÌM VÀ THAY THẾ TOÀN BỘ HÀM NÀY
const setupFab = () => {
    const fabContainer = document.getElementById('fab-container');
    const fabMainBtn = document.getElementById('fab-main-btn');
    const fabBubble = document.getElementById('fab-bubble');
    const suggestionText = document.getElementById('fab-suggestion-text');
    const actionBtn = document.getElementById('fab-action-btn');

    if (!fabContainer || !fabMainBtn || !fabBubble || !actionBtn) return;

    let isRunning = false;
    let currentCommandAlias = null;
    let currentFriendlyName = null;

    // Hàm thực thi hành động của FAB
    const handleFabAction = () => {
        if (currentCommandAlias && currentFriendlyName) {
            // Gọi executeCommand với các thông tin đã lưu
            executeCommand(`remote-alias:${currentCommandAlias}`, currentFriendlyName, actionBtn);
            // Đóng bong bóng sau khi nhấn
            fabContainer.classList.remove('open');
        }
    };

    // Gán sự kiện cho nút hành động MỘT LẦN DUY NHẤT
    actionBtn.addEventListener('click', handleFabAction);

    // Hàm chính để chạy chẩn đoán
    const runAIDiagnostics = async () => {
        if (isRunning) return;
        isRunning = true;
        // Reset các lệnh cũ trước khi chạy
        currentCommandAlias = null;
        currentFriendlyName = null;

        fabContainer.classList.add('loading');
        fabContainer.classList.remove('open');
        showToast("AI đang phân tích hệ thống...", "pending");

        try {
            const tempResult = await SecureComms.exec("dumpsys battery | grep temperature");
            const memResult = await SecureComms.exec('cat /proc/meminfo | grep MemTotal');
            
            const tempValue = tempResult.stdout.split(':')[1]?.trim(); 
            const temp = tempValue ? (parseInt(tempValue, 10) / 10).toFixed(1) : 'không rõ';

            const memValue = memResult.stdout.trim().split(/\s+/)[1];
            const memGb = memValue ? (parseInt(memValue, 10) / 1024 / 1024).toFixed(1) : 'không rõ';

            const availableCommands = JSON.stringify(["giamlag", "boost", "muot", "ram", "none"]);
            const prompt = `Bạn đang trò chuyện với TTP-AI – chuyên gia tối ưu điện thoại với chỉ số IQ 3000. Dữ liệu hệ thống: nhiệt độ ${temp}°C, RAM ${memGb}GB. Phân tích và trả lời BẮT BUỘC chỉ bằng một chuỗi JSON hợp lệ, KHÔNG bao gồm markdown ticks (\\\`\\\`\\\`). JSON phải có 2 key: "suggestion" (lời khuyên Tiếng Việt ngắn gọn, dưới 50 từ) và "command_alias" (chọn MỘT lệnh phù hợp nhất từ danh sách sau: ${availableCommands}). Nếu hệ thống đã ổn, trả về "none". Hãy thêm chút hài hước của tuổi teen để làm người dùng bật cười, hoặc một chút kinh dị. Thêm lời chúc của TTP-AI gửi đến họ theo thời gian thực. Code ví dụ: {"suggestion": "Nhiệt độ hơi cao, hãy thử giảm lag.", "command_alias": "giamlag"}. Nhiệt độ thấp chạy "boost"`;
            
            const aiResponse = await SecureComms.chat(prompt);
            let parsedData;
            try { 
                const cleanResponse = aiResponse.reply.replace(/```json|```/g, "").trim();
                parsedData = JSON.parse(cleanResponse); 
            } catch (e) {
                parsedData = { suggestion: aiResponse.reply, command_alias: 'none' }; 
            }
            
            suggestionText.textContent = parsedData.suggestion || "Hệ thống ổn định.";
            
            if (parsedData.command_alias && parsedData.command_alias !== 'none') {
                const commandMap = { giamlag: 'Chạy Giảm Lag', boost: 'Chạy Tăng Tốc', muot: 'Chạy Làm Mượt', ram: 'Tối Ưu RAM' };
                const friendlyName = commandMap[parsedData.command_alias];
                
                if(friendlyName){
                    // Chỉ cập nhật thông tin và giao diện, không gán lại sự kiện
                    actionBtn.textContent = friendlyName;
                    actionBtn.style.display = 'block';
                    currentCommandAlias = parsedData.command_alias;
                    currentFriendlyName = friendlyName;
                } else {
                     actionBtn.style.display = 'none';
                }
            } else {
                actionBtn.style.display = 'none';
            }
            
            fabContainer.classList.add('open');

        } catch (error) {
            showToast(`Lỗi AI: ${error.message}`, 'error');
        } finally {
            isRunning = false;
            fabContainer.classList.remove('loading');
        }
    };

    fabMainBtn.addEventListener('click', runAIDiagnostics);

    document.addEventListener('click', (e) => {
        // Chỉ đóng nếu click ra ngoài cả container (bao gồm cả nút và bong bóng)
        if (!fabContainer.contains(e.target)) {
            fabContainer.classList.remove('open');
        }
    });
};

// ======================================================= //
// --- BẮT ĐẦU: LOGIC PHÒNG THÍ NGHIỆM COMBO (MỚI) --- //
// ======================================================= //
// TÌM VÀ THAY THẾ TOÀN BỘ HÀM NÀY - PHIÊN BẢN CUỐI CÙNG
const setupComboLab = async () => {
    // === PHẦN 1: LẤY DỮ LIỆU VÀ CÁC THAM CHIẾU ===
    const allCommands = await SecureComms.getCommands();
    const comboCompatibleCommands = allCommands.filter(cmd => cmd.type === 'script' && cmd.alias);
    
    const comboNameInput = document.getElementById('combo-name-input');
    const saveComboBtn = document.getElementById('save-combo-btn');
    const savedCombosList = document.getElementById('saved-combos-list');

    // === PHẦN 2: CÁC HÀM QUẢN LÝ DỮ LIỆU (VỚI CƠ CHẾ TỰ SỬA LỖI) ===
    
    // Hàm render (vẽ) lại danh sách các combo đã lưu
    const renderSavedCombos = () => {
        let combos = JSON.parse(localStorage.getItem('ttp_combos') || '{}');

        // === TỰ SỬA LỖI QUAN TRỌNG ===
        // Nếu dữ liệu bị hỏng (là một mảng), hãy reset nó về đối tượng rỗng
        if (Array.isArray(combos)) {
            console.error("Phát hiện dữ liệu combo bị hỏng (định dạng Array). Đang reset.");
            combos = {};
            localStorage.setItem('ttp_combos', JSON.stringify(combos)); // Ghi lại cấu trúc đúng
        }
        // === KẾT THÚC TỰ SỬA LỖI ===

        savedCombosList.innerHTML = ''; 

        const comboEntries = Object.entries(combos);

        if (comboEntries.length === 0) {
            savedCombosList.innerHTML = '<p class="drop-hint">Chưa có kịch bản nào được lưu.</p>';
            return;
        }

        comboEntries.forEach(([name, aliases]) => {
            const item = document.createElement('div');
            item.className = 'saved-combo-item';
            item.innerHTML = `
                <span class="saved-combo-item-name">${name}</span>
                <div class="saved-combo-item-actions">
                    <button class="button load-btn">Tải</button>
                    <button class="button button-danger delete-btn">Xóa</button>
                </div>
            `;
            
            item.querySelector('.load-btn').addEventListener('click', () => loadCombo(name, aliases));
            item.querySelector('.delete-btn').addEventListener('click', () => deleteCombo(name));

            savedCombosList.appendChild(item);
        });
    };

    // Hàm lưu một combo mới hoặc cập nhật combo đã có
    const saveCombo = () => {
        const name = comboNameInput.value.trim();
        if (!name) {
            showToast("Vui lòng đặt tên cho kịch bản!", 'error');
            return;
        }

        const selectedItems = refs.selectedCommandsList.querySelectorAll('.combo-command-item');
        if (selectedItems.length === 0) {
            showToast("Kịch bản rỗng, không thể lưu!", 'error');
            return;
        }

        let combos = JSON.parse(localStorage.getItem('ttp_combos') || '{}');
        // Tự sửa lỗi tương tự ở đây để đảm bảo an toàn tuyệt đối
        if (Array.isArray(combos)) {
            combos = {};
        }

        const aliases = Array.from(selectedItems).map(item => item.dataset.alias);
        
        if (combos[name] && !confirm(`Kịch bản "${name}" đã tồn tại. Bạn muốn ghi đè?`)) {
            return;
        }

        combos[name] = aliases;
        localStorage.setItem('ttp_combos', JSON.stringify(combos));
        showToast(`Đã lưu kịch bản "${name}"!`, 'success');
        renderSavedCombos(); // Cập nhật lại danh sách hiển thị
    };

    // Hàm tải một combo vào khu vực "Kịch Bản Hiện Tại"
    const loadCombo = (name, aliases) => {
        refs.selectedCommandsList.innerHTML = ''; 
        comboNameInput.value = name; 

        aliases.forEach(alias => {
            const command = comboCompatibleCommands.find(c => c.alias === alias);
            if (command) {
                const clone = document.createElement('div');
                clone.className = 'combo-command-item';
                clone.textContent = command.name;
                clone.dataset.alias = command.alias;
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = () => clone.remove();
                clone.appendChild(removeBtn);
                
                refs.selectedCommandsList.appendChild(clone);
            }
        });
        showToast(`Đã tải kịch bản "${name}".`, 'pending');
        const hint = refs.selectedCommandsList.querySelector('.drop-hint');
        if(hint) hint.style.display = 'none';
    };

    // Hàm xóa một combo
    const deleteCombo = (name) => {
        if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn kịch bản "${name}"?`)) {
            return;
        }
        let combos = JSON.parse(localStorage.getItem('ttp_combos') || '{}');
        if (Array.isArray(combos)) { combos = {}; } // Chống lỗi
        
        delete combos[name];
        localStorage.setItem('ttp_combos', JSON.stringify(combos));
        showToast(`Đã xóa kịch bản "${name}".`, 'success');
        renderSavedCombos();
    };

    // === PHẦN 3: KHỞI TẠO VÀ GÁN SỰ KIỆN (Không đổi) ===
    refs.availableCommandsList.innerHTML = ''; 
    comboCompatibleCommands.forEach(cmd => {
        const item = document.createElement('div');
        item.className = 'combo-command-item';
        item.textContent = cmd.name;
        item.dataset.alias = cmd.alias;
        item.draggable = true;
        refs.availableCommandsList.appendChild(item);
    });

    let draggedItem = null;
    // Sự kiện khi bắt đầu kéo một item từ danh sách nguồn
    refs.availableCommandsList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('combo-command-item')) {
            draggedItem = e.target;
            // Dùng dataTransfer để lưu trữ dữ liệu, một thực hành tốt
            e.dataTransfer.setData('text/plain', e.target.dataset.alias);
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });
    // Sự kiện khi kết thúc việc kéo (dù thành công hay không)
    document.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });
    // --- LOGIC CỦA VÙNG THẢ (DROP ZONE) ---
    const dropZone = refs.selectedCommandsList;

    // Sự kiện khi một item được kéo VÀO ranh giới của vùng thả
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault(); // Cho phép thả
        dropZone.classList.add('drag-over');
    });

    // Sự kiện khi một item được kéo TRÊN vùng thả
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); // Rất quan trọng: Phải gọi ở đây để cho phép thả!
    });
    
    // Sự kiện khi một item được kéo RA KHỎI ranh giới của vùng thả
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    // Sự kiện khi một item được THẢ vào vùng thả
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); // Ngăn hành vi mặc định (ví dụ: mở file)
        dropZone.classList.remove('drag-over');
        
        if (draggedItem) { // Đảm bảo chúng ta có một item đang được kéo
            const hint = dropZone.querySelector('.drop-hint');
            if(hint) hint.style.display = 'none';
            
    const clone = draggedItem.cloneNode(true);
            clone.draggable = false;
            clone.classList.remove('dragging');

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => clone.remove();
            clone.appendChild(removeBtn);

            dropZone.appendChild(clone);
        }
    });
    saveComboBtn.addEventListener('click', saveCombo);
    
    refs.clearComboBtn.addEventListener('click', () => {
        refs.selectedCommandsList.innerHTML = '<p class="drop-hint">Thả lệnh vào đây</p>';
        refs.comboResults.innerHTML = '<p>Kết quả sẽ hiển thị ở đây.</p>';
        comboNameInput.value = '';
    });

    refs.executeComboBtn.addEventListener('click', async () => {
        const selectedItems = refs.selectedCommandsList.querySelectorAll('.combo-command-item');
        if (selectedItems.length === 0) {
            showToast("Vui lòng thêm lệnh vào kịch bản!", 'error');
            return;
        }
        const aliasesToRun = Array.from(selectedItems).map(item => item.dataset.alias);
        showToast(`Bắt đầu chạy kịch bản...`, 'pending');
        refs.executeComboBtn.disabled = true;
        refs.executeComboBtn.innerHTML = `<span class="spinner"></span> Đang chạy...`;
        refs.comboResults.innerHTML = '';
        try {
            const results = await SecureComms.executeCombo(aliasesToRun);
            results.forEach((result) => {
                const timestamp = new Date().toLocaleTimeString('vi-VN');
                const statusClass = result.success ? 'status-success' : 'status-error';
                const statusText = result.success ? 'OK' : 'LỖI';
                const logEntry = `<div class="log-entry"><span class="timestamp">[${timestamp}]</span><span class="status ${statusClass}">${statusText}</span><span class="cmd-name">${result.alias}: ${result.output || (result.success ? "Hoàn thành." : "Thất bại.")}</span></div>`;
                refs.comboResults.insertAdjacentHTML('beforeend', logEntry);
            });
            showToast("Kịch bản đã thực thi xong!", 'success');
        } catch (error) {
            showToast(`Lỗi thực thi: ${error.message}`, 'error');
            refs.comboResults.innerHTML = `<div class="log-entry"><span class="status status-error">LỖI GIAO TIẾP</span><span class="cmd-name">${error.message}</span></div>`;
        } finally {
            refs.executeComboBtn.disabled = false;
            refs.executeComboBtn.innerHTML = '🚀 Chạy Kịch Bản';
        }
    });

    // === PHẦN 4: CHẠY LẦN ĐẦU TIÊN ===
    renderSavedCombos();
};

// ======================================================= //
// --- KẾT THÚC: LOGIC PHÒNG THÍ NGHIỆM COMBO --- //
// ======================================================= //





// THAY THẾ BẰNG KHỐI NÀY

// --- APPLICATION LAUNCH (PHIÊN BẢN AN TOÀN HƠN) ---
// Sử dụng sự kiện 'load' thay vì 'DOMContentLoaded'
// 'load' sẽ chỉ kích hoạt sau khi TẤT CẢ tài nguyên (CSS, images, etc.) đã được tải xong.
window.addEventListener('load', async () => {
    if (!localStorage.getItem('ttp_key_info')) {
        window.location.href = '/';
        return;
    }
    console.log("✅ Phiên hợp lệ. Tất cả tài nguyên đã tải. Bắt đầu khởi tạo giao diện.");

    const keyInfo = JSON.parse(localStorage.getItem('ttp_key_info') || '{}');
    refs.keyInfoDiv.innerHTML = `Chào mừng, <strong>${keyInfo.name || 'User'}</strong>!<br><span>HSD Key: ${keyInfo.expiry || 'N/A'}</span>`;

    // Gán sự kiện cho các thành phần tĩnh
    refs.runDiagnosticsBtn.addEventListener('click', runDiagnostics);

    // Khởi tạo các module
    setupChat();
    setupLogViewer();
    setupWebShell();
    
    // Chờ cho đến khi các nút được "vẽ" xong
    await populateDynamicUI(); 
    
    // Chỉ sau khi các nút đã ở đúng vị trí, chúng ta mới chạy các hàm thiết lập khác
    setupTabs();
    setupFab();
    await setupComboLab();

    // Khởi chạy các tác vụ nền
    fetchDeviceInfo();
    updateSystemStats();
    updateCpuGraph();
    initParticles('particleCanvas', 'rgba(0, 255, 255, 0.5)', 'rgba(0, 255, 255, 0.1)');
    
    // setInterval vẫn an toàn để đặt ở đây
    setInterval(() => {
        updateSystemStats();
        updateCpuGraph();
    }, 5000);
});