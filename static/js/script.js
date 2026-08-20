/* ============================================================================
   LEARN WITH AI - FRONTEND APPLICATION
   Premium AI Study Workspace
   ============================================================================ */

/* ============================================================================
   GLOBAL STATE
   ============================================================================ */

const appState = {
  sessionId: null,
  currentTone: 'default',
  currentLevel: 'beginner',
  documents: [],
  chatHistory: [],
  selectedSources: [],
  dbInitialized: false,
  isLoading: false,
  currentTab: 'sources',
  theme: localStorage.getItem('theme') || 'dark',
  tones: [],
  levels: [],
  selectedFiles: [],
};

/* ============================================================================
   INITIALIZATION
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initializeApp();
});

async function initializeApp() {
  // Set initial theme
  applyTheme(appState.theme);

  // Create new session
  await createNewSession();

  // Bind event listeners
  bindEventListeners();

  // Load initial data
  await loadDocuments();

  // Initialize markdown parser if needed
  initializeMarkdownRenderer();
}

async function createNewSession() {
  try {
    const response = await fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();

    if (data.success) {
      appState.sessionId = data.session_id;
      appState.tones = data.tones;
      appState.levels = data.levels;

      // Populate dropdowns
      populateToneDropdown(data.tones);
      populateLevelDropdown(data.levels);

      // Update UI
      updateContextInfo();
    } else {
      showToast('Failed to create session', 'error');
    }
  } catch (error) {
    console.error('Error creating session:', error);
    showToast('Error creating session', 'error');
  }
}

function populateToneDropdown(tones) {
  const selectors = ['tone-selector', 'settings-tone'];
  selectors.forEach((id) => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = tones
        .map(
          (tone) =>
            `<option value="${tone}" ${tone === appState.currentTone ? 'selected' : ''}>${tone.charAt(0).toUpperCase() + tone.slice(1)}</option>`
        )
        .join('');
    }
  });
}

function populateLevelDropdown(levels) {
  const selectors = ['level-selector', 'settings-level'];
  selectors.forEach((id) => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = levels
        .map(
          (level) =>
            `<option value="${level}" ${level === appState.currentLevel ? 'selected' : ''}>${level.charAt(0).toUpperCase() + level.slice(1)}</option>`
        )
        .join('');
    }
  });
}

/* ============================================================================
   EVENT BINDING
   ============================================================================ */

function bindEventListeners() {
  // Navigation
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab));
  });

  // Buttons
  const addSourceBtn = document.getElementById('add-source-btn');
  if (addSourceBtn) addSourceBtn.addEventListener('click', openAddSourceModal);

  const newSessionBtn = document.getElementById('new-session-btn');
  if (newSessionBtn) newSessionBtn.addEventListener('click', createNewSession);

  const resetSessionBtn = document.getElementById('reset-session-btn');
  if (resetSessionBtn) resetSessionBtn.addEventListener('click', resetSession);

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  const settingsResetBtn = document.getElementById('settings-reset-btn');
  if (settingsResetBtn) settingsResetBtn.addEventListener('click', resetSession);

  // Attach button in chat composer
  const attachBtn = document.getElementById('attach-source-btn');
  if (attachBtn) {
    attachBtn.addEventListener('click', openAddSourceModal);
  }

  // Sources search filter
  const sourcesSearch = document.getElementById('sources-search-input');
  if (sourcesSearch) {
    sourcesSearch.addEventListener('input', (e) => {
      filterDocuments(e.target.value);
    });
  }

  // Add source modal
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', (e) => {
      if (e.target.id !== 'file-input') {
        fileInput.click();
      }
    });
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.currentTarget.classList.add('active');
    });
    uploadZone.addEventListener('dragleave', (e) => {
      e.currentTarget.classList.remove('active');
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('active');
      handleFileSelection(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => {
      handleFileSelection(e.target.files);
    });
  }

  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) uploadBtn.addEventListener('click', uploadSources);

  // Theme and settings
  const themeDarkBtn = document.getElementById('theme-dark-btn');
  if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => setTheme('dark'));

  const themeLightBtn = document.getElementById('theme-light-btn');
  if (themeLightBtn) themeLightBtn.addEventListener('click', () => setTheme('light'));

  const settingsTone = document.getElementById('settings-tone');
  if (settingsTone) {
    settingsTone.addEventListener('change', (e) => {
      updateSettings(e.target.value, appState.currentLevel);
    });
  }

  const settingsLevel = document.getElementById('settings-level');
  if (settingsLevel) {
    settingsLevel.addEventListener('change', (e) => {
      updateSettings(appState.currentTone, e.target.value);
    });
  }

  // Chat
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  const toneSelector = document.getElementById('tone-selector');
  if (toneSelector) {
    toneSelector.addEventListener('change', (e) => {
      appState.currentTone = e.target.value;
    });
  }

  const levelSelector = document.getElementById('level-selector');
  if (levelSelector) {
    levelSelector.addEventListener('change', (e) => {
      appState.currentLevel = e.target.value;
    });
  }

  // Modal backdrops (close on backdrop click)
  const addModalBackdrop = document.getElementById('add-source-modal-backdrop');
  if (addModalBackdrop) {
    addModalBackdrop.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeAddSourceModal();
      }
    });
  }

  const settingsModalBackdrop = document.getElementById('settings-modal-backdrop');
  if (settingsModalBackdrop) {
    settingsModalBackdrop.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeSettingsModal();
      }
    });
  }

  const previewModalBackdrop = document.getElementById('preview-modal-backdrop');
  if (previewModalBackdrop) {
    previewModalBackdrop.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closePreviewModal();
      }
    });
  }

  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });
    searchInput.addEventListener('input', (e) => {
      filterDocuments(e.target.value);
    });
  }
}

/* ============================================================================
   NAVIGATION & TABS
   ============================================================================ */

function switchTab(tab) {
  appState.currentTab = tab;

  // Hide all tabs
  document.getElementById('sources-tab').style.display = 'none';
  document.getElementById('chat-tab').style.display = 'none';
  document.getElementById('studio-tab').style.display = 'none';

  // Show selected tab
  document.getElementById(`${tab}-tab`).style.display = 'flex';

  // Update active nav item
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  // Update Lucide icons in the newly visible tab
  lucide.createIcons();

  // Show/hide chat empty state
  if (tab === 'chat') {
    updateChatUI();
  }
}

/* ============================================================================
   SOURCES MANAGEMENT
   ============================================================================ */

async function loadDocuments() {
  try {
    const response = await fetch('/api/documents/list', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();

    if (data.success) {
      appState.documents = data.documents;
      renderDocuments();
      updateContextInfo();
    }
  } catch (error) {
    console.error('Error loading documents:', error);
  }
}

function renderDocuments() {
  const container = document.getElementById('sources-list');
  const emptyState = document.getElementById('sources-empty-state');

  if (!appState.documents || appState.documents.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  container.innerHTML = appState.documents
    .map((doc, index) => createDocumentItem(doc, index))
    .join('');

  // Bind document actions
  document.querySelectorAll('.document-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.document-action-btn')) {
        toggleSourceSelection(item.dataset.docIndex);
      }
    });
  });

  document.querySelectorAll('.document-preview-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const docIndex = btn.closest('.document-item').dataset.docIndex;
      openPreviewModal(appState.documents[docIndex]);
    });
  });

  document.querySelectorAll('.document-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const docIndex = btn.closest('.document-item').dataset.docIndex;
      deleteDocument(docIndex);
    });
  });

  lucide.createIcons();
}

function filterDocuments(query) {
  const q = (query || '').toLowerCase().trim();
  const container = document.getElementById('sources-list');
  const emptyState = document.getElementById('sources-empty-state');

  if (!appState.documents || appState.documents.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  const items = container.querySelectorAll('.document-item');
  let matchCount = 0;
  items.forEach((item) => {
    const docIndex = item.dataset.docIndex;
    const doc = appState.documents[docIndex];
    if (!doc) return;
    const matches = !q || doc.name.toLowerCase().includes(q) || (doc.type || '').toLowerCase().includes(q);
    item.style.display = matches ? 'flex' : 'none';
    if (matches) matchCount++;
  });
}

function handleStudioClick(type) {
  if (!appState.documents || appState.documents.length === 0) {
    showToast(`⚠ Please upload and index sources first to create a ${type}`, 'warning');
    openAddSourceModal();
    return;
  }

  if (!appState.dbInitialized) {
    showToast(`⚠ Indexing in progress, please wait before generating ${type}`, 'warning');
    return;
  }

  switchTab('chat');
  const chatInput = document.getElementById('chat-input');
  const prompts = {
    'Study Guide': 'Please generate a comprehensive, structured Study Guide covering all core topics, definitions, key formulas, and chapter summaries from my indexed sources.',
    'Flashcards': 'Please generate a set of 8-10 high-yield active recall flashcards (in Question & Answer format) based on the primary concepts from my sources.',
    'Quiz': 'Please create an interactive 5-question practice quiz based on the key takeaways from my sources, including multiple choice options and detailed answer explanations.',
    'Mind Map': 'Please generate a clear hierarchical text outline / Concept Mind Map showing how the major topics and subtopics in my sources are interrelated.',
    'Notes': 'Please synthesize concise, high-yield executive revision notes with bulleted takeaways and formulas from my uploaded materials.',
    'Report': 'Please generate a structured academic briefing report synthesizing all uploaded documents with executive summary and key findings.'
  };

  chatInput.value = prompts[type] || `Please generate a ${type} based on my uploaded sources.`;
  chatInput.focus();
  sendMessage();
}

function createDocumentItem(doc, index) {
  const icon = getDocumentIcon(doc);
  const type = doc.type === 'file' ? getFileType(doc.name).toUpperCase() : 'WEB';
  const isSelected = appState.selectedSources.includes(doc.path || doc.name);

  return `
    <div class="document-item ${isSelected ? 'selected' : ''}" data-doc-index="${index}">
      <div class="document-icon">${icon}</div>
      <div class="document-info">
        <div class="document-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</div>
        <div class="document-meta">
          <span class="doc-badge">${type}</span>
          <span>•</span>
          <span class="doc-status-indexed" id="doc-status-${index}">Indexed</span>
        </div>
      </div>
      <div class="document-actions">
        <button class="document-action-btn document-preview-btn" title="Preview Document">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <button class="document-action-btn document-delete-btn" title="Remove Source">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function getDocumentIcon(doc) {
  if (doc.type === 'wiki') return '🌐';
  const ext = getFileType(doc.name);
  const icons = {
    pdf: '📄',
    txt: '📝',
    csv: '📊',
    json: '{ }',
  };
  return icons[ext] || '📁';
}

function getFileType(filename) {
  return filename.split('.').pop().toLowerCase();
}

function toggleSourceSelection(docIndex) {
  const doc = appState.documents[docIndex];
  if (!doc) return;
  const key = doc.path || doc.name;

  if (appState.selectedSources.includes(key)) {
    appState.selectedSources = appState.selectedSources.filter((k) => k !== key);
  } else {
    appState.selectedSources.push(key);
  }

  renderDocuments();
}

function deleteDocument(docIndex) {
  if (confirm('Are you sure you want to remove this source?')) {
    appState.documents.splice(docIndex, 1);
    renderDocuments();
    showToast('Source removed', 'success');
  }
}

async function openPreviewModal(doc) {
  document.getElementById('preview-title').textContent = doc.name;
  document.getElementById('preview-meta').textContent =
    doc.type === 'file' ? `${getFileType(doc.name).toUpperCase()} • ${doc.type}` : 'Web source';
  document.getElementById('preview-content').innerHTML = `
    <div style="text-align: center; padding: var(--space-2xl); color: var(--text-muted);">
      <div class="loading-spinner" style="margin: 0 auto; width: 24px; height: 24px; margin-bottom: var(--space-lg);"></div>
      <p>Loading preview...</p>
    </div>
  `;

  // Show modal
  document.getElementById('preview-modal-backdrop').classList.add('active');

  // Simulate preview content
  setTimeout(() => {
    document.getElementById('preview-content').innerHTML = `
      <div class="markdown-content">
        <p>${doc.name}</p>
        <p style="color: var(--text-muted);">
          Preview content would be displayed here. This is a placeholder for the document preview.
        </p>
      </div>
    `;
  }, 500);
}

function closePreviewModal() {
  document.getElementById('preview-modal-backdrop').classList.remove('active');
}

/* ============================================================================
   FILE UPLOAD
   ============================================================================ */

function handleFileSelection(files) {
  appState.selectedFiles = Array.from(files);
  renderSelectedFiles();
}

function renderSelectedFiles() {
  const container = document.getElementById('selected-files-container');
  const list = document.getElementById('selected-files-list');

  if (appState.selectedFiles.length === 0) {
    container.style.display = 'none';
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
    return;
  }

  container.style.display = 'block';
  list.innerHTML = appState.selectedFiles
    .map(
      (file, index) => `
    <div class="upload-progress">
      <div style="flex: 1; min-width: 0;">
        <div class="document-name" style="margin-bottom: var(--space-xs);">${file.name}</div>
        <div class="text-muted" style="font-size: 12px;">
          ${(file.size / 1024 / 1024).toFixed(2)} MB
        </div>
      </div>
      <button class="btn-ghost btn-sm" onclick="removeSelectedFile(${index})" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `
    )
    .join('');
}

function removeSelectedFile(index) {
  appState.selectedFiles.splice(index, 1);
  renderSelectedFiles();
}

async function uploadSources() {
  if (appState.isLoading) return;

  const webSourceInput = document.getElementById('web-source-input');
  const webSource = webSourceInput ? webSourceInput.value.trim() : '';

  if (appState.selectedFiles.length === 0 && !webSource) {
    showToast('Please select files or add a web source', 'warning');
    return;
  }

  appState.isLoading = true;
  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) uploadBtn.disabled = true;

  const formData = new FormData();
  appState.selectedFiles.forEach((file) => {
    formData.append('files', file);
  });

  if (webSource) {
    formData.append('wiki_links', webSource);
  }

  try {
    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (data.success) {
      showToast(`✓ ${data.uploaded_files} file(s) uploaded`, 'success');

      // Reset form
      appState.selectedFiles = [];
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
      if (webSourceInput) webSourceInput.value = '';
      renderSelectedFiles();

      // Reload documents
      await loadDocuments();

      // Start ingestion
      await ingestDocuments();

      closeAddSourceModal();
    } else {
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (error) {
    console.error('Error uploading:', error);
    showToast('Upload error', 'error');
  } finally {
    appState.isLoading = false;
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

async function ingestDocuments() {
  try {
    document.getElementById('upload-progress-container').style.display = 'block';
    document.getElementById('upload-progress-items').innerHTML = `
      <div style="text-align: center; padding: var(--space-lg);">
        <div class="loading-spinner" style="margin: 0 auto; width: 20px; height: 20px; margin-bottom: var(--space-md);"></div>
        <div class="text-muted">Preparing your notebook...</div>
      </div>
    `;

    const response = await fetch('/api/documents/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();

    if (data.success) {
      appState.dbInitialized = true;
      showToast('✓ Notebook indexed', 'success');
      document.getElementById('upload-progress-container').style.display = 'none';
    } else {
      showToast(data.error || 'Ingestion failed', 'error');
    }
  } catch (error) {
    console.error('Error ingesting:', error);
    showToast('Ingestion error', 'error');
  }
}

function openAddSourceModal() {
  document.getElementById('add-source-modal-backdrop').classList.add('active');
}

function closeAddSourceModal() {
  document.getElementById('add-source-modal-backdrop').classList.remove('active');
  appState.selectedFiles = [];
  document.getElementById('file-input').value = '';
  document.getElementById('web-source-input').value = '';
  renderSelectedFiles();
}

/* ============================================================================
   CHAT
   ============================================================================ */

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const question = input.value.trim();

  if (!question || appState.isLoading) return;

  if (!appState.documents || appState.documents.length === 0) {
    showToast('⚠ Please add a source first', 'warning');
    return;
  }

  if (!appState.dbInitialized) {
    showToast('⚠ Please wait for indexing to complete', 'warning');
    return;
  }

  appState.isLoading = true;
  input.disabled = true;
  document.getElementById('send-btn').disabled = true;

  // Add user message to UI
  const messagesContainer = document.getElementById('chat-messages');
  addMessageToUI('user', question);

  // Show thinking indicator
  const thinkingMsg = document.createElement('div');
  thinkingMsg.className = 'chat-message';
  thinkingMsg.innerHTML = `
    <div class="chat-message-avatar">🤖</div>
    <div class="chat-message-content">
      <div class="chat-message-label">Assistant</div>
      <div class="chat-message-text">
        <span class="loading-dots">
          <span></span><span></span><span></span>
        </span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(thinkingMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const response = await fetch('/api/chat/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        source_ids: appState.selectedSources,
      }),
    });
    const data = await response.json();

    if (data.success) {
      // Remove thinking indicator
      thinkingMsg.remove();

      // Add assistant response
      addMessageToUI('assistant', data.response, data.citations);

      // Store in history
      appState.chatHistory.push({
        user: question,
        assistant: data.response,
        citations: data.citations,
        tone: data.tone,
        level: data.level,
      });

      // Clear input
      input.value = '';
    } else {
      thinkingMsg.remove();
      showToast(data.error || 'Failed to get response', 'error');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    thinkingMsg.remove();
    showToast('Error sending message', 'error');
  } finally {
    appState.isLoading = false;
    input.disabled = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
  }
}

function addMessageToUI(role, content, citations = []) {
  const messagesContainer = document.getElementById('chat-messages');
  const emptyState = document.getElementById('chat-empty-state');

  // Hide empty state
  emptyState.style.display = 'none';

  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${role}`;

  if (role === 'user') {
    messageEl.innerHTML = `
      <div class="chat-message-avatar">👤</div>
      <div class="chat-message-content">
        <div class="chat-message-text">${escapeHtml(content)}</div>
      </div>
    `;
  } else {
    const renderedContent = md.render(content);
    let citationsHTML = '';

    if (citations && citations.length > 0) {
      const uniqueSources = {};
      citations.forEach((c) => {
        if (c.source) {
          const key = c.source;
          if (!uniqueSources[key]) {
            uniqueSources[key] = c;
          }
        }
      });

      citationsHTML = `
        <div class="chat-message-sources">
          <div class="chat-message-sources-label">Sources</div>
          ${Object.values(uniqueSources)
            .map((c) => {
              let sourceText = c.source.split('/').pop();
              if (c.page) sourceText += ` · p. ${c.page}`;
              if (c.row) sourceText += ` · row ${c.row}`;
              return `<div class="chat-message-source-item">${escapeHtml(sourceText)}</div>`;
            })
            .join('')}
        </div>
      `;
    }

    messageEl.innerHTML = `
      <div class="chat-message-avatar">🤖</div>
      <div class="chat-message-content">
        <div class="chat-message-label">Assistant</div>
        <div class="chat-message-text markdown-content">${renderedContent}</div>
        ${citationsHTML}
      </div>
    `;
  }

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Re-render LaTeX and code highlighting
  renderMathAndCode();

  // Update Lucide icons
  lucide.createIcons();
}

function updateChatUI() {
  const messagesContainer = document.getElementById('chat-messages');
  const emptyState = document.getElementById('chat-empty-state');

  if (appState.chatHistory.length === 0) {
    messagesContainer.innerHTML = '';
    emptyState.style.display = 'flex';
  } else {
    emptyState.style.display = 'none';
  }
}

/* ============================================================================
   MARKDOWN & MATH RENDERING
   ============================================================================ */

function initializeMarkdownRenderer() {
  // Markdown-it is already configured in HTML
}

function renderMathAndCode() {
  // Render LaTeX
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
    });
  }

  // Highlight code blocks
  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/* ============================================================================
   SETTINGS & THEME
   ============================================================================ */

async function updateSettings(tone, level) {
  try {
    const response = await fetch('/api/settings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tone, level }),
    });
    const data = await response.json();

    if (data.success) {
      appState.currentTone = tone;
      appState.currentLevel = level;

      // Update dropdowns
      document.getElementById('tone-selector').value = tone;
      document.getElementById('level-selector').value = level;
      document.getElementById('settings-tone').value = tone;
      document.getElementById('settings-level').value = level;

      showToast('✓ Settings updated', 'success');
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    showToast('Error updating settings', 'error');
  }
}

function toggleTheme() {
  const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function setTheme(theme) {
  appState.theme = theme;
  applyTheme(theme);
  localStorage.setItem('theme', theme);

  // Update settings buttons
  const darkBtn = document.getElementById('theme-dark-btn');
  const lightBtn = document.getElementById('theme-light-btn');
  if (darkBtn) darkBtn.classList.remove('primary');
  if (lightBtn) lightBtn.classList.remove('primary');
  if (theme === 'dark' && darkBtn) {
    darkBtn.classList.add('primary');
  } else if (theme === 'light' && lightBtn) {
    lightBtn.classList.add('primary');
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update theme icon
  const icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'light') {
      icon.innerHTML = `
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      `;
    } else {
      icon.innerHTML = `
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      `;
    }
  }
}

/* ============================================================================
   SESSION MANAGEMENT
   ============================================================================ */

async function resetSession() {
  if (confirm('Are you sure? This will delete all documents and chat history.')) {
    try {
      const response = await fetch('/api/session/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.success) {
        appState.sessionId = data.new_session_id;
        appState.documents = [];
        appState.chatHistory = [];
        appState.selectedSources = [];
        appState.dbInitialized = false;

        renderDocuments();
        updateChatUI();
        updateContextInfo();

        showToast('✓ Notebook reset', 'success');
        closeSettingsModal();
      }
    } catch (error) {
      console.error('Error resetting:', error);
      showToast('Error resetting notebook', 'error');
    }
  }
}

function updateContextInfo() {
  const count = appState.documents ? appState.documents.length : 0;
  const sourcesCountEl = document.getElementById('sources-count');
  if (sourcesCountEl) {
    sourcesCountEl.textContent = `${count} source${count !== 1 ? 's' : ''}`;
  }
  const headerInfoEl = document.getElementById('sources-header-info');
  if (headerInfoEl) {
    headerInfoEl.textContent = `${count} indexed document${count !== 1 ? 's' : ''}`;
  }
}

/* ============================================================================
   MODALS
   ============================================================================ */

function openSettingsModal() {
  // Sync current settings to modal
  const toneEl = document.getElementById('settings-tone');
  if (toneEl) toneEl.value = appState.currentTone;
  const levelEl = document.getElementById('settings-level');
  if (levelEl) levelEl.value = appState.currentLevel;

  // Update theme buttons
  const darkBtn = document.getElementById('theme-dark-btn');
  const lightBtn = document.getElementById('theme-light-btn');
  if (darkBtn) darkBtn.classList.remove('primary');
  if (lightBtn) lightBtn.classList.remove('primary');
  if (appState.theme === 'dark' && darkBtn) {
    darkBtn.classList.add('primary');
  } else if (lightBtn) {
    lightBtn.classList.add('primary');
  }

  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) modal.classList.add('active');
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) modal.classList.remove('active');
}

/* ============================================================================
   TOAST NOTIFICATIONS
   ============================================================================ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  toast.innerHTML = `
    <span>${icons[type]}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.2s ease-out reverse';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

/* ============================================================================
   UTILITY FUNCTIONS
   ============================================================================ */

function getQueryParam(name) {
  const url = new URL(window.location);
  return url.searchParams.get(name);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }

  if (e.key === 'Escape') {
    closeAddSourceModal();
    closeSettingsModal();
    closePreviewModal();
  }
});
