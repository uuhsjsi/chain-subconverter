// script.js (V3 - 与新API和HTML结构对齐)

const MAX_MANUAL_PAIRS = 10; 
let actionButtons; 
let feedbackHistory = [];
const MAX_LOG_ENTRIES = 100; 
let logContainer; 
let toggleLogButton;

// 获取服务根地址的辅助函数 (与您版本一致)
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
        try { 
            const currentOrigin = window.location.origin;
            if (window.location.protocol.startsWith('http') && currentOrigin &&
                !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
                finalServiceUrl = currentOrigin;
            } else { finalServiceUrl = 'http://localhost:11200'; } 
        } catch(e){ finalServiceUrl = 'http://localhost:11200'; }
        if(serviceUrlInput) serviceUrlInput.value = finalServiceUrl;
    }
    return finalServiceUrl;
}

document.addEventListener('DOMContentLoaded', function() {
    const serviceUrlInput = document.getElementById('serviceUrl');
    const customizeServiceUrlCheckbox = document.getElementById('customizeServiceUrlSwitchInput');
    const generateLinkButton = document.getElementById('generateLinkButton');
    const copyUrlButton = document.getElementById('copyUrlButton');
    const openUrlButton = document.getElementById('openUrlButton');
    const downloadConfigButton = document.getElementById('downloadConfigButton');
    const autoDetectButton = document.getElementById('autoDetectButton'); 

    const feedbackAreaContainer = document.getElementById('feedbackAreaContainer'); // Get the container
    logContainer = document.getElementById('logContainer');
    toggleLogButton = document.getElementById('toggleLogButton');

    const serviceAddressGroup = document.getElementById('serviceAddressGroup'); // 获取区块
    const toggleServiceAddressConfigButton = document.getElementById('toggleServiceAddressConfigButton'); // 获取新的触发按钮


    // 服务URL初始化 (与您版本一致)
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

    if (customizeServiceUrlCheckbox) {
        customizeServiceUrlCheckbox.addEventListener('change', toggleServiceUrlInput);
    }

    // 新增：控制整个服务地址配置区块的显示/隐藏
    if (toggleServiceAddressConfigButton && serviceAddressGroup) {
        toggleServiceAddressConfigButton.addEventListener('click', function() {
            const isHidden = serviceAddressGroup.classList.contains('hidden');
            if (isHidden) {
                serviceAddressGroup.classList.remove('hidden');
                // toggleServiceAddressConfigButton.textContent = '⚙️';
            } else {
                serviceAddressGroup.classList.add('hidden');
                // toggleServiceAddressConfigButton.textContent = '⚙️';
            }
        });
    }

    if (generateLinkButton) { 
        generateLinkButton.addEventListener('click', validateConfigurationAndGenerateUrl); // 更新事件处理
    }
    if (autoDetectButton) { 
        autoDetectButton.addEventListener('click', handleAutoDetectPairs);
    }
    if (copyUrlButton) {
        copyUrlButton.addEventListener('click', copyUrl);
    }
    if (openUrlButton) { 
        openUrlButton.addEventListener('click', precheckAndOpenUrl);
    }
    if (downloadConfigButton) { 
        downloadConfigButton.addEventListener('click', downloadConfig);
    }

    // if (toggleLogButton && logContainer) {
    //     toggleLogButton.addEventListener('click', function() {
    //         const isCurrentlyHidden = logContainer.classList.contains('hidden');
    //         if (isCurrentlyHidden) {
    //             logContainer.classList.remove('hidden');
    //             toggleLogButton.textContent = '▼'; 
    //             toggleLogButton.title = '隐藏详细日志';
    //             logContainer.scrollTop = logContainer.scrollHeight;
    //         } else {
    //             logContainer.classList.add('hidden');
    //             toggleLogButton.textContent = '▶'; 
    //             toggleLogButton.title = '显示详细日志';
    //         }
    //     });
    // }

    // --- 日志切换逻辑 ---
    if (feedbackAreaContainer && logContainer && toggleLogButton) { //
        const performLogToggle = function() {
            const isCurrentlyHidden = logContainer.classList.contains('hidden'); //
            if (isCurrentlyHidden) {
                logContainer.classList.remove('hidden'); //
                toggleLogButton.textContent = '▼'; //
                toggleLogButton.title = '隐藏详细日志'; //
                if (logContainer.children.length > 0) {
                    logContainer.scrollTop = logContainer.scrollHeight; //
                }
            } else {
                logContainer.classList.add('hidden'); //
                toggleLogButton.textContent = '▶'; //
                toggleLogButton.title = '显示详细日志'; //
            }
        };

        feedbackAreaContainer.addEventListener('click', performLogToggle); //
        feedbackAreaContainer.style.cursor = 'pointer'; //
        feedbackAreaContainer.title = '点击显示/隐藏详细日志'; //

        // 移除之前直接给 toggleLogButton 单独添加的监听器，
        // 因为 feedbackAreaContainer 的监听器已经覆盖了它的功能。
        // 如果 toggleLogButton 之前有独立的事件监听器代码块，请删除或注释掉它。
        // 你提供的代码中，旧的 toggleLogButton 监听器似乎已被新的 feedbackAreaContainer 监听器取代，
        // 但要确保没有其他地方重复绑定。
    }

    renderManualPairRows(); 
    updateManualPairControlsState(); 
});

// --- 节点对行管理 (与您版本基本一致，仅确保与新流程兼容) ---
function createManualPairRowElement(index, landingValue = '', frontValue = '') {
    const newRow = document.createElement('div');
    newRow.className = 'manual-pair-dynamic-row';

    const landingInput = document.createElement('input');
    landingInput.type = 'text';
    landingInput.className = 'landing-proxy-input';
    landingInput.placeholder = '落地节点名称 (必填)'; // 更新 placeholder
    landingInput.value = landingValue;

    const frontInput = document.createElement('input');
    frontInput.type = 'text';
    frontInput.className = 'front-proxy-input';
    frontInput.placeholder = '前置节点/组名称 (必填)'; // 更新 placeholder
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
    container.innerHTML = ''; 

    let rowsData = initialPairsData; 

    if (!rowsData) { 
        rowsData = getManualPairDataFromDOM();
        if (rowsData.length === 0) {
             rowsData = [{ landing: '', front: '' }]; 
        }
    } else if (rowsData.length === 0) { 
        rowsData = [{ landing: '', front: '' }];
    }

    rowsData.forEach((data, index) => {
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
    const newRow = createManualPairRowElement(currentRows.length); 
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
    if (currentRows.length <= 1) { 
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

function updateManualPairControlsState() { 
    const rows = document.querySelectorAll('#manualPairsInputsContainer .manual-pair-dynamic-row');
    rows.forEach((row) => { 
        const inputs = row.querySelectorAll('input[type="text"]');
        const addButton = row.querySelector('.action-button-inline.add');
        const removeButton = row.querySelector('.action-button-inline.remove');

        inputs.forEach(input => input.disabled = false); 
        if (addButton) {
            addButton.disabled = (rows.length >= MAX_MANUAL_PAIRS);
        }
        if (removeButton) {
            removeButton.disabled = (rows.length <= 1); 
        }
    });

    const container = document.getElementById('manualPairsInputsContainer');
    if (container && rows.length === 0 && container.children.length === 0) { 
         renderManualPairRows(); 
    }
}

function toggleServiceUrlInput() {
    const customizeCheckbox = document.getElementById('customizeServiceUrlSwitchInput');
    const serviceUrlInput = document.getElementById('serviceUrl');
    if (!customizeCheckbox || !serviceUrlInput) return;

    serviceUrlInput.disabled = !customizeCheckbox.checked;
    if (customizeCheckbox.checked) {
        serviceUrlInput.focus();
    } else {
        // 如果取消自定义，恢复默认值
        try {
            const currentOrigin = window.location.origin;
            if (window.location.protocol.startsWith('http') && currentOrigin &&
                !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
                serviceUrlInput.value = currentOrigin;
            } else { serviceUrlInput.value = 'http://localhost:11200'; }
        } catch(e){ serviceUrlInput.value = 'http://localhost:11200'; }
    }
}

function validateInputs() { // 只校验 remoteUrl, 与您版本一致
    const remoteUrlInput = document.getElementById('remoteUrl');
    if (!remoteUrlInput || !remoteUrlInput.value.trim()) {
        const errorMessage = '请输入有效的原始订阅链接。';
        showFeedback(errorMessage, 'error', 5000); 
        if(remoteUrlInput) remoteUrlInput.focus();
        return false;
    }
    return true;
}

// --- 日志和反馈 ---
function showFeedback(message, type = 'info', duration = 0) {
    const feedbackTextElement = document.getElementById('feedbackMessage');
    const feedbackContainerElement = document.getElementById('feedbackAreaContainer');

    if (!feedbackTextElement || !feedbackContainerElement) return;

    let displayMessage = message;
    // （你之前关于缩短 displayMessage 的逻辑）
    if (message.length > 70 || message.toLowerCase().includes('http://') || message.toLowerCase().includes('https://')) {
        if (type === 'error') {
            displayMessage = '发生错误。详情请查看日志。';
        } else if (type === 'success' && !(message.startsWith("链接已复制") || message.startsWith("配置文件下载成功"))) {
            displayMessage = '操作成功。详情请查看日志。';
        } else if (type === 'info' && message !== '等待操作...') {
             displayMessage = '操作已记录。详情请查看日志。';
        }
    }
    feedbackTextElement.textContent = displayMessage;

    // 清除旧的类型class，并应用新的
    const typeToClass = { // 确保 typeToClass 在这里定义或可访问
        'success': 'feedback-success',
        'error': 'feedback-error',
        'info': 'feedback-info',
        'warn': 'feedback-warn',
        'debug': 'feedback-info' // debug 也用 info 的样式
    };
    // 移除所有可能的类型类
    Object.values(typeToClass).forEach(cls => feedbackContainerElement.classList.remove(cls));
    // 添加当前类型类
    feedbackContainerElement.classList.add(typeToClass[type] || 'feedback-info');


    if (feedbackContainerElement.timeoutId) {
        clearTimeout(feedbackContainerElement.timeoutId);
    }

    const isDefaultMessage = type === 'info' && message === '等待操作...';

    if (!isDefaultMessage) {
        const timestamp = new Date(); // 定义 timestamp
        // 定义 formattedTimestamp
        const formattedTimestamp = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;
        
        // 定义 logEntryType
        let logEntryType = type.toLowerCase(); // 使用小写type作为基础
        if (!typeToClass[logEntryType]) { // 如果类型不在预设中，默认为debug或info
            logEntryType = (logEntryType === 'debug' || logEntryType === 'trace') ? 'debug' : 'info';
        }

        feedbackHistory.push({ timestamp: formattedTimestamp, type: logEntryType, message: message }); // 使用原始 message 记录日志
        if (feedbackHistory.length > MAX_LOG_ENTRIES) {
            feedbackHistory.shift();
        }
        renderLogs();
    }

    if (duration > 0 && !isDefaultMessage) {
        feedbackContainerElement.timeoutId = setTimeout(() => {
            if (feedbackTextElement.textContent === displayMessage && feedbackContainerElement.classList.contains(typeToClass[type])) {
                feedbackTextElement.textContent = '等待操作...';
                // 恢复到默认info样式
                Object.values(typeToClass).forEach(cls => feedbackContainerElement.classList.remove(cls));
                feedbackContainerElement.classList.add('feedback-info');
            }
        }, duration);
    }
}

function renderLogs() {
    if (!logContainer) return;
    logContainer.innerHTML = '';

    // 在函数内部定义 typeToColor
    const typeToColor = {
        'error':   '#c53030', // .feedback-error color in CSS
        'success': '#2f855a', // .feedback-success color in CSS
        'warn':    '#856404', // .feedback-warn color in CSS
        'info':    '#0288d1', // .feedback-info color in CSS (adjusted from #2b6cb0 to match your CSS)
        'debug':   '#4a5568'  // A neutral dark gray for debug
    };

    if (feedbackHistory.length === 0) {
        const noLogsEntry = document.createElement('p');
        noLogsEntry.textContent = '暂无详细日志。';
        noLogsEntry.style.color = '#718096';
        logContainer.appendChild(noLogsEntry);
        return;
    }

    feedbackHistory.forEach(logEntry => { // 此处是之前报错的 forEach
        const logElement = document.createElement('div');
        logElement.style.marginBottom = '5px';
        logElement.style.paddingBottom = '5px';
        logElement.style.borderBottom = '1px dashed #e2e8f0';

        const timestampSpan = document.createElement('span');
        timestampSpan.textContent = `[${logEntry.timestamp}] `;
        timestampSpan.style.fontWeight = 'bold';
        
        const effectiveType = logEntry.type.toLowerCase();
        // 现在 typeToColor 在此作用域内是已定义的
        timestampSpan.style.color = typeToColor[effectiveType] || typeToColor['debug'];

        const messageSpan = document.createElement('span');
        messageSpan.textContent = logEntry.message;
        messageSpan.classList.add('log-message-content'); // 确保应用了换行样式

        if (effectiveType === 'error' || effectiveType === 'warn') {
             messageSpan.style.color = typeToColor[effectiveType];
        } else {
            messageSpan.style.color = '#2d3748'; // 默认日志消息颜色
        }

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
    if (!validateInputs()) return; 

    const remoteUrlInput = document.getElementById('remoteUrl');
    const remoteUrl = remoteUrlInput.value.trim();
    const serviceUrl = getServiceUrl();
    if (!serviceUrl) return;

    showFeedback('正在自动识别节点对...', 'info', 0);
    actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
    if(document.getElementById('generateLinkButton')) document.getElementById('generateLinkButton').disabled = true; 
    if(document.getElementById('autoDetectButton')) document.getElementById('autoDetectButton').disabled = true;  

    try {
        const apiEndpoint = `${serviceUrl}/api/auto_detect_pairs?remote_url=${encodeURIComponent(remoteUrl)}`;
        const response = await fetch(apiEndpoint);
        const responseData = await response.json();

        if (responseData.logs && Array.isArray(responseData.logs)) {
            responseData.logs.forEach(log => {
                const fTimestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour12: false }) : new Date().toLocaleTimeString([], { hour12: false });
                feedbackHistory.push({
                    timestamp: fTimestamp,
                    type: log.level ? log.level.toLowerCase() : 'debug',
                    message: log.message
                });
            });
            if (feedbackHistory.length > MAX_LOG_ENTRIES) {
                 feedbackHistory.splice(0, feedbackHistory.length - MAX_LOG_ENTRIES);
            }
            // renderLogs(); // showFeedback会调用renderLogs，这里可能重复，但问题不大
        }

        showFeedback(responseData.message || '自动识别完成。', responseData.success ? 'success' : 'error', 5000);

        if (responseData.success && responseData.suggested_pairs) {
            populatePairRows(responseData.suggested_pairs);
        } else if (!responseData.success && (!responseData.suggested_pairs || responseData.suggested_pairs.length === 0)) {
            // 如果识别失败且没有建议对，则清空现有行并显示一个空行
            populatePairRows([]); 
        }
        // 如果 responseData.success 为 true 但 suggested_pairs 为空，populatePairRows 会处理

    } catch (error) {
        showFeedback(`自动识别请求失败: ${error.message}`, 'error', 7000);
        console.error('自动识别请求失败:', error);
    } finally {
        if(document.getElementById('generateLinkButton')) document.getElementById('generateLinkButton').disabled = false;
        if(document.getElementById('autoDetectButton')) document.getElementById('autoDetectButton').disabled = false;
        renderLogs(); // 确保所有日志（包括 try/catch 中的）都刷新
    }
}

function populatePairRows(pairsData) {
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container) return;
    container.innerHTML = ''; 

    if (!pairsData || pairsData.length === 0) {
        // showFeedback 已由调用方处理，这里只负责渲染行
        renderManualPairRows(); 
        return;
    }

    pairsData.forEach((pair, index) => {
        if (container.children.length < MAX_MANUAL_PAIRS) {
            container.appendChild(createManualPairRowElement(index, pair.landing, pair.front));
        } else if (index === MAX_MANUAL_PAIRS) { 
             showFeedback(`自动识别到超过 ${MAX_MANUAL_PAIRS} 对节点，仅显示前 ${MAX_MANUAL_PAIRS} 对。`, 'warn', 5000);
        }
    });
    if(container.children.length === 0) { // 如果所有识别的对都超限了，确保至少有一行
        renderManualPairRows();
    }
    renumberRowsInDOM();
    updateManualPairControlsState();
}

// --- 修改后的 "生成" 按钮逻辑 ---
function convertPairsToQueryString(pairsList) {
    if (!pairsList || pairsList.length === 0) return "";
    return pairsList
        .filter(p => p.landing && p.landing.trim() && p.front && p.front.trim()) 
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

    if (!validateInputs()) { 
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
    const validNodePairsForCheck = nodePairsFromDOM.filter(p => p.landing.trim() || p.front.trim());
    
    let hasIncompletePair = false;
    if (validNodePairsForCheck.length > 0) {
        hasIncompletePair = validNodePairsForCheck.some(p => (p.landing.trim() && !p.front.trim()) || (!p.landing.trim() && p.front.trim()));
    }

    if (hasIncompletePair) {
        showFeedback('节点对配置中存在未完整填写的行，请检查。', 'error', 5000);
        if(generateBtn) generateBtn.disabled = false;
        if(autoDetectBtn) autoDetectBtn.disabled = false;
        return;
    }
    
    const nodePairsToSend = nodePairsFromDOM.filter(p => p.landing.trim() && p.front.trim());

    // 2. After checking for incomplete pairs, ensure at least one complete pair is present
    //    (Since the UI always has at least one row, this means pairs are effectively mandatory)
    if (nodePairsToSend.length === 0) {
        showFeedback('错误：请至少配置并提交一对完整的节点对。', 'error', 6000);
        if(generateBtn) generateBtn.disabled = false;
        if(autoDetectBtn) autoDetectBtn.disabled = false;
        return;
    }

    try {
        const apiEndpoint = `${serviceUrl}/api/validate_configuration`;
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                remote_url: remoteUrl,
                node_pairs: nodePairsToSend 
            })
        });
        const responseData = await response.json();

        if (responseData.logs && Array.isArray(responseData.logs)) {
            responseData.logs.forEach(log => {
                const fTimestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour12: false }) : new Date().toLocaleTimeString([], { hour12: false });
                feedbackHistory.push({ timestamp: fTimestamp, type: log.level ? log.level.toLowerCase() : 'debug', message: log.message });
            });
            if (feedbackHistory.length > MAX_LOG_ENTRIES) {
                 feedbackHistory.splice(0, feedbackHistory.length - MAX_LOG_ENTRIES);
            }
            // renderLogs(); // showFeedback会调用
        }

        showFeedback(responseData.message || '验证完成。', responseData.success ? 'success' : 'error', 7000);

        if (responseData.success) {
            let subscriptionUrl = `${serviceUrl}/subscription.yaml?remote_url=${encodeURIComponent(remoteUrl)}`;
            if (nodePairsToSend.length > 0) {
                const pairsQueryString = convertPairsToQueryString(nodePairsToSend); 
                if (pairsQueryString) { // 仅当有实际配对字符串时才添加参数
                    subscriptionUrl += `&manual_pairs=${encodeURIComponent(pairsQueryString)}`;
                }
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
    } finally {
        if(generateBtn) generateBtn.disabled = false;
        if(autoDetectBtn) autoDetectBtn.disabled = false;
        renderLogs(); // 确保所有日志刷新
    }
}

// --- "复制", "打开", "下载" 按钮的辅助函数 (与您版本一致，略作调整) ---
function copyUrl() {
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('没有可复制的链接。', 'info', 3000); return;
    }
    const textToCopy = generatedUrlInput.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showFeedback('链接已复制到剪贴板！', 'success', 3000); // 简化提示
        }).catch(err => { 
            console.warn('navigator.clipboard.writeText failed, trying legacy:', err);
            attemptLegacyCopy(textToCopy); 
        });
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

async function precheckAndOpenUrl() { 
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('没有可打开的链接。', 'info', 3000); return;
    }
    const urlToOpen = generatedUrlInput.value;
    // 对于“打开”，我们通常期望用户直接看到结果或错误（如果链接本身有问题）
    // 复杂的预检逻辑有时反而会阻碍用户快速查看。
    window.open(urlToOpen, '_blank');
    showFeedback('正在尝试在新标签页打开链接...', 'info', 3000);
}


async function downloadConfig() { // 与您版本基本一致，增强错误处理
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('没有可下载的链接。', 'error', 3000); return;
    }
    const urlToFetch = generatedUrlInput.value;
    showFeedback('正在准备下载配置文件...', 'info', 0);
    try {
        const response = await fetch(urlToFetch);
        if (!response.ok) { 
            let errorText = "无法获取响应文本。";
            try { errorText = await response.text(); } catch (e) { /* 忽略读取文本的错误 */ }
            showFeedback(`下载失败 (HTTP ${response.status}): ${errorText.substring(0, 200)}`, 'error', 7000);
            console.error(`下载失败: ${response.status} ${response.statusText}`, errorText);
            return;
        }
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition');
        let fileName = `chain_subscription_${new Date().toISOString().slice(0,10)}.yaml`; // 改进默认文件名

        if (disposition && disposition.includes('filename=')) {
            const filenameMatch = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']+)['"]?/i);
            if (filenameMatch && filenameMatch[1]) {
                try { fileName = decodeURIComponent(filenameMatch[1]); } catch (e) { /* 用默认 */ }
            }
        } else { 
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
    } catch (error) { 
        console.error('下载配置文件时出错:', error);
        showFeedback(`下载配置文件出错: ${error.message}`, 'error', 7000);
    }
}