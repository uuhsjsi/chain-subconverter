// script.js

const MAX_MANUAL_PAIRS = 10; // 可以适当增加手动配对的上限
let actionButtons; 
let feedbackHistory = [];
const MAX_LOG_ENTRIES = 100; 
let logContainer; 
let toggleLogButton;

// 新增：获取服务根地址的辅助函数
function getServiceUrl() {
    const serviceUrlInput = document.getElementById('serviceUrl');
    const customizeServiceUrlCheckbox = document.getElementById('customizeServiceUrlSwitchInput');
    let finalServiceUrl = serviceUrlInput.value.trim().replace(/\/$/, '');

    if (customizeServiceUrlCheckbox && customizeServiceUrlCheckbox.checked && !finalServiceUrl) {
         showFeedback('错误：请输入自定义的服务根地址。', 'error', 5000);
         if(serviceUrlInput) serviceUrlInput.focus();
         return null;
    }
    if(customizeServiceUrlCheckbox && !customizeServiceUrlCheckbox.checked){
        try { // 确保在非自定义模式下，URL是最新的自动检测值
            const currentOrigin = window.location.origin;
            if (window.location.protocol.startsWith('http') && currentOrigin &&
                !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
                finalServiceUrl = currentOrigin;
            } else { finalServiceUrl = 'http://localhost:11200'; } // 与后端默认端口一致
        } catch(e){ finalServiceUrl = 'http://localhost:11200'; }
        if(serviceUrlInput) serviceUrlInput.value = finalServiceUrl;
    }
    return finalServiceUrl;
}


document.addEventListener('DOMContentLoaded', function() {
    const serviceUrlInput = document.getElementById('serviceUrl');
    const customizeServiceUrlCheckbox = document.getElementById('customizeServiceUrlSwitchInput');
    // const configModeSwitchInput = document.getElementById('configModeSwitchInput'); // 已移除
    const generateLinkButton = document.getElementById('generateLinkButton');
    const copyUrlButton = document.getElementById('copyUrlButton');
    const openUrlButton = document.getElementById('openUrlButton');
    const downloadConfigButton = document.getElementById('downloadConfigButton');
    const autoDetectButton = document.getElementById('autoDetectButton'); // 新增按钮

    logContainer = document.getElementById('logContainer');
    toggleLogButton = document.getElementById('toggleLogButton');

    // 服务URL初始化
    try {
        const currentOrigin = window.location.origin;
        if (window.location.protocol.startsWith('http') && currentOrigin &&
            !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
            serviceUrlInput.value = currentOrigin;
        } else {
            serviceUrlInput.value = 'http://localhost:11200';
        }
    } catch (e) {
        console.warn("无法自动填充服务URL:", e);
        serviceUrlInput.value = 'http://localhost:11200';
    }
    if (serviceUrlInput) serviceUrlInput.disabled = true;
    if (customizeServiceUrlCheckbox) customizeServiceUrlCheckbox.checked = false;

    actionButtons = [copyUrlButton, openUrlButton, downloadConfigButton];
    actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
    if(document.getElementById('generatedUrl')) document.getElementById('generatedUrl').value = '';

    // 移除 configModeSwitchInput 的事件监听器
    // if (configModeSwitchInput) {
    //     configModeSwitchInput.addEventListener('change', toggleConfigMode);
    // }

    if (customizeServiceUrlCheckbox) {
        customizeServiceUrlCheckbox.addEventListener('change', toggleServiceUrlInput);
    }
    if (generateLinkButton) { // "生成"按钮现在调用 validateConfigurationAndGenerateUrl
        generateLinkButton.addEventListener('click', validateConfigurationAndGenerateUrl);
    }
    if (autoDetectButton) { // 新增按钮的事件监听
        autoDetectButton.addEventListener('click', handleAutoDetectPairs);
    }
    if (copyUrlButton) {
        copyUrlButton.addEventListener('click', copyUrl);
    }
    if (openUrlButton) { // 修改 "打开" 按钮的逻辑
        openUrlButton.addEventListener('click', precheckAndOpenUrl);
    }
    if (downloadConfigButton) { // "下载" 按钮逻辑也可能需要微调以处理错误
        downloadConfigButton.addEventListener('click', downloadConfig);
    }

    if (toggleLogButton && logContainer) {
        toggleLogButton.addEventListener('click', function() {
            const isCurrentlyHidden = logContainer.classList.contains('hidden');
            if (isCurrentlyHidden) {
                logContainer.classList.remove('hidden');
                toggleLogButton.textContent = '▼'; 
                toggleLogButton.title = '隐藏详细日志';
                logContainer.scrollTop = logContainer.scrollHeight;
            } else {
                logContainer.classList.add('hidden');
                toggleLogButton.textContent = '▶'; 
                toggleLogButton.title = '显示详细日志';
            }
        });
    }

    renderManualPairRows(); // 初始化时渲染一次，确保至少有一行（如果为空）
    // toggleConfigMode(); // 已移除，节点对输入区域始终可见且可用
    updateManualPairControlsState(); // 确保控件状态正确
});

// --- 节点对行管理 (基本保持不变, 移除isAutoMode相关的禁用逻辑) ---
function createManualPairRowElement(index, landingValue = '', frontValue = '') {
    const newRow = document.createElement('div');
    newRow.className = 'manual-pair-dynamic-row';

    const landingInput = document.createElement('input');
    landingInput.type = 'text';
    landingInput.className = 'landing-proxy-input';
    landingInput.placeholder = '落地节点名称 (必填)';
    landingInput.value = landingValue;

    const frontInput = document.createElement('input');
    frontInput.type = 'text';
    frontInput.className = 'front-proxy-input';
    frontInput.placeholder = '前置节点/组名称 (必填)';
    frontInput.value = frontValue;

    const addIconSvg = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:1em;height:1em;display:block;margin:auto;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
    const removeIconSvg = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:1em;height:1em;display:block;margin:auto;"><path d="M19 13H5v-2h14v2z"/></svg>';

    newRow.innerHTML = `
        <span class="row-number-cell">${index + 1}.</span>
        <div class="input-cell"></div>
        <div class="dialer-proxy-label-cell">dialer-proxy:</div>
        <div class="input-cell"></div>
        <div class="actions-cell">
            <button type="button" class="action-button-inline add" title="在此行下方添加新行">${addIconSvg}</button>
            <button type="button" class="action-button-inline remove" title="删除此行">${removeIconSvg}</button>
        </div>
    `;
    newRow.querySelectorAll('.input-cell')[0].appendChild(landingInput);
    newRow.querySelectorAll('.input-cell')[1].appendChild(frontInput);

    newRow.querySelector('.action-button-inline.add').addEventListener('click', function() { addManualPairRow(newRow); });
    newRow.querySelector('.action-button-inline.remove').addEventListener('click', function() { removeManualPairRow(newRow); });
    
    return newRow;
}

function renderManualPairRows(initialPairsData = null) {
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container) return;
    container.innerHTML = ''; // 清空现有行

    let rowsData = initialPairsData; // 使用传入的数据，否则从DOM或默认值获取

    if (!rowsData) { // 如果没有传入数据，则尝试从DOM获取（例如页面刷新保留）或创建默认空行
        rowsData = getManualPairDataFromDOM();
        if (rowsData.length === 0) {
             rowsData = [{ landing: '', front: '' }]; // 默认至少显示一行空行
        }
    } else if (rowsData.length === 0) { // 如果传入空数组，也确保至少有一行
        rowsData = [{ landing: '', front: '' }];
    }


    rowsData.forEach((data, index) => {
        // data 可能来自 suggested_pairs ({"landing": ..., "front": ...})
        // 或来自 getManualPairDataFromDOM ({"landing": ..., "front": ...})
        container.appendChild(createManualPairRowElement(index, data.landing || '', data.front || ''));
    });
    updateManualPairControlsState();
}

function getManualPairDataFromDOM() {
    const rows = document.querySelectorAll('#manualPairsInputsContainer .manual-pair-dynamic-row');
    const data = [];
    rows.forEach(row => {
        const landingInput = row.querySelector('.landing-proxy-input');
        const frontInput = row.querySelector('.front-proxy-input');
        // 只添加有效填写的行到数据中，或者也收集空行用于判断？
        // 现在的做法是收集所有行，由调用者判断是否有效。
        data.push({
            landing: landingInput ? landingInput.value.trim() : '',
            front: frontInput ? frontInput.value.trim() : ''
        });
    });
    return data;
}

function addManualPairRow(callingRowElement) {
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container) return;
    const currentRows = container.querySelectorAll('.manual-pair-dynamic-row');

    if (currentRows.length >= MAX_MANUAL_PAIRS) {
        showFeedback(`最多只能添加 ${MAX_MANUAL_PAIRS} 对手动节点。`, 'info', 3000);
        return;
    }
    const newRow = createManualPairRowElement(currentRows.length); // 初始索引，会被 renumber 更新
    if (callingRowElement && callingRowElement.parentNode === container) {
        callingRowElement.after(newRow);
    } else {
        container.appendChild(newRow);
    }
    renumberRowsInDOM();
    updateManualPairControlsState();
}

function removeManualPairRow(rowElementToRemove) {
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container || !rowElementToRemove) return;
    
    const currentRows = container.querySelectorAll('.manual-pair-dynamic-row');
    if (currentRows.length <= 1) { // 始终保留至少一行
        showFeedback('至少需要保留一行配置。请直接清空内容。', 'info', 3000);
        const landingInput = rowElementToRemove.querySelector('.landing-proxy-input');
        const frontInput = rowElementToRemove.querySelector('.front-proxy-input');
        if(landingInput) landingInput.value = '';
        if(frontInput) frontInput.value = '';
        return;
    }

    rowElementToRemove.remove();
    renumberRowsInDOM();
    updateManualPairControlsState();
}

function renumberRowsInDOM() {
    const rows = document.querySelectorAll('#manualPairsInputsContainer .manual-pair-dynamic-row');
    rows.forEach((row, index) => {
        const rowNumberSpan = row.querySelector('.row-number-cell');
        if (rowNumberSpan) rowNumberSpan.textContent = `${index + 1}.`;
    });
}

function updateManualPairControlsState() { // 移除了 isAutoMode 的影响
    const rows = document.querySelectorAll('#manualPairsInputsContainer .manual-pair-dynamic-row');
    rows.forEach((row) => { // index不再需要
        const inputs = row.querySelectorAll('input[type="text"]');
        const addButton = row.querySelector('.action-button-inline.add');
        const removeButton = row.querySelector('.action-button-inline.remove');

        inputs.forEach(input => input.disabled = false); // 输入框始终启用
        if (addButton) {
            addButton.disabled = (rows.length >= MAX_MANUAL_PAIRS);
        }
        if (removeButton) {
            removeButton.disabled = (rows.length <= 1); // 如果是最后一行，则禁用删除
        }
    });

    const container = document.getElementById('manualPairsInputsContainer');
    if (container && rows.length === 0 && container.children.length === 0) { // 确保至少有一行
         renderManualPairRows(); 
    }
}

// toggleConfigMode 函数已不再需要，可以删除
// function toggleConfigMode() { ... }

function toggleServiceUrlInput() {
    const customizeCheckbox = document.getElementById('customizeServiceUrlSwitchInput');
    const serviceUrlInput = document.getElementById('serviceUrl');
    if(!customizeCheckbox || !serviceUrlInput) return;

    serviceUrlInput.disabled = !customizeCheckbox.checked;
    if (customizeCheckbox.checked) {
        serviceUrlInput.focus();
    } else {
        try {
            const currentOrigin = window.location.origin;
            if (window.location.protocol.startsWith('http') && currentOrigin &&
                !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
                serviceUrlInput.value = currentOrigin;
            } else { serviceUrlInput.value = 'http://localhost:11200'; }
        } catch(e){ serviceUrlInput.value = 'http://localhost:11200'; }
    }
}

function validateInputs() { // 只校验 remoteUrl
    const remoteUrlInput = document.getElementById('remoteUrl');
    if (!remoteUrlInput || !remoteUrlInput.value.trim()) {
        const errorMessage = '请输入有效的原始订阅链接。';
        showFeedback(errorMessage, 'error', 5000); 
        if(remoteUrlInput) remoteUrlInput.focus();
        return false;
    }
    return true;
}

// --- 日志和反馈 (基本保持不变) ---
function showFeedback(message, type = 'info', duration = 0) {
    const feedbackElement = document.getElementById('feedbackMessage');
    if (!feedbackElement) return;

    feedbackElement.textContent = message;
    feedbackElement.className = 'feedback-message';
    feedbackElement.classList.add(`feedback-${type}`);

    if (feedbackElement.timeoutId) clearTimeout(feedbackElement.timeoutId);

    const isDefaultMessage = type === 'info' && message === '等待操作...';
    
    // 将所有非默认的、或不是纯粹由后端日志填充的消息（如果做了区分）加入历史
    // 简单起见，所有showFeedback调用的主消息都加入历史，除了初始的"等待操作"
    if (!isDefaultMessage) {
        const timestamp = new Date();
        const formattedTimestamp = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;
        feedbackHistory.push({ timestamp: formattedTimestamp, type: type, message: message });
        if (feedbackHistory.length > MAX_LOG_ENTRIES) {
            feedbackHistory.shift(); 
        }
        renderLogs(); 
    }

    if (duration > 0 && !isDefaultMessage) {
        feedbackElement.timeoutId = setTimeout(() => {
            if (feedbackElement.textContent === message) {
                feedbackElement.textContent = '等待操作...';
                feedbackElement.className = 'feedback-message feedback-info';
            }
        }, duration);
    }
}

function renderLogs() {
    if (!logContainer) return;
    logContainer.innerHTML = ''; 

    if (feedbackHistory.length === 0) {
        const noLogsEntry = document.createElement('p');
        noLogsEntry.textContent = '暂无详细日志。';
        noLogsEntry.style.color = '#6c757d';
        logContainer.appendChild(noLogsEntry);
        return;
    }

    feedbackHistory.forEach(logEntry => {
        const logElement = document.createElement('div');
        logElement.style.marginBottom = '5px';
        logElement.style.paddingBottom = '5px';
        logElement.style.borderBottom = '1px dashed #eee';

        const timestampSpan = document.createElement('span');
        timestampSpan.textContent = `[${logEntry.timestamp}] `;
        timestampSpan.style.fontWeight = 'bold';
        const typeToColor = { 'error': '#dc3545', 'success': '#28a745', 'warn': '#ffc107', 'info': '#007bff', 'debug': '#6c757d'};
        timestampSpan.style.color = typeToColor[logEntry.type] || typeToColor['debug'];

        const messageSpan = document.createElement('span');
        messageSpan.textContent = logEntry.message;
        if (logEntry.type === 'error') messageSpan.style.color = typeToColor['error'];
        // 可以为其他类型也设置特定颜色，如果需要

        logElement.appendChild(timestampSpan);
        logElement.appendChild(messageSpan);
        logContainer.appendChild(logElement);
    });

    if (!logContainer.classList.contains('hidden')) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

// --- 新增：自动识别节点对的处理函数 ---
async function handleAutoDetectPairs() {
    if (!validateInputs()) return; // 校验原始订阅链接

    const remoteUrlInput = document.getElementById('remoteUrl');
    const remoteUrl = remoteUrlInput.value.trim();
    const serviceUrl = getServiceUrl();
    if (!serviceUrl) return;

    showFeedback('正在自动识别节点对...', 'info', 0);
    actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
    document.getElementById('generateLinkButton').disabled = true; // 禁用生成按钮
    document.getElementById('autoDetectButton').disabled = true;  // 禁用自身

    try {
        const apiEndpoint = `${serviceUrl}/api/auto_detect_pairs?remote_url=${encodeURIComponent(remoteUrl)}`;
        const response = await fetch(apiEndpoint);
        const responseData = await response.json();

        // 处理后端日志
        if (responseData.logs && Array.isArray(responseData.logs)) {
            responseData.logs.forEach(log => {
                const fTimestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
                feedbackHistory.push({
                    timestamp: fTimestamp,
                    type: log.level ? log.level.toLowerCase() : 'debug',
                    message: log.message
                });
            });
            if (feedbackHistory.length > MAX_LOG_ENTRIES) {
                 feedbackHistory.splice(0, feedbackHistory.length - MAX_LOG_ENTRIES);
            }
            renderLogs(); // 更新日志显示
        }

        showFeedback(responseData.message || '自动识别完成。', responseData.success ? 'success' : 'error', 5000);

        if (responseData.success && responseData.suggested_pairs) {
            // 使用识别到的节点对填充输入框
            populatePairRows(responseData.suggested_pairs);
        } else if (!responseData.success) {
            // 如果识别失败，但之前有手动填写的行，保留它们，或者清空？当前选择保留。
            // 可以考虑如果suggested_pairs为空但也success，则清空或加一个空行
            if (!responseData.suggested_pairs || responseData.suggested_pairs.length === 0) {
                // renderManualPairRows(); // 确保至少有一行，如果需要清空的话
            }
        }

    } catch (error) {
        showFeedback(`自动识别请求失败: ${error.message}`, 'error', 7000);
        console.error('自动识别请求失败:', error);
        renderLogs(); // 即使出错，也刷新日志 (可能包含旧日志和新错误)
    } finally {
        document.getElementById('generateLinkButton').disabled = false;
        document.getElementById('autoDetectButton').disabled = false;
    }
}

function populatePairRows(pairsData) {
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container) return;
    container.innerHTML = ''; // 清空现有行

    if (!pairsData || pairsData.length === 0) {
        showFeedback('未自动识别到任何节点对，或识别结果为空。请检查订阅内容或手动添加。', 'info', 4000);
        renderManualPairRows(); // 渲染一个空的默认行
        return;
    }

    pairsData.forEach((pair, index) => {
        if (container.children.length < MAX_MANUAL_PAIRS) {
            container.appendChild(createManualPairRowElement(index, pair.landing, pair.front));
        } else if (index === MAX_MANUAL_PAIRS) { // 只提示一次
             showFeedback(`自动识别到超过 ${MAX_MANUAL_PAIRS} 对节点，仅显示前 ${MAX_MANUAL_PAIRS} 对。`, 'warn', 5000);
        }
    });
    renumberRowsInDOM();
    updateManualPairControlsState();
}


// --- 修改后的 "生成" 按钮逻辑 ---
function convertPairsToQueryString(pairsList) {
    // pairsList 是 [{landing: "L1", front: "F1"}, ...]
    // 需要转换为 "L1:F1,L2:F2"
    if (!pairsList || pairsList.length === 0) return "";
    return pairsList
        .filter(p => p.landing && p.front) // 只包含有效填写的对
        .map(p => `${p.landing.trim()}:${p.front.trim()}`)
        .join(',');
}

async function validateConfigurationAndGenerateUrl() {
    showFeedback('正在验证配置并生成链接...', 'info', 0);
    const generateBtn = document.getElementById('generateLinkButton');
    const autoDetectBtn = document.getElementById('autoDetectButton');
    if(generateBtn) generateBtn.disabled = true;
    if(autoDetectBtn) autoDetectBtn.disabled = true;


    const generatedUrlInput = document.getElementById('generatedUrl');
    actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
    if(generatedUrlInput) generatedUrlInput.value = '';

    if (!validateInputs()) { // 只校验原始订阅链接是否填写
        if(generateBtn) generateBtn.disabled = false;
        if(autoDetectBtn) autoDetectBtn.disabled = false;
        return;
    }

    const remoteUrlInput = document.getElementById('remoteUrl');
    const remoteUrl = remoteUrlInput.value.trim();
    const serviceUrl = getServiceUrl();
    if (!serviceUrl) {
        if(generateBtn) generateBtn.disabled = false;
        if(autoDetectBtn) autoDetectBtn.disabled = false;
        return;
    }

    const nodePairsFromDOM = getManualPairDataFromDOM();
    // 过滤掉 landing 和 front 都为空的无效行，但如果用户就是想提交空节点对（理论上不应该）
    const validNodePairs = nodePairsFromDOM.filter(p => p.landing.trim() || p.front.trim());
    
    // 如果存在节点对行，但有不完整的对（一个填了另一个没填），则报错
    let hasIncompletePair = false;
    if (validNodePairs.length > 0) {
        hasIncompletePair = validNodePairs.some(p => (p.landing.trim() && !p.front.trim()) || (!p.landing.trim() && p.front.trim()));
    }

    if (hasIncompletePair) {
        showFeedback('节点对配置中存在未完整填写的行，请检查。', 'error', 5000);
        if(generateBtn) generateBtn.disabled = false;
        if(autoDetectBtn) autoDetectBtn.disabled = false;
        return;
    }
    
    // 实际发送给后端的节点对列表 (只包含 landing 和 front 都有值的)
    const nodePairsToSend = validNodePairs.filter(p => p.landing.trim() && p.front.trim());


    try {
        const apiEndpoint = `${serviceUrl}/api/validate_configuration`;
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                remote_url: remoteUrl,
                node_pairs: nodePairsToSend // 发送[{landing:"", front:""},...]格式
            })
        });
        const responseData = await response.json();

        if (responseData.logs && Array.isArray(responseData.logs)) {
            responseData.logs.forEach(log => {
                const fTimestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
                feedbackHistory.push({ timestamp: fTimestamp, type: log.level ? log.level.toLowerCase() : 'debug', message: log.message });
            });
            if (feedbackHistory.length > MAX_LOG_ENTRIES) {
                 feedbackHistory.splice(0, feedbackHistory.length - MAX_LOG_ENTRIES);
            }
            renderLogs();
        }

        showFeedback(responseData.message || '验证完成。', responseData.success ? 'success' : 'error', 7000);

        if (responseData.success) {
            // 验证成功，前端组装 /subscription.yaml 的链接
            let subscriptionUrl = `${serviceUrl}/subscription.yaml?remote_url=${encodeURIComponent(remoteUrl)}`;
            if (nodePairsToSend.length > 0) {
                const pairsQueryString = convertPairsToQueryString(nodePairsToSend); // 转换为 L1:F1,L2:F2 格式
                subscriptionUrl += `&manual_pairs=${encodeURIComponent(pairsQueryString)}`;
            }
            if(generatedUrlInput) generatedUrlInput.value = subscriptionUrl;
            actionButtons.forEach(btn => { if(btn) btn.disabled = false; });
        } else {
            actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
            if(generatedUrlInput) generatedUrlInput.value = '';
        }

    } catch (error) {
        actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
        if(generatedUrlInput) generatedUrlInput.value = '';
        showFeedback(`验证配置请求失败: ${error.message}`, 'error', 7000);
        console.error('验证配置请求失败:', error);
        renderLogs();
    } finally {
        if(generateBtn) generateBtn.disabled = false;
        if(autoDetectBtn) autoDetectBtn.disabled = false;
    }
}

// --- "复制", "打开", "下载" 按钮的辅助函数 ---
function copyUrl() {
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('没有可复制的链接。', 'info', 3000); return;
    }
    const textToCopy = generatedUrlInput.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showFeedback('链接已复制到剪贴板！ (安全模式)', 'success', 3000);
        }).catch(err => attemptLegacyCopy(textToCopy) );
    } else {
        attemptLegacyCopy(textToCopy);
    }
}

function attemptLegacyCopy(textToCopy) {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed"; textArea.style.top = "-9999px"; textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try {
        if (document.execCommand('copy')) {
            showFeedback('链接已复制到剪贴板！ (备用模式)', 'success', 3000);
        } else {
            showFeedback('复制失败。请手动复制。', 'error', 5000);
        }
    } catch (err) {
        showFeedback('复制出错，请手动复制。', 'error', 5000);
    }
    document.body.removeChild(textArea);
}

async function precheckAndOpenUrl() { // 修改 openUrl
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('没有可打开的链接。', 'info', 3000); return;
    }
    const urlToOpen = generatedUrlInput.value;
    showFeedback('正在预检链接...', 'info', 0);
    try {
        // 使用 HEAD 请求尝试预检，减少数据传输。如果服务器不支持 HEAD 或CORS策略严格，可能需要用GET。
        // 对于同源请求，CORS不是问题。对于跨域，如果服务器允许简单请求，HEAD可能可以。
        // 为简单起见，如果此服务总是同源或允许GET，可以直接用GET。
        // 但考虑到 /subscription.yaml 是获取实际配置，用GET预检会下载一次。
        // 实际应用中，如果URL是最终客户端使用的，直接打开可能更符合用户习惯，错误由客户端自行处理。
        // 此处，我们假设 "打开" 是为了预览，所以预检一下是有意义的。
        const response = await fetch(urlToOpen, { method: 'HEAD', mode: 'no-cors' }); // 'no-cors'下无法读取status,但能判断网络是否可达
        
        // 'no-cors' 模式下，response.ok 和 response.status 通常不可靠 (会是0或false)。
        // 这种预检方式主要用于判断网络层面是否可达，或是否有立即的重定向（虽然也看不到目标）。
        // 对于更准确的检查，需要服务器支持CORS的HEAD请求，或者直接尝试GET并处理内容。
        // 由于我们期望此URL返回YAML，直接打开可能更好。
        // 此处的预检逻辑简化为直接打开，如果需要更强的预检，这里的 fetch 需要更复杂的处理。

        // 简化：直接打开，如果该URL返回错误，用户会在新标签页看到。
        window.open(urlToOpen, '_blank');
        showFeedback('正在尝试打开链接... (若长时间无响应，请检查链接有效性)', 'info', 3000);

    } catch (error) { // 这个catch主要捕获fetch本身的网络错误，对no-cors的HEAD可能用处不大
        showFeedback(`预检链接失败: ${error.message}。将直接尝试打开。`, 'warn', 5000);
        window.open(urlToOpen, '_blank'); // 即使预检失败，也尝试打开
    }
}


async function downloadConfig() {
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('没有可下载的链接。', 'error', 3000); return;
    }
    const urlToFetch = generatedUrlInput.value;
    showFeedback('正在准备下载配置文件...', 'info', 0);
    try {
        const response = await fetch(urlToFetch);
        if (!response.ok) { // 捕获HTTP错误状态，例如404, 500, 502等
            const errorText = await response.text(); // 尝试读取错误响应体
            showFeedback(`下载失败 (HTTP ${response.status}): ${errorText.substring(0, 200)}`, 'error', 7000);
            console.error(`下载失败: ${response.status} ${response.statusText}`, errorText);
            return;
        }
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition');
        let fileName = "chain_subscription.yaml"; // 默认文件名

        if (disposition && disposition.includes('filename=')) {
            const filenameMatch = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']+)['"]?/i);
            if (filenameMatch && filenameMatch[1]) {
                fileName = decodeURIComponent(filenameMatch[1]);
            }
        } else { // 尝试从URL路径获取文件名
            try {
                const pathName = new URL(urlToFetch).pathname;
                const lastSegment = pathName.substring(pathName.lastIndexOf('/') + 1);
                if (lastSegment && (lastSegment.endsWith('.yaml') || lastSegment.endsWith('.yml'))) {
                    fileName = lastSegment;
                }
            } catch (e) { /* 忽略URL解析或路径提取错误 */ }
        }


        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showFeedback('配置文件下载成功！', 'success', 5000);
    } catch (error) { // 捕获fetch网络错误或上面抛出的Error
        console.error('下载配置文件时出错:', error);
        showFeedback(`下载配置文件出错: ${error.message}`, 'error', 7000);
    }
}