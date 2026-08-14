/* ===========================
   Global State + Libraries
   =========================== */

const md = window.markdownit({ html: false, linkify: true, typographer: true });
const state = {
    sessionId: null,
    currentTone: 'default',
    currentLevel: 'beginner',
    documents: [],
    chatHistory: [],
    dbInitialized: false,
    isLoading: false,
    selectedSources: new Set()
};

/* ===========================
   Initialization
   =========================== */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Learn with AI...');
    initModals();
    await initializeSession();
    await listDocuments();
    setupEventListeners();
    loadChatHistory();
    setupShortcuts();
});

function initModals(){
    document.querySelectorAll('.modal').forEach(m=>{
        try{ m.setAttribute('aria-hidden','true'); }catch(e){}
        // click outside to close
        m.addEventListener('click',(e)=>{ if(e.target===m) m.setAttribute('aria-hidden','true'); });
    });
    // ESC to close
    window.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ document.querySelectorAll('.modal[aria-hidden="false"]').forEach(x=>x.setAttribute('aria-hidden','true')); } });
}

async function initializeSession() {
    try {
        const response = await fetch('/api/session/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            state.sessionId = data.session_id;
            console.log('Session created:', state.sessionId);
            showToast('Session initialized', 'success');
        }
    } catch (error) {
        console.error('Error creating session:', error);
        showToast('Error initializing session', 'error');
    }
}

function setupEventListeners() {
    // Sidebar btns
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
        btn.classList.add('active');
        const panel = btn.dataset.panel;
        if (panel) showPanel(panel);
    }));

    // File input inside upload modal
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);

    // Upload drop area
    const uploadDrop = document.getElementById('uploadDropArea');
    if (uploadDrop) {
        ['dragenter','dragover','dragleave','drop'].forEach(ev=>uploadDrop.addEventListener(ev, preventDefaults));
        uploadDrop.addEventListener('drop', e=>{ const files = e.dataTransfer.files; document.getElementById('fileInput').files = files; });
        uploadDrop.addEventListener('click', ()=>document.getElementById('fileInput').click());
    }

    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    // Initialize custom dropdowns
    initCustomDropdowns();
    // Ensure lucide icons are rendered for any static elements
    if (window.lucide) try{ lucide.replace(); }catch(e){}
}

function initCustomDropdowns(){
    document.querySelectorAll('.custom-dropdown').forEach(dd=>{
        const trigger = dd.querySelector('.cd-trigger');
        const menu = dd.querySelector('.cd-menu');
        trigger?.addEventListener('click',(e)=>{ e.stopPropagation(); dd.classList.toggle('open'); });
        menu?.querySelectorAll('.cd-item').forEach(item=>{
            item.addEventListener('click',(e)=>{
                const v = item.dataset.value;
                // set label (update existing label span)
                const lab = trigger.querySelector('.cd-label');
                if(lab) lab.textContent = item.textContent;
                dd.classList.remove('open');
                // route selection
                if (dd.id && dd.id.includes('Tone')) selectTone(v);
                if (dd.id && dd.id.includes('Level')) selectLevel(v);
            });
        });
    });
    // close on outside click
    document.addEventListener('click', ()=> document.querySelectorAll('.custom-dropdown.open').forEach(n=>n.classList.remove('open')));
}

function showPanel(name){
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    const el = document.getElementById(name+'Panel'); if (el) el.classList.add('active');
}

// Drag/drop handled by upload modal handlers

/* ===========================
   Tab Navigation
   =========================== */

function switchTab(tabName) {
    // Hide all tabs
    // legacy - not used in new UI
}

/* ===========================
   Setup Tab Functions
   =========================== */

async function selectTone(tone) {
    state.currentTone = tone;
    const sel = document.getElementById('composerTone'); if (sel) sel.value = tone;
    await updateSettings();
}

async function selectLevel(level) {
    state.currentLevel = level;
    const sel = document.getElementById('composerLevel'); if (sel) sel.value = level;
    await updateSettings();
}

async function updateSettings() {
    try {
        const response = await fetch('/api/settings/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tone: state.currentTone,
                level: state.currentLevel
            })
        });

        const data = await response.json();
        if (data.success) {
            showToast(`Settings updated: ${data.tone} tone, ${data.level} level`, 'success');
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        showToast('Error updating settings', 'error');
    }
}

/* ===========================
   Documents Tab Functions
   =========================== */

function handleFileSelect(event) {
    const files = event.target.files || [];
    if (!files || files.length === 0) return;
    uploadFiles(Array.from(files));
}

async function uploadFiles(files) {
    if (!files || files.length === 0) return;
    const formData = new FormData(); files.forEach(f=>formData.append('files', f));
    try {
        const res = await fetch('/api/documents/upload', { method:'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            showToast(`${data.uploaded_files} file(s) uploaded`, 'success');
            closeUploadModal();
            await listDocuments();
            await ingestDocuments();
        } else {
            showToast(data.error || 'Upload failed', 'error');
        }
    } catch (err) { console.error(err); showToast('Error uploading files', 'error'); }
}

async function addWikiLink() {
    const wikiInput = document.getElementById('wikiInput');
    const link = wikiInput.value.trim();

    if (!link) {
        showToast('Please enter a wiki link', 'warning');
        return;
    }

    if (!isValidUrl(link)) {
        showToast('Please enter a valid URL', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('wiki_links', link);

    try {
        const response = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            showToast('Wiki link added', 'success');
            wikiInput.value = '';
            listDocuments();
        }
    } catch (error) {
        console.error('Error adding wiki link:', error);
        showToast('Error adding wiki link', 'error');
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function listDocuments() {
    try {
        const response = await fetch('/api/documents/list');
        const data = await response.json();

        if (data.success) {
            state.documents = data.documents;
            renderSourcesList();
            updateNotebookMeta();
        }
    } catch (error) {
        console.error('Error listing documents:', error);
    }
}

function renderSourcesList(){
    const list = document.getElementById('sourcesList'); if(!list) return;
    if (state.documents.length===0){ list.innerHTML = `<div class="empty-state small"><i data-lucide="inbox"></i><p>No sources yet — add documents or wiki links.</p><button class="btn btn-primary" onclick="openUploadModal()">Add Source</button></div>`; if(window.lucide) try{ lucide.replace(); }catch(e){}; updateSourcesCount(); return; }
    list.innerHTML = '';
    const seen = new Set();
    state.documents.forEach(doc => {
        const key = (doc.path || doc.name || '').toString();
        if(seen.has(key)) return; seen.add(key);
        const card = document.createElement('div'); card.className='source-card';
        if(state.selectedSources.has(key)) card.classList.add('selected');
        const icon = document.createElement('div'); icon.className='document-icon'; icon.innerHTML = doc.type==='wiki'?'<i data-lucide="globe"></i>':getFileIcon(doc.name || doc.path);
        const meta = document.createElement('div'); meta.className='meta';
        const fileType = (doc.name||doc.path||'').split('.').pop().toUpperCase() || (doc.type==='wiki'?'WEB':'FILE');
        const indexed = state.dbInitialized ? 'Indexed' : 'Not indexed';
        meta.innerHTML = `<div class="title">${escapeHtml(doc.name||doc.path)}</div><div class="subtitle">${escapeHtml(fileType)} • ${escapeHtml(indexed)}</div>`;
        const actions = document.createElement('div'); actions.className='source-actions';
        const chk = document.createElement('input'); chk.type='checkbox'; chk.className='source-checkbox'; chk.dataset.path=key; chk.checked = state.selectedSources.has(key);
        chk.addEventListener('change', (e)=>{ if(e.target.checked) state.selectedSources.add(key); else state.selectedSources.delete(key); updateSelectedCount(); renderSourcesList(); });
        const previewBtn = document.createElement('button'); previewBtn.className='icon-btn'; previewBtn.innerHTML='<i data-lucide="eye"></i>'; previewBtn.addEventListener('click', ()=>previewSource(doc));
        const removeBtn = document.createElement('button'); removeBtn.className='icon-btn'; removeBtn.innerHTML='<i data-lucide="trash-2"></i>'; removeBtn.addEventListener('click', ()=>{ removeDocument(doc.name); });
        actions.appendChild(chk); actions.appendChild(previewBtn); actions.appendChild(removeBtn);
        card.appendChild(icon); card.appendChild(meta); card.appendChild(actions); list.appendChild(card);
    }); updateSelectedCount(); updateSourcesCount(); if(window.lucide) try{ lucide.replace(); }catch(e){}

}


function updateSourcesCount(){ const el = document.getElementById('sourcesCount'); if(el) el.textContent = `${state.documents.filter((d,i,a)=> a.findIndex(x=> (x.path||x.name) === (d.path||d.name))===i).length}`; }
function updateSelectedCount(){ const el=document.getElementById('selectedCount'); if(el) el.textContent = `${state.selectedSources.size}`; }

function toggleSourceSelection(checkbox) {
    const name = checkbox.dataset.name;
    if (checkbox.checked) state.selectedSources.add(name); else state.selectedSources.delete(name);
    updateSelectedCount();
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': '<i data-lucide="file-text"></i>',
        'txt': '<i data-lucide="file-text"></i>',
        'csv': '<i data-lucide="table"></i>',
        'json': '<i data-lucide="code"></i>'
    };
    return icons[ext] || '<i data-lucide="file"></i>';
}

async function removeDocument(docName) {
    state.documents = state.documents.filter(doc => doc.name !== docName);
    state.selectedSources.delete(docName);
    renderSourcesList();
    showToast('Document removed locally. Server file remains until cleanup.', 'info');
}

async function ingestDocuments() {
    if (state.documents.length === 0) {
        showToast('No documents to ingest', 'warning');
        return;
    }

    const ingestBtn = document.getElementById('ingestBtn');
    const ingestStatus = document.getElementById('ingestStatus');

    if (ingestBtn) ingestBtn.style.display = 'none';
    if (ingestStatus) ingestStatus.style.display = 'flex';
    state.isLoading = true;

    try {
        const response = await fetch('/api/documents/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            state.dbInitialized = true;
            if (ingestStatus) ingestStatus.style.display = 'none';
            showToast('Documents processed successfully! Ready to chat.', 'success');
            showPanel('chat');
        } else {
            showToast(data.error || 'Error processing documents', 'error');
            if (ingestBtn) ingestBtn.style.display = 'block';
            if (ingestStatus) ingestStatus.style.display = 'none';
        }
    } catch (error) {
        console.error('Error ingesting documents:', error);
        showToast('Error processing documents', 'error');
        if (ingestBtn) ingestBtn.style.display = 'block';
        if (ingestStatus) ingestStatus.style.display = 'none';
    } finally {
        state.isLoading = false;
    }
}

/* ===========================
   Chat Functions
   =========================== */

function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const question = chatInput.value.trim();

    if (!question) {
        showToast('Please enter a question', 'warning');
        return;
    }

    if (!state.dbInitialized) {
        showToast('Please ingest documents first', 'warning');
        return;
    }

    // Add user message to chat
    addChatMessage(question, 'user');
    chatInput.value = '';

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    state.isLoading = true;

    // Update status (if present)
    const statusEl = document.getElementById('statusText'); if (statusEl) statusEl.textContent = 'Thinking...';

    try {
        const res = await fetch('/api/chat/ask', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question, source_ids: Array.from(state.selectedSources) })});
        const data = await res.json();
        if (data.success) {
            addAssistantMessage(data.response, data.citations || []);
            saveToHistory(question, data.response);
            if (statusEl) statusEl.textContent = `${data.tone} • ${data.level} • ${data.sources} sources`;
        } else { addAssistantMessage(`Error: ${data.error}`, []); }
    } catch (error) {
        console.error('Error sending message:', error);
        addAssistantMessage('Sorry, an error occurred. Please try again.', []);
    } finally {
        sendBtn.disabled = false;
        state.isLoading = false;
    }
}

function addChatMessage(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    // remove welcome/empty
    chatMessages.querySelectorAll('.chat-empty').forEach(n=>n.remove());
    const wrapper = document.createElement('div'); wrapper.className = `msg ${sender}`;
    wrapper.innerHTML = `<div class="meta">${sender==='user'?'You':'Assistant'}</div><div class="content">${escapeHtml(message)}</div>`;
    chatMessages.appendChild(wrapper); chatMessages.scrollTop = chatMessages.scrollHeight;
    if(window.lucide) try{ lucide.replace(); }catch(e){}
}

function addAssistantMessage(markdownText, citations){
    const chatMessages = document.getElementById('chatMessages'); chatMessages.querySelectorAll('.chat-empty').forEach(n=>n.remove());
    const wrapper = document.createElement('div'); wrapper.className = 'msg assistant';
    let html = md.render(markdownText||'');
    // KaTeX block replacement
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (m,expr)=>{ try{ return katex.renderToString(expr,{throwOnError:false,displayMode:true}) }catch(e){ return `<pre>${escapeHtml(expr)}</pre>` }});
    wrapper.innerHTML = `<div class="meta">Assistant</div><div class="content">${html}</div>`;
    if (citations && citations.length){ const citEl=document.createElement('div'); citEl.className='citations'; citEl.innerHTML = '<strong>Sources:</strong>' + citations.map((c,i)=>` <a href="#" data-source="${escapeHtml(c.source)}" onclick="previewCitation(event)">[${i+1}] ${escapeHtml(getSourceLabel(c.source))}</a>`).join(', '); wrapper.appendChild(citEl);}    
    chatMessages.appendChild(wrapper);
    chatMessages.querySelectorAll('pre code').forEach(el=>hljs.highlightElement(el));
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if(window.lucide) try{ lucide.replace(); }catch(e){}
}

function previewCitation(e){ e.preventDefault(); const src = e.currentTarget.dataset.source; previewSourceByPath(src); }

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function saveToHistory(question, response) {
    const historyItem = {
        question,
        response,
        timestamp: new Date().toLocaleString(),
        tone: state.currentTone,
        level: state.currentLevel
    };

    state.chatHistory.push(historyItem);
    localStorage.setItem('chatHistory', JSON.stringify(state.chatHistory));
    loadChatHistory();
}

function loadChatHistory() {
    const saved = localStorage.getItem('chatHistory');
    state.chatHistory = saved ? JSON.parse(saved) : [];
    renderHistoryList();
}

function renderHistoryList() {
    const historyList = document.getElementById('historyList');
    const clearBtn = document.getElementById('clearHistoryBtn');

    if (state.chatHistory.length === 0) {
        historyList.innerHTML = `
            <p class="empty-state">
                <i data-lucide="inbox"></i>
                No chat history yet
            </p>
        `;
        if(window.lucide) try{ lucide.replace(); }catch(e){}
        clearBtn.style.display = 'none';
        return;
    }

    clearBtn.style.display = 'block';
    historyList.innerHTML = state.chatHistory.map((item, index) => `
        <div class="history-item" onclick="viewHistoryItem(${index})">
            <div class="history-question">${escapeHtml(item.question)}</div>
            <div class="history-time">${item.timestamp}</div>
        </div>
    `).join('');
}

function viewHistoryItem(index) {
    const item = state.chatHistory[index];
    showPanel('chat');
    setTimeout(()=>{ const chatMessages = document.getElementById('chatMessages'); chatMessages.innerHTML=''; addChatMessage(item.question,'user'); addAssistantMessage(item.response, []); }, 100);
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all chat history?')) {
        state.chatHistory = [];
        localStorage.removeItem('chatHistory');
        renderHistoryList();
        showToast('Chat history cleared', 'success');
    }
}

/* ===========================
   Session Management
   =========================== */

async function resetSession() {
    if (confirm('Are you sure? This will clear all documents and start a new session.')) {
        try {
            const response = await fetch('/api/session/reset', {
                method: 'POST'
            });

            const data = await response.json();
            if (data.success) {
                        state.sessionId = data.new_session_id; state.documents = []; state.dbInitialized = false; state.chatHistory = [];
                        document.getElementById('chatMessages').innerHTML = `<div class="chat-empty"><i data-lucide="robot"></i><h4>Welcome to your notebook</h4><p>Add sources, then ask the AI to start learning.</p></div>`;
                renderSourcesList(); showToast('New session started', 'success'); showPanel('sources');
            }
        } catch (error) {
            console.error('Error resetting session:', error);
            showToast('Error resetting session', 'error');
        }
    }
}

/* ===========================
   Toast Notifications
   =========================== */

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close" onclick="this.parentElement.remove()">✕</button>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

/* -----------------------
    UI Helpers: Modals, Preview, Shortcuts
    ----------------------- */

function openUploadModal(){ document.getElementById('uploadModal').setAttribute('aria-hidden','false'); }
function closeUploadModal(){ document.getElementById('uploadModal').setAttribute('aria-hidden','true'); }
function openPreview(){ document.getElementById('previewModal').setAttribute('aria-hidden','false'); }
function closePreview(){ document.getElementById('previewModal').setAttribute('aria-hidden','true'); }

function previewSource(doc){ if(!doc) return; document.getElementById('previewTitle').textContent = doc.name || doc.path || 'Preview'; const content = document.getElementById('previewContent'); content.innerHTML=''; if(doc.type==='wiki'){ const iframe=document.createElement('iframe'); iframe.src=doc.path; iframe.style.width='100%'; iframe.style.height='100%'; iframe.frameBorder=0; content.appendChild(iframe); } else { const parts=(doc.path||'').split('/'); const name=parts[parts.length-1]; const url=`/uploads/${encodeURIComponent(name)}`; if(name.toLowerCase().endsWith('.pdf')){ content.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:0"></iframe>`; } else { fetch(url).then(r=>r.text()).then(text=>{ const pre=document.createElement('pre'); pre.textContent = text; content.appendChild(pre); }).catch(()=>{ content.textContent='Unable to preview file.' }); } } openPreview(); }

function previewSourceByPath(path){ const doc = state.documents.find(d=> d.path===path || d.name===path || (d.path && d.path.endsWith(path))); if(doc) return previewSource(doc); if(path.startsWith('http')) window.open(path,'_blank'); else { const parts=path.split('/'); const name=parts[parts.length-1]; window.open(`/uploads/${encodeURIComponent(name)}`,'_blank'); } }

function getSourceLabel(path){ if(!path) return ''; const parts=path.split('/'); return parts[parts.length-1]; }

function openSettings(){ showToast('Settings panel coming soon', 'info'); }
function toggleTheme(){ document.body.classList.toggle('dark'); }

function setupShortcuts(){ window.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); document.getElementById('globalSearch')?.focus(); } if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='b'){ document.querySelector('.sidebar')?.classList.toggle('collapsed'); } }); }

// Use deduplicated count for header display
function updateNotebookMeta(){ const unique = state.documents.filter((d,i,a)=> a.findIndex(x=> (x.path||x.name) === (d.path||d.name))===i).length; const el = document.getElementById('notebookSubtitle'); if(el) el.textContent = `• ${unique} sources`; }

function preventDefaults(e){ e.preventDefault(); e.stopPropagation(); }

// Upload modal helper: called from template
function startUpload(){ const input = document.getElementById('fileInput'); if(!input) return; const files = Array.from(input.files || []); if(files.length===0){ showToast('No files selected', 'warning'); return; } uploadFiles(files); closeUploadModal(); }

// Composer / Studio stubs
function stopGeneration(){ showToast('Stop generation requested (not implemented)', 'info'); }
function openStudioCreate(){ showToast('Studio creation is coming soon', 'info'); }

/* ===========================
   Utility Functions
   =========================== */

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

console.log('Learn with AI script loaded successfully');