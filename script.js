const MAX_MANUAL_PAIRS = 6;
let actionButtons; // To store Copy, Open, Download buttons

document.addEventListener('DOMContentLoaded', function() {
    const serviceUrlInput = document.getElementById('serviceUrl');
    const customizeServiceUrlCheckbox = document.getElementById('customizeServiceUrlSwitchInput');
    const configModeSwitchInput = document.getElementById('configModeSwitchInput');
    const generateLinkButton = document.getElementById('generateLinkButton');
    const copyUrlButton = document.getElementById('copyUrlButton');
    const openUrlButton = document.getElementById('openUrlButton');
    const downloadConfigButton = document.getElementById('downloadConfigButton');

    // Auto-fill service URL and set its initial disabled state
    try {
        const currentOrigin = window.location.origin;
        if (window.location.protocol.startsWith('http') && currentOrigin &&
            !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
            serviceUrlInput.value = currentOrigin;
        } else {
            serviceUrlInput.value = 'http://localhost:11200'; // Default if not auto-filled
        }
    } catch (e) {
        console.warn("Could not auto-fill service URL:", e);
        serviceUrlInput.value = 'http://localhost:11200'; // Ensure a default if error occurs
    }
    if (serviceUrlInput) serviceUrlInput.disabled = true; // Initially disabled as per default checkbox state
    if (customizeServiceUrlCheckbox) customizeServiceUrlCheckbox.checked = false; // Default to not customizing


    if(configModeSwitchInput) configModeSwitchInput.checked = false; // Default to Manual Mode

    actionButtons = [copyUrlButton, openUrlButton, downloadConfigButton];
    actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
    if(document.getElementById('generatedUrl')) document.getElementById('generatedUrl').value = '';

    // Add event listeners for existing elements
    if (configModeSwitchInput) {
        configModeSwitchInput.addEventListener('change', toggleConfigMode);
    }
    if (customizeServiceUrlCheckbox) {
        customizeServiceUrlCheckbox.addEventListener('change', toggleServiceUrlInput);
    }
    if (generateLinkButton) {
        generateLinkButton.addEventListener('click', generateAndValidateUrl);
    }
    if (copyUrlButton) {
        copyUrlButton.addEventListener('click', copyUrl);
    }
    if (openUrlButton) {
        openUrlButton.addEventListener('click', openUrl);
    }
    if (downloadConfigButton) {
        downloadConfigButton.addEventListener('click', downloadConfig);
    }

    renderManualPairRows();
    toggleConfigMode(); // Apply initial state for manual pairs section
});

function createManualPairRowElement(index, landingValue = '', frontValue = '') {
    const newRow = document.createElement('div');
    newRow.className = 'manual-pair-dynamic-row';

    const landingInput = document.createElement('input');
    landingInput.type = 'text';
    landingInput.className = 'landing-proxy-input';
    landingInput.placeholder = '落地节点名称';
    landingInput.value = landingValue;

    const frontInput = document.createElement('input');
    frontInput.type = 'text';
    frontInput.className = 'front-proxy-input';
    frontInput.placeholder = '前置节点/组名称';
    frontInput.value = frontValue;

    // SVG 图标定义
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

    // Add event listeners for dynamically created buttons
    const addButton = newRow.querySelector('.action-button-inline.add');
    const removeButton = newRow.querySelector('.action-button-inline.remove');

    if (addButton) {
        addButton.addEventListener('click', function() {
            addManualPairRow(newRow); // Pass the row itself
        });
    }
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            removeManualPairRow(newRow); // Pass the row itself
        });
    }
    return newRow;
}

function renderManualPairRows() {
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container) return;
    container.innerHTML = '';

    let rowsData = getManualPairDataFromDOM(); // This might be empty initially or based on previous state if persisted
    const configModeSwitch = document.getElementById('configModeSwitchInput');
    // If manual mode is active and no rows exist (e.g., on first load or after clearing all), add one default row.
    if (configModeSwitch && !configModeSwitch.checked && rowsData.length === 0) {
         rowsData = [{ landing: '', front: '' }];
    }


    rowsData.forEach((data, index) => {
        container.appendChild(createManualPairRowElement(index, data.landing, data.front));
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

function addManualPairRow(callingRowElement) { // callingRowElement is the row before which new row is added or null
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container) return;
    const currentRows = container.querySelectorAll('.manual-pair-dynamic-row');

    if (currentRows.length >= MAX_MANUAL_PAIRS) {
        showFeedback(`最多只能添加 ${MAX_MANUAL_PAIRS} 对手动节点。`, 'info');
        return;
    }

    // The index for the new row will be based on the position of callingRowElement or at the end
    let newIndex = currentRows.length;
    if (callingRowElement) {
        // Find the index of callingRowElement to insert after it
        const callingRowIndex = Array.from(currentRows).indexOf(callingRowElement);
        if (callingRowIndex !== -1) {
            newIndex = callingRowIndex + 1;
        }
    }

    const newRow = createManualPairRowElement(newIndex); // Index passed for numbering, actual renumbering done after insertion

    if (callingRowElement && callingRowElement.parentNode === container) {
        // Insert the new row after the callingRowElement
        callingRowElement.after(newRow);
    } else {
        // Append to the end if callingRowElement is not specified or not in container
        container.appendChild(newRow);
    }
    renumberRowsInDOM();
    updateManualPairControlsState();
}

function removeManualPairRow(rowElementToRemove) {
    const container = document.getElementById('manualPairsInputsContainer');
    if (!container || !rowElementToRemove) return;
    const rows = container.querySelectorAll('.manual-pair-dynamic-row');
    const configModeSwitch = document.getElementById('configModeSwitchInput');

    // In manual mode, if it's the last row, clear its inputs instead of removing,
    // unless the row is already empty.
    if (rows.length <= 1 && configModeSwitch && !configModeSwitch.checked) {
        const landingInput = rowElementToRemove.querySelector('.landing-proxy-input');
        const frontInput = rowElementToRemove.querySelector('.front-proxy-input');
        if (landingInput && frontInput && (landingInput.value.trim() !== '' || frontInput.value.trim() !== '')) {
            showFeedback('至少需要保留一对节点配置。清空内容即可。', 'info');
            if (landingInput) landingInput.value = '';
            if (frontInput) frontInput.value = '';
            return; // Don't remove, just cleared.
        } else if (rows.length === 1) {
             // If it's the only row and it's already empty, still don't remove it in manual mode.
             // The user can choose to fill it or switch to auto.
             showFeedback('至少需要保留一对节点配置。清空内容即可。', 'info');
             return;
        }
    }

    rowElementToRemove.remove();
    renumberRowsInDOM();
    updateManualPairControlsState();

    // If manual mode is active and all rows were removed (which shouldn't happen if the above logic is strict)
    // or if we switch to manual mode and there are no rows, ensure one is present.
    const remainingRows = container.querySelectorAll('.manual-pair-dynamic-row');
    if (configModeSwitch && !configModeSwitch.checked && remainingRows.length === 0) {
        renderManualPairRows(); // This will add a default row
    }
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
    const configModeSwitch = document.getElementById('configModeSwitchInput');
    const isAutoMode = configModeSwitch ? configModeSwitch.checked : false;

    rows.forEach((row, index) => {
        const inputs = row.querySelectorAll('input[type="text"]');
        const addButton = row.querySelector('.action-button-inline.add');
        const removeButton = row.querySelector('.action-button-inline.remove');

        inputs.forEach(input => input.disabled = isAutoMode);
        if (addButton) {
            addButton.disabled = isAutoMode || (rows.length >= MAX_MANUAL_PAIRS);
        }
        if (removeButton) {
            // In manual mode, disable remove if it's the only row.
            removeButton.disabled = isAutoMode || (rows.length <= 1 && !isAutoMode);
        }
    });
    const container = document.getElementById('manualPairsInputsContainer');
    // Ensure there's always at least one row in manual mode if the container is visible/active
    if (!isAutoMode && container && rows.length === 0 && container.children.length === 0) {
         renderManualPairRows(); // Will add one default row
    }
}

function toggleConfigMode() {
    const configModeSwitch = document.getElementById('configModeSwitchInput');
    const autoModeText = document.getElementById('autoModeText');
    const manualModeText = document.getElementById('manualModeText');
    const isAutoMode = configModeSwitch ? configModeSwitch.checked : false;

    // Call this first to enable/disable inputs BEFORE checking row counts
    updateManualPairControlsState();

    if (autoModeText) autoModeText.classList.toggle('hidden', !isAutoMode);
    if (manualModeText) manualModeText.classList.toggle('hidden', isAutoMode);

    const container = document.getElementById('manualPairsInputsContainer');
    // If switching to manual mode and there are no rows, render the initial row(s).
    if (!isAutoMode && container && container.querySelectorAll('.manual-pair-dynamic-row').length === 0) {
        renderManualPairRows(); // This will add a default row if logic inside allows
    }
}

function toggleServiceUrlInput() {
    const customizeCheckbox = document.getElementById('customizeServiceUrlSwitchInput');
    const serviceUrlInput = document.getElementById('serviceUrl');
    if(!customizeCheckbox || !serviceUrlInput) return;

    serviceUrlInput.disabled = !customizeCheckbox.checked;
    if (customizeCheckbox.checked) {
        serviceUrlInput.focus();
    } else {
        // Revert to auto-detected URL if customize is unchecked
        try {
            const currentOrigin = window.location.origin;
            if (window.location.protocol.startsWith('http') && currentOrigin &&
                !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
                serviceUrlInput.value = currentOrigin;
            } else { serviceUrlInput.value = 'http://localhost:11200'; }
        } catch(e){ serviceUrlInput.value = 'http://localhost:11200'; }
    }
}

function validateInputs() {
    const remoteUrlInput = document.getElementById('remoteUrl');
    const remoteUrlError = document.getElementById('remoteUrlError');
    if (!remoteUrlInput || !remoteUrlInput.value.trim()) {
        if (remoteUrlError) {
            remoteUrlError.textContent = '请输入有效的原始订阅链接。';
            remoteUrlError.classList.remove('hidden');
        }
        if(remoteUrlInput) remoteUrlInput.focus();
        return false;
    }
    if (remoteUrlError) remoteUrlError.classList.add('hidden');
    return true;
}

function showFeedback(message, type = 'info', duration = 0) {
    const feedbackElement = document.getElementById('feedbackMessage');
    if (!feedbackElement) return;
    feedbackElement.textContent = message;
    feedbackElement.className = 'feedback-message'; // Reset classes
    feedbackElement.classList.add(`feedback-${type}`);

    // Clear previous timeout if any, to prevent default message from overriding new one too soon
    if (feedbackElement.timeoutId) {
        clearTimeout(feedbackElement.timeoutId);
    }

    if (type === 'info' && message === '等待操作...') { // Don't auto-hide default message
        return;
    }

    if (duration > 0) {
        feedbackElement.timeoutId = setTimeout(() => {
            if (feedbackElement.textContent === message) { // Only reset if current message is the one that set the timeout
                feedbackElement.textContent = '等待操作...';
                feedbackElement.className = 'feedback-message feedback-info';
            }
        }, duration);
    }
}

function generateUrlLogic() {
    if (!validateInputs()) return null;

    const serviceUrlInput = document.getElementById('serviceUrl');
    const remoteUrlInput = document.getElementById('remoteUrl');
    const configModeSwitch = document.getElementById('configModeSwitchInput');
    const customizeServiceUrlCheckbox = document.getElementById('customizeServiceUrlSwitchInput');

    let finalServiceUrl = serviceUrlInput.value.trim().replace(/\/$/, '');

    if (customizeServiceUrlCheckbox && customizeServiceUrlCheckbox.checked && !finalServiceUrl) {
         showFeedback('错误：请输入自定义的服务根地址。', 'error', 5000);
         if(serviceUrlInput) serviceUrlInput.focus();
         return null;
    }
    // If not customizing, the value should already be set by toggleServiceUrlInput or initial load.
    // But ensure it's correctly reflecting non-customized state if generate is hit directly.
    if(customizeServiceUrlCheckbox && !customizeServiceUrlCheckbox.checked){
        try {
            const currentOrigin = window.location.origin;
            if (window.location.protocol.startsWith('http') && currentOrigin &&
                !currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
                finalServiceUrl = currentOrigin;
            } else { finalServiceUrl = 'http://localhost:11200'; }
        } catch(e){ finalServiceUrl = 'http://localhost:11200'; }
        if(serviceUrlInput) serviceUrlInput.value = finalServiceUrl; // Reflect the URL being used
    }


    const remoteUrl = remoteUrlInput.value.trim();
    const isAutoMode = (configModeSwitch && configModeSwitch.checked);
    const manualDialerEnabledValue = isAutoMode ? '0' : '1';

    let manualPairsArray = [];
    if (!isAutoMode) { // Manual mode
        const rows = document.querySelectorAll('#manualPairsInputsContainer .manual-pair-dynamic-row');
        let hasIncompletePair = false;
        let hasAtLeastOneCompletePair = false;

        if (rows.length === 0) { // Should not happen if UI logic is correct for manual mode
            showFeedback('手动配置模式下，请至少填写一对有效的节点。', 'error', 5000); return null;
        }

        rows.forEach(row => {
            const landingInput = row.querySelector('.landing-proxy-input');
            const frontInput = row.querySelector('.front-proxy-input');
            if (landingInput && frontInput) {
                const landingValue = landingInput.value.trim();
                const frontValue = frontInput.value.trim();
                if (landingValue && frontValue) {
                    manualPairsArray.push(landingValue + ":" + frontValue);
                    hasAtLeastOneCompletePair = true;
                } else if (landingValue || frontValue) { // One is filled, the other is not
                    hasIncompletePair = true;
                }
            }
        });

        if (hasIncompletePair) {
            showFeedback('手动配置中存在未完整填写的节点对，请检查。', 'error', 5000); return null;
        }
        if (!hasAtLeastOneCompletePair) { // No complete pairs, and no incomplete pairs (i.e., all rows are empty)
            showFeedback('手动配置模式下，请至少填写一对有效的节点。', 'error', 5000); return null;
        }
    }
    const manualPairsString = manualPairsArray.join(',');

    let targetUrl = finalServiceUrl + '/subscription.yaml?';
    targetUrl += 'remote_url=' + encodeURIComponent(remoteUrl);
    targetUrl += '&manual_dialer_enabled=' + manualDialerEnabledValue;
    if (manualDialerEnabledValue === '1' && manualPairsString) { // Only add manual_pairs if in manual mode and string is not empty
        targetUrl += '&manual_pairs=' + encodeURIComponent(manualPairsString);
    }
    return targetUrl;
}

async function generateAndValidateUrl() {
    showFeedback('正在生成和验证链接...', 'info', 0);
    const generateBtn = document.getElementById('generateLinkButton');
    if(generateBtn) generateBtn.disabled = true;

    const generatedUrlInput = document.getElementById('generatedUrl');
    // 初始禁用结果按钮并清空之前的URL
    actionButtons.forEach(btn => { if(btn) btn.disabled = true; });
    if(generatedUrlInput) generatedUrlInput.value = '';

    const url = generateUrlLogic();

    if (!url) {
        if(generateBtn) generateBtn.disabled = false; // 仅重置生成按钮
        const feedbackElement = document.getElementById('feedbackMessage');
        if (feedbackElement && !feedbackElement.className.includes('error') && !feedbackElement.className.includes('success')) {
             showFeedback('等待操作...', 'info');
        }
        return;
    }

    // 如果生成了URL，先填充到输入框
    if(generatedUrlInput) generatedUrlInput.value = url;

    try {
        const response = await fetch(url);
        // 不论验证成功与否，只要URL已生成并尝试过请求，就启用操作按钮
        actionButtons.forEach(btn => { if(btn) btn.disabled = false; });

        if (!response.ok) {
            const errorTextFromServer = await response.text();
            showFeedback(`链接验证失败 (HTTP ${response.status}): ${errorTextFromServer.substring(0,100)}`, 'error', 7000);
            // 即使验证失败，URL仍在输入框中，用户可以复制
        } else {
            const contentType = response.headers.get("content-type");
            if (contentType && (contentType.toLowerCase().includes("yaml") || contentType.toLowerCase().includes("text"))) {
                showFeedback('链接已生成并验证成功！', 'success', 5000);
            } else {
               showFeedback(`链接已生成，但响应类型 (${contentType || '未知'}) 可能非预期。仍可尝试使用。`, 'info', 7000);
            }
        }
    } catch (error) {
        // 网络错误等导致fetch失败，也启用操作按钮，因为URL已在输入框中
        actionButtons.forEach(btn => { if(btn) btn.disabled = false; });
        showFeedback(`验证链接时出错: ${error.message}. 请检查服务地址和网络。链接仍已填充，可尝试手动操作。`, 'error', 7000);
        console.error('验证链接时出错 (fetch catch):', error);
    } finally {
        if(generateBtn) generateBtn.disabled = false;
    }
}

function copyUrl() {
    const generatedUrlInput = document.getElementById('generatedUrl');
    console.log('Copy button clicked.');

    if (!generatedUrlInput || !generatedUrlInput.value) {
        console.log('No URL to copy or input field not found.');
        showFeedback('没有可复制的链接。', 'info', 3000);
        return;
    }

    const textToCopy = generatedUrlInput.value;
    console.log('URL to copy:', textToCopy);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        // 优先使用 navigator.clipboard API (推荐，需安全环境)
        navigator.clipboard.writeText(textToCopy).then(() => {
            console.log('Clipboard writeText successful (navigator.clipboard).');
            showFeedback('链接已复制到剪贴板！ (安全模式)', 'success', 3000);
        }).catch(err => {
            console.error('Clipboard writeText failed:', err);
            // navigator.clipboard.writeText 失败，尝试备用方法
            attemptLegacyCopy(textToCopy);
        });
    } else {
        // navigator.clipboard 不可用或没有 writeText 方法 (通常因为非安全环境)
        console.warn('navigator.clipboard.writeText is not available. Attempting legacy copy command.');
        attemptLegacyCopy(textToCopy);
    }
}

function attemptLegacyCopy(textToCopy) {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    // 避免在视口外创建元素导致页面滚动
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Legacy copy command successful (document.execCommand).');
            showFeedback('链接已复制到剪贴板！ (备用模式)', 'success', 3000);
        } else {
            console.error('Legacy copy command failed.');
            showFeedback('复制失败。请手动复制链接。您的浏览器或环境可能不支持自动复制。', 'error', 5000);
        }
    } catch (err) {
        console.error('Error during legacy copy command:', err);
        showFeedback('复制过程中发生错误，请手动复制。', 'error', 5000);
    }
    document.body.removeChild(textArea);
}

function openUrl() {
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('没有可打开的链接。', 'info', 3000); return;
    }
    window.open(generatedUrlInput.value, '_blank');
    showFeedback('正在尝试打开链接...', 'info', 2000);
}

async function downloadConfig() {
    const generatedUrlInput = document.getElementById('generatedUrl');
    if (!generatedUrlInput || !generatedUrlInput.value) {
        showFeedback('请先生成链接。', 'error', 3000); return;
    }
    const urlToFetch = generatedUrlInput.value;
    showFeedback('正在下载配置文件...', 'info', 0); // Persistent until success/failure
    try {
        const response = await fetch(urlToFetch);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`下载失败: ${response.status} ${response.statusText}. 服务端响应: ${errorText.substring(0,100)}`);
        }
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition');
        let fileName = "converted_subscription.yaml";

        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            let matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                fileName = matches[1].replace(/['"]/g, '').trim();
            }
        } else {
            try {
                const pathName = new URL(urlToFetch).pathname;
                const lastSegment = pathName.substring(pathName.lastIndexOf('/') + 1);
                if (lastSegment && (lastSegment.endsWith('.yaml') || lastSegment.endsWith('.yml')) && lastSegment.length < 100) {
                    fileName = lastSegment;
                }
            } catch (e) { /* ignore if URL parsing fails or no suitable segment */ }
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
        showFeedback(`下载配置文件时出错: ${error.message}`, 'error', 7000);
    }
}