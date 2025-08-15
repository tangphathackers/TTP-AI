// --- TTP-AI Interface v28.1 - Refactored & Complete ---
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
};
let commandCounter = 0;
let infoTooltipTimeout; // Biến để quản lý thời gian ẩn
// --- CORE HELPER & UI FUNCTIONS (ĐỊNH NGHĨA TRƯỚC) ---
const showInfoTooltip = (title, description) => {
clearTimeout(infoTooltipTimeout); // Xóa timeout cũ nếu có
refs.infoTooltipTitle.textContent = title;
refs.infoTooltipDesc.textContent = description;
refs.infoTooltip.classList.add('visible');
// Tự động ẩn sau 5 giây
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
// --- NÂNG CẤP: KIỂM TRA HÀNH ĐỘNG "REDIRECT" ---
if (result && result.action === 'redirect' && result.url) {
// Nếu server yêu cầu chuyển hướng, mở tab mới
window.open(result.url, '_blank');
buttonElement.innerHTML = `✅ Đã mở!`;
buttonElement.classList.replace('executing', 'success');
return; // Kết thúc hàm ở đây
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
// TÌM VÀ THAY THẾ TOÀN BỘ HÀM populateDynamicUI TRONG script.js
const populateDynamicUI = async () => {
try {
// Bước 1: Lấy dữ liệu
const allCommands = await SecureComms.getCommands();
const keyInfo = JSON.parse(localStorage.getItem('ttp_key_info') || '{}');
const allowedFeatures = keyInfo.allowedFeatures || [];
if (!Array.isArray(allCommands)) {
throw new Error("Dữ liệu lệnh nhận từ server không hợp lệ.");
}
// Bước 2: Tạo các "công trường ảo" (DocumentFragment) một cách động
// Kỹ thuật này tự động tạo ra fragment cho bất kỳ category nào có trong XML
const containers = {};
allCommands.forEach(command => {
if (command.category && !containers[command.category]) {
containers[command.category] = document.createDocumentFragment();
}
});
// Bước 3: "Xây dựng" các nút bấm trong các "công trường ảo"
allCommands.forEach(command => {
const containerFragment = containers[command.category];
if (!containerFragment) return;
const button = document.createElement('button');
button.id = `ttp-${command.alias}`;
button.className = 'button';
button.textContent = command.name;
if (command.alias === 'resetall' || command.alias === 'reboot') {
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
// === LOGIC ĐIỀU PHỐI SỰ KIỆN CLICK MỚI ===
button.addEventListener('click', () => {
// Xử lý cảnh báo cho các lệnh nguy hiểm
if (command.alias === 'resetall' || command.alias === 'reboot') {
if (!confirm(`Hành động "${command.name}" có thể gây nguy hiểm. Bạn có chắc chắn?`)) {
return;
}
}
// Phân loại và thực thi dựa trên `type` từ server
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
default: // Bao gồm 'script', 'special', 'local_script'
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
// Bước 4: "Lắp ghép" vào giao diện thật
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
// Xây dựng chuỗi HTML
let deviceInfoHTML = `<b>Thiết bị:</b> ${details["ro.product.manufacturer"]} ${details["ro.product.model"]}`;
deviceInfoHTML += `<br><b>Phiên bản Android:</b> ${details["ro.build.version.release"]} (SDK ${details["ro.build.version.sdk"]})`;
deviceInfoHTML += `<br><b>Kiến trúc CPU:</b> ${details["ro.product.cpu.abi"]}`;
// --- NÂNG CẤP: Thêm dòng hiển thị Android ID ---
// Kiểm tra xem `details` có chứa key "android_id" không
if (details["android_id"]) {
deviceInfoHTML += `<br><b>Android ID:</b> ${details["android_id"]}`;
}
// --- KẾT THÚC NÂNG CẤP ---
// Mật độ điểm ảnh có thể để cuối cùng hoặc không cần thiết tùy bạn
deviceInfoHTML += `<br><b>Mật độ điểm ảnh:</b> ${details["ro.sf.lcd_density"]} DPI`;
// Cập nhật giao diện
refs.deviceInfoDiv.innerHTML = deviceInfoHTML;
} catch (e) {
refs.deviceInfoDiv.textContent = 'Lỗi khi tải thông tin thiết bị.';
}
};
const updateSystemStats = async () => {
try {
const command = "dumpsys battery | grep -E 'level|temperature'";
const result = await SecureComms.exec(command);
if (result.errno !== 0) throw new Error(result.stderr || "Lệnh dumpsys thất bại");
let batteryLevel = 'N/A', temp = 'N/A';
const lines = result.stdout.trim().split('\n');
lines.forEach(line => {
const parts = line.split(':'); if (parts.length < 2) return;
const key = parts[0].trim(), value = parts[1].trim();
if (key === 'level') batteryLevel = value;
else if (key === 'temperature') temp = (parseInt(value, 10) / 10).toFixed(1);
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
console.error("Lỗi cập nhật CPU (có thể do quyền truy cập file):", e);
if (refs.cpuCoreGraphDiv.innerHTML === '') {
refs.cpuCoreGraphDiv.innerHTML = '<p style="font-size: 0.8em; color: var(--text-secondary); text-align: center;">Không thể đọc thông tin CPU.</p>';
}
}
};
const runDiagnostics = async () => {
refs.runDiagnosticsBtn.textContent = 'ĐANG PHÂN TÍCH...';
refs.runDiagnosticsBtn.disabled = true;
refs.suggestionContent.style.display = 'none';
refs.diagnosticActions.querySelector('.button.ai-action')?.remove();
try {
const tempResult = await SecureComms.exec("dumpsys battery | grep temperature");
const memResult = await SecureComms.exec('cat /proc/meminfo | grep MemTotal');
const temp = (parseInt(tempResult.stdout.split(':')[1].trim(), 10) / 10).toFixed(1);
const memGb = (parseInt(memResult.stdout.trim().split(/\s+/)[1], 10) / 1024 / 1024).toFixed(1);
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
const setupLogViewer = () => {
const daemonScripts = ['cuongche', 'giamlag'];
daemonScripts.forEach(scriptName => {
const option = document.createElement('option');
option.value = scriptName;
option.textContent = `Log: ${scriptName}.sh`;
refs.logSelector.appendChild(option);
});
const loadLogContent = async () => {
const selectedLog = refs.logSelector.value;
if (!selectedLog) {
refs.logViewerContent.innerHTML = '<p>Chưa chọn log nào để xem.</p>';
return;
}
refs.logViewerContent.textContent = 'Đang tải log...';
refs.refreshLogBtn.disabled = true;
try {
const result = await SecureComms.exec(`tail -n 100 /sdcard/TTP-WEB/logs/${selectedLog}.log`);
if (result.errno === 0 && result.stdout) {
refs.logViewerContent.textContent = result.stdout;
} else if (result.stderr && !result.stderr.includes("No such file")) {
refs.logViewerContent.textContent = `Lỗi khi đọc file log:\n${result.stderr}`;
} else {
refs.logViewerContent.textContent = 'File log trống hoặc chưa được tạo.';
}
} catch (error) {
refs.logViewerContent.textContent = `Lỗi nghiêm trọng khi tải log: ${error.message}`;
} finally {
refs.refreshLogBtn.disabled = false;
}
};
refs.refreshLogBtn.addEventListener('click', loadLogContent);
refs.logSelector.addEventListener('change', loadLogContent);
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
// TÌM VÀ THAY THẾ HÀM setupTabs
const setupTabs = () => {
const tabLinks = document.querySelectorAll('.tab-link');
// Bây giờ các panel chính là nội dung của tab
const tabContents = document.querySelectorAll('.tab-content.glass-panel');
tabLinks.forEach(link => {
link.addEventListener('click', () => {
if (link.classList.contains('active')) return;
// data-tab bây giờ trỏ đến ID của panel, ví dụ "panel-optimize"
const panelId = link.getAttribute('data-tab');
tabLinks.forEach(item => item.classList.remove('active'));
tabContents.forEach(item => item.classList.remove('active'));
link.classList.add('active');
const activePanel = document.getElementById(panelId);
if (activePanel) {
activePanel.classList.add('active');
}
link.scrollIntoView({
behavior: 'smooth',
block: 'nearest',
inline: 'center'
});
});
});
};
const setupScrollingTabs = () => {
const nav = document.querySelector('.tab-nav');
if (!nav) return;
const container = document.querySelector('.main-tabs-container');
const updateFades = () => {
// Kiểm tra xem có thể cuộn được không
const isScrollable = nav.scrollWidth > nav.clientWidth;
if (isScrollable) {
container.classList.add('is-scrollable'); // Thêm một class để CSS biết
} else {
container.classList.remove('is-scrollable');
}
};
// Gắn sự kiện để cập nhật khi có thay đổi
nav.addEventListener('scroll', updateFades);
window.addEventListener('resize', updateFades);
// Chạy lần đầu
// Dùng setTimeout để đảm bảo các nút đã được render xong
setTimeout(updateFades, 500);
};
// Thêm hàm này vào khu vực CORE FUNCTIONS trong script.js
// TÌM VÀ THAY THẾ TOÀN BỘ HÀM setupWebShell TRONG script.js
const setupWebShell = () => {
// Lấy các tham chiếu đến các phần tử HTML
const shellInput = document.getElementById('shell-input');
const shellOutput = document.getElementById('shell-output');
const shellPrompt = document.querySelector('.shell-prompt');
const shellSendBtn = document.getElementById('shell-send-btn');
// Nếu một trong các phần tử không tồn tại, thoát để tránh lỗi
if (!shellInput || !shellOutput || !shellPrompt || !shellSendBtn) return;
// State (Trạng thái) của Web Shell
const commandHistory = []; // Mảng để lưu lịch sử lệnh
let historyIndex = -1;     // Vị trí hiện tại trong lịch sử
// Hàm tiện ích để in văn bản ra màn hình terminal
const printToShell = (text, type = 'output') => {
const line = document.createElement('div');
if (type === 'prompt') {
line.className = 'prompt-line';
// Tái tạo lại dòng lệnh đã gõ
line.innerHTML = `<span style="color: var(--success-color);">${shellPrompt.textContent}</span> ${text}`;
} else if (type === 'error') {
line.className = 'error-line';
line.textContent = text;
} else {
line.textContent = text;
}
shellOutput.appendChild(line);
// Luôn tự động cuộn xuống dòng mới nhất
shellOutput.scrollTop = shellOutput.scrollHeight;
};
// Hàm cốt lõi để thực thi một lệnh
const executeShellCommand = async () => {
const command = shellInput.value.trim();
shellInput.value = ''; // Xóa nội dung ô input
shellInput.focus(); // Tự động focus lại vào ô input cho lệnh tiếp theo
if (!command) return; // Không làm gì nếu người dùng chỉ nhấn Enter
printToShell(command, 'prompt'); // In lại lệnh đã gõ
// Lưu vào lịch sử và reset con trỏ lịch sử
if (commandHistory[commandHistory.length - 1] !== command) {
commandHistory.push(command);
}
historyIndex = commandHistory.length;
try {
// Gửi lệnh đến server để thực thi
const result = await SecureComms.exec(command);
// In kết quả ra màn hình
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
// Gán sự kiện cho ô nhập liệu (bàn phím)
shellInput.addEventListener('keydown', (e) => {
if (e.key === 'Enter') {
e.preventDefault(); // Ngăn hành vi mặc định (như submit form)
executeShellCommand();
} else if (e.key === 'ArrowUp') {
e.preventDefault();
// Duyệt lùi trong lịch sử
if (historyIndex > 0) {
historyIndex--;
shellInput.value = commandHistory[historyIndex];
}
} else if (e.key === 'ArrowDown') {
e.preventDefault();
// Duyệt tiến trong lịch sử
if (historyIndex < commandHistory.length - 1) {
historyIndex++;
shellInput.value = commandHistory[historyIndex];
} else {
// Nếu đang ở cuối, xóa ô input
historyIndex = commandHistory.length;
shellInput.value = '';
}
}
});
// Gán sự kiện cho nút "Gửi"
shellSendBtn.addEventListener('click', executeShellCommand);
};
// --- APPLICATION LAUNCH ---
document.addEventListener('DOMContentLoaded', async () => {
if (!localStorage.getItem('ttp_key_info')) {
window.location.href = '/';
return;
}
console.log("✅ Phiên hợp lệ. Bắt đầu tải giao diện động.");
const keyInfo = JSON.parse(localStorage.getItem('ttp_key_info') || '{}');
refs.keyInfoDiv.innerHTML = `Chào mừng, <strong>${keyInfo.name || 'User'}</strong>!<br><span>HSD Key: ${keyInfo.expiry || 'N/A'}</span>`;
// Gán sự kiện cho các thành phần không động
refs.runDiagnosticsBtn.addEventListener('click', runDiagnostics);
setupChat();
setupLogViewer();
setupWebShell();
// Tải và "vẽ" các nút bấm động
await populateDynamicUI();
setupTabs();
setupScrollingTabs();
// Khởi chạy các tác vụ nền
fetchDeviceInfo();
updateSystemStats();
updateCpuGraph();
initParticles('particleCanvas', 'rgba(0, 255, 255, 0.5)', 'rgba(0, 255, 255, 0.1)');
setInterval(() => {
updateSystemStats();
updateCpuGraph();
}, 5000);
});