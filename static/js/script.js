const state = {
    sessionId: null,
    activePanel: 'chat',
    selectedDocuments: new Set(),
    pendingFileList: [],
    generationInProgress: false
};

function setStatus(text, tone = 'neutral') {
    const statusText = document.getElementById('statusText');
    if (!statusText) return;
    statusText.textContent = text;
    const dot = statusText.closest('.sidebar-status')?.querySelector('.status-dot');
    if (dot) {
        dot.style.background = tone === 'error' ? '#ff8f8f' : tone === 'warning' ? '#f5c26b' : '#3cd89a';
    }
}

function showPanel(panelName) {
    state.activePanel = panelName;
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${panelName}Panel`);
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === panelName);
    });
}

function createSession() {
    return fetch('/api/session/create', { method: 'POST' })
        .then(async (response) => {
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Unable to create a session');
            }
            state.sessionId = result.session_id;
            setStatus('Ready to learn');
            return result;
        });
}

function ensureSession() {
    return fetch('/api/session/info')
        .then(async (response) => {
            const result = await response.json();
            if (response.ok && result.success) {
                state.sessionId = result.session_id;
                setStatus('Ready to learn');
                return result;
            }
            return createSession();
        })
        .catch(() => createSession());
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
}

function openUploadModal() {
    openModal('uploadModal');
}

function closeUploadModal() {
    closeModal('uploadModal');
    state.pendingFileList = [];
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    renderSelectedFiles([]);
}

function renderSelectedFiles(files) {
    const container = document.getElementById('selectedFilesList');
    if (!container) return;
    container.innerHTML = '';

    if (!files.length) {
        container.innerHTML = '<div class="muted">No files selected yet.</div>';
        return;
    }

    files.forEach(file => {
        const row = document.createElement('div');
        row.className = 'selected-file';
        row.innerHTML = `
            <div class="selected-file-icon"><i data-lucide="file-text"></i></div>
            <div class="selected-file-copy">
                <strong>${file.name}</strong>
                <span>${(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
        `;
        container.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
}

function bindUploadControls() {
    const fileInput = document.getElementById('fileInput');
    const uploadDropArea = document.getElementById('uploadDropArea');

    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const files = Array.from(event.target.files || []);
            state.pendingFileList = files;
            renderSelectedFiles(files);
        });
    }

    if (uploadDropArea) {
        uploadDropArea.addEventListener('click', () => fileInput?.click());
        uploadDropArea.addEventListener('dragover', (event) => {
            event.preventDefault();
            uploadDropArea.style.borderColor = 'rgba(125, 126, 243, 0.35)';
        });
        uploadDropArea.addEventListener('dragleave', () => {
            uploadDropArea.style.borderColor = 'rgba(255,255,255,0.12)';
        });
        uploadDropArea.addEventListener('drop', (event) => {
            event.preventDefault();
            uploadDropArea.style.borderColor = 'rgba(255,255,255,0.12)';
            const files = Array.from(event.dataTransfer.files || []);
            state.pendingFileList = files;
            if (fileInput) fileInput.files = event.dataTransfer.files;
            renderSelectedFiles(files);
        });
    }
}

function uploadFiles(formData) {
    return fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
    }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Upload failed');
        }
        return result;
    });
}

function startUpload() {
    if (!state.sessionId) {
        return showToast('Create a session first', 'error');
    }

    const formData = new FormData();
    const files = state.pendingFileList;

    files.forEach(file => formData.append('files', file));

    const wikiLink = window.prompt('Add a wiki URL (optional):', '');
    if (wikiLink && wikiLink.trim()) {
        formData.append('wiki_links', wikiLink.trim());
    }

    if (!files.length && !wikiLink) {
        return showToast('Choose at least one file or paste a wiki link', 'warning');
    }

    setStatus('Uploading sources');
    uploadFiles(formData)
        .then((result) => {
            showToast(`${result.total_documents || 0} source(s) ready`, 'success');
            closeUploadModal();
            listDocuments();
        })
        .catch((error) => {
            setStatus('Upload failed', 'error');
            showToast(error.message || 'Upload failed', 'error');
        });
}

function listDocuments() {
    if (!state.sessionId) return;
    fetch('/api/documents/list')
        .then(async (response) => {
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Unable to load sources');
            }
            renderDocuments(result.documents || []);
        })
        .catch((error) => {
            showToast(error.message || 'Unable to load sources', 'error');
        });
}

function renderDocuments(documents) {
    const list = document.getElementById('sourcesList');
    const count = document.getElementById('sourcesCount');
    const notebookSubtitle = document.getElementById('notebookSubtitle');

    if (!list) return;

    if (!documents.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i data-lucide="inbox"></i>
                <h4>Your notebook is empty</h4>
                <p>Add documents or web sources to start learning.</p>
                <div class="panel-actions" style="justify-content:center;">
                    <button class="btn btn-primary" type="button" onclick="openUploadModal()">Add source</button>
                    <button class="btn btn-secondary" type="button" onclick="listDocuments()">Refresh</button>
                </div>
            </div>
        `;
        if (count) count.textContent = '0';
        if (notebookSubtitle) notebookSubtitle.textContent = '• 0 sources';
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    list.innerHTML = documents.map((doc) => {
        const selected = state.selectedDocuments.has(doc.name) || state.selectedDocuments.has(doc.path);
        return `
            <div class="source-card ${selected ? 'selected' : ''}" data-source-name="${escapeHtml(doc.name || 'Untitled')}" data-source-path="${escapeHtml(doc.path || '')}">
                <div class="source-icon"><i data-lucide="file-text"></i></div>
                <div class="source-main">
                    <div class="source-title">${escapeHtml(doc.name || 'Untitled')}</div>
                    <div class="source-meta"><span>${doc.type || 'file'}</span><span>•</span><span>${new Date(doc.uploaded_at || Date.now()).toLocaleDateString()}</span></div>
                </div>
                <div class="source-actions">
                    <label class="checkbox-wrap">
                        <input type="checkbox" ${selected ? 'checked' : ''} data-source-select="${escapeHtml(doc.name || doc.path || '')}">
                    </label>
                </div>
            </div>
        `;
    }).join('');

    if (count) count.textContent = String(documents.length);
    if (notebookSubtitle) notebookSubtitle.textContent = `• ${documents.length} source${documents.length === 1 ? '' : 's'}`;

    list.querySelectorAll('input[data-source-select]').forEach((input) => {
        input.addEventListener('change', (event) => {
            const value = event.target.dataset.sourceSelect;
            if (event.target.checked) {
                state.selectedDocuments.add(value);
            } else {
                state.selectedDocuments.delete(value);
            }
            document.getElementById('selectedCount').textContent = String(state.selectedDocuments.size);
        });
    });

    if (window.lucide) window.lucide.createIcons();
    document.getElementById('selectedCount').textContent = String(state.selectedDocuments.size);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon"><i data-lucide="${type === 'error' ? 'alert-circle' : type === 'warning' ? 'triangle-alert' : 'check-circle'}"></i></span>
        <span>${escapeHtml(message)}</span>
        <button class="toast-close" type="button" aria-label="Close">×</button>
    `;
    const close = toast.querySelector('.toast-close');
    close.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => toast.remove(), 2600);
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

function toggleTheme() {
    const current = document.body.dataset.theme === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !state.sessionId) return;

    const disabledBtn = document.getElementById('sendBtn');
    if (disabledBtn) disabledBtn.disabled = true;

    const message = document.createElement('div');
    message.className = 'chat-message user';
    message.textContent = text;
    const messages = document.getElementById('chatMessages');
    const emptyState = messages.querySelector('.chat-empty');
    if (emptyState) emptyState.remove();
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    input.value = '';

    fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, source_ids: [...state.selectedDocuments] })
    }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Unable to generate a response');
        }

        const bot = document.createElement('div');
        bot.className = 'chat-message bot';
        bot.innerHTML = '<div class="assistant-label">AI</div>' + (result.response || '');
        messages.appendChild(bot);
        messages.scrollTop = messages.scrollHeight;
        setStatus('Answer ready');
    }).catch((error) => {
        const err = document.createElement('div');
        err.className = 'chat-message bot error';
        err.textContent = error.message || 'Something went wrong';
        messages.appendChild(err);
        showToast(error.message || 'Chat failed', 'error');
        setStatus('Chat error', 'error');
    }).finally(() => {
        if (disabledBtn) disabledBtn.disabled = false;
    });
}

function stopGeneration() {
    showToast('Generation stopped', 'warning');
    setStatus('Ready to learn');
}

function openStudioCreate() {
    showToast('Studio is coming soon', 'warning');
}

function attachDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach((dropdown) => {
        const trigger = dropdown.querySelector('.cd-trigger');
        const label = dropdown.querySelector('.cd-label');

        trigger?.addEventListener('click', () => {
            dropdown.classList.toggle('open');
        });

        dropdown.querySelectorAll('.cd-item').forEach((item) => {
            item.addEventListener('click', () => {
                const value = item.dataset.value;
                if (label) label.textContent = value.charAt(0).toUpperCase() + value.slice(1);
                dropdown.classList.remove('open');

                if (dropdown.id === 'composerToneDropdown') {
                    fetch('/api/settings/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tone: value, level: document.getElementById('settingsLevelSelect')?.value || 'beginner' })
                    }).catch(() => {});
                }

                if (dropdown.id === 'composerLevelDropdown') {
                    fetch('/api/settings/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tone: document.getElementById('settingsToneSelect')?.value || 'default', level: value })
                    }).catch(() => {});
                }
            });
        });
    });

    const settingsToneSelect = document.getElementById('settingsToneSelect');
    const settingsLevelSelect = document.getElementById('settingsLevelSelect');
    if (settingsToneSelect) {
        settingsToneSelect.addEventListener('change', () => {
            const tone = settingsToneSelect.value;
            fetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tone, level: settingsLevelSelect?.value || 'beginner' })
            }).catch(() => {});
        });
    }

    if (settingsLevelSelect) {
        settingsLevelSelect.addEventListener('change', () => {
            const level = settingsLevelSelect.value;
            fetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tone: settingsToneSelect?.value || 'default', level })
            }).catch(() => {});
        });
    }

    document.querySelectorAll('.seg-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.seg-btn').forEach((node) => node.classList.toggle('active', node === btn));
            applyTheme(btn.dataset.theme || 'dark');
        });
    });
}

function resetSession() {
    fetch('/api/session/reset', { method: 'POST' })
        .then(async (response) => {
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Reset failed');
            }
            state.sessionId = result.new_session_id;
            state.selectedDocuments.clear();
            setStatus('Session reset');
            listDocuments();
            showToast('New session created', 'success');
        })
        .catch((error) => {
            showToast(error.message || 'Reset failed', 'error');
        });
}

function bindGlobalSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;
    input.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            input.focus();
        }
    });
}

function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function initializeApp() {
    ensureSession().then(() => listDocuments());
    bindUploadControls();
    bindGlobalSearch();
    attachDropdowns();
    applyTheme('dark');
    showPanel('chat');

    document.addEventListener('click', (event) => {
        document.querySelectorAll('.custom-dropdown').forEach((dropdown) => {
            if (!dropdown.contains(event.target)) dropdown.classList.remove('open');
        });
        const modal = event.target.closest('[data-close-modal]');
        if (modal) {
            closeModal(modal.dataset.closeModal);
        }
    });

    document.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => closeModal(button.dataset.closeModal));
    });

    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.addEventListener('click', (event) => {
            if (event.target === settingsModal) closeModal('settingsModal');
        });
    }

    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
        uploadModal.addEventListener('click', (event) => {
            if (event.target === uploadModal) closeUploadModal();
        });
    }

    if (window.lucide) window.lucide.createIcons();
}

window.showPanel = showPanel;
window.resetSession = resetSession;
window.listDocuments = listDocuments;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.startUpload = startUpload;
window.sendMessage = sendMessage;
window.stopGeneration = stopGeneration;
window.openStudioCreate = openStudioCreate;
window.handleChatKeypress = handleChatKeypress;
window.closePreview = () => closeModal('previewModal');
window.showToast = showToast;

document.addEventListener('DOMContentLoaded', initializeApp);

if (document.readyState !== 'loading') initializeApp();
