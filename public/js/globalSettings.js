const LS_KEYS = {
    provider: 'ai_provider',
    keys: 'ai_api_keys',     // { gemini, openai, claude }
    models: 'ai_models'      // { gemini, openai, claude }
};

// Global helper to get configuration from localStorage directly (does not require DOM to be loaded)
window.getActiveAIConfig = () => {
    try {
        const provider = localStorage.getItem(LS_KEYS.provider) || 'claude';
        const storedKeys = JSON.parse(localStorage.getItem(LS_KEYS.keys) || '{}');
        const storedModels = JSON.parse(localStorage.getItem(LS_KEYS.models) || '{}');
        const defaultModels = {
            gemini: 'gemini-flash-latest',
            openai: 'gpt-4o-mini',
            claude: 'claude-opus-4-8'
        };
        return {
            provider,
            apiKey: storedKeys[provider] || '',
            model: storedModels[provider] || defaultModels[provider] || ''
        };
    } catch (err) {
        console.warn('Failed to read config from localStorage:', err);
        return { provider: 'claude', apiKey: '', model: '' };
    }
};

let selectedIdeaId = '';
let selectedIdeaTitle = '';

window.getSelectedIdea = () => ({ id: selectedIdeaId, title: selectedIdeaTitle });
window.setSelectedIdea = (id, title) => {
    selectedIdeaId = id;
    selectedIdeaTitle = title;
};

window.initGlobalSettings = function() {
    const keyInputs = {
        gemini: document.getElementById('gemini_api_key'),
        openai: document.getElementById('openai_api_key'),
        claude: document.getElementById('claude_api_key')
    };
    const modelSelects = {
        gemini: document.getElementById('gemini_model'),
        openai: document.getElementById('openai_model_pick'),
        claude: document.getElementById('claude_model')
    };
    const keyStatuses = {
        gemini: document.getElementById('gemini_key_status'),
        openai: document.getElementById('openai_key_status'),
        claude: document.getElementById('claude_key_status')
    };
    const keysStatus = document.getElementById('keys-status');
    const btnClearKeys = document.getElementById('btn-clear-keys');
    const providerSelect = document.getElementById('ai_provider');
    const providerConfigs = document.querySelectorAll('.provider-config');
    const storyTitleInput = document.getElementById('story_title');
    const bgmLocalSelect = document.getElementById('bgm_local');

    function updateKeyStatus(provider) {
        const el = keyStatuses[provider];
        const input = keyInputs[provider];
        if (!el || !input) return;
        if (input.value && input.value.trim()) {
            el.textContent = '✅ Tersimpan di browser.';
            el.style.color = '#10b981';
        } else {
            el.textContent = 'Belum tersimpan.';
            el.style.color = '';
        }
    }

    function updateProviderVisibility() {
        const current = providerSelect ? providerSelect.value : 'claude';
        providerConfigs.forEach(panel => {
            panel.style.display = panel.getAttribute('data-provider') === current ? '' : 'none';
        });
    }

    function saveAPIKey(provider, value) {
        const storedKeys = JSON.parse(localStorage.getItem(LS_KEYS.keys) || '{}');
        if (value && value.trim()) {
            storedKeys[provider] = value.trim();
        } else {
            delete storedKeys[provider];
        }
        localStorage.setItem(LS_KEYS.keys, JSON.stringify(storedKeys));
        updateKeyStatus(provider);
        flashKeysStatus('Token disimpan.');
    }

    function saveModel(provider, value) {
        const storedModels = JSON.parse(localStorage.getItem(LS_KEYS.models) || '{}');
        storedModels[provider] = value;
        localStorage.setItem(LS_KEYS.models, JSON.stringify(storedModels));
    }

    function flashKeysStatus(msg) {
        if (!keysStatus) return;
        keysStatus.textContent = msg;
        clearTimeout(flashKeysStatus._t);
        flashKeysStatus._t = setTimeout(() => { keysStatus.textContent = ''; }, 2000);
    }

    // Load configurations from localStorage into elements
    try {
        const provider = localStorage.getItem(LS_KEYS.provider) || 'claude';
        const storedKeys = JSON.parse(localStorage.getItem(LS_KEYS.keys) || '{}');
        const storedModels = JSON.parse(localStorage.getItem(LS_KEYS.models) || '{}');

        if (providerSelect) providerSelect.value = provider;

        Object.keys(keyInputs).forEach(p => {
            if (keyInputs[p] && storedKeys[p]) {
                keyInputs[p].value = storedKeys[p];
            }
            if (modelSelects[p] && storedModels[p]) {
                const opt = modelSelects[p].querySelector(`option[value="${storedModels[p]}"]`);
                if (opt) modelSelects[p].value = storedModels[p];
            }
            updateKeyStatus(p);
        });

        updateProviderVisibility();
    } catch (err) {
        console.warn('Failed to load stored AI config:', err);
    }

    // Load Local Music list
    async function loadLocalMusic() {
        if (!bgmLocalSelect) return;
        try {
            // Keep option '-- Auto Pick --'
            bgmLocalSelect.innerHTML = '<option value="">-- Auto Pick (Mood-based) --</option>';
            const response = await fetch('/api/bgm/local-list');
            const data = await response.json();
            if (data.success && data.music) {
                data.music.forEach(track => {
                    const option = document.createElement('option');
                    option.value = track.fullPath;
                    option.textContent = `🎵 ${track.name} (${track.category})`;
                    bgmLocalSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Failed to load local music:', err);
        }
    }
    loadLocalMusic();

    // Event listeners
    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            localStorage.setItem(LS_KEYS.provider, providerSelect.value);
            updateProviderVisibility();
        });
    }

    Object.keys(keyInputs).forEach(p => {
        if (keyInputs[p]) {
            keyInputs[p].addEventListener('input', () => saveAPIKey(p, keyInputs[p].value));
        }
        if (modelSelects[p]) {
            modelSelects[p].addEventListener('change', () => saveModel(p, modelSelects[p].value));
        }
    });

    document.querySelectorAll('.toggle-key').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-target');
            const input = document.getElementById(id);
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    if (btnClearKeys) {
        btnClearKeys.addEventListener('click', () => {
            if (!confirm('Hapus semua token API yang tersimpan di browser?')) return;
            localStorage.removeItem(LS_KEYS.keys);
            Object.keys(keyInputs).forEach(p => {
                if (keyInputs[p]) keyInputs[p].value = '';
                updateKeyStatus(p);
            });
            flashKeysStatus('Token dihapus.');
        });
    }

    if (storyTitleInput) {
        storyTitleInput.addEventListener('input', () => {
            if (storyTitleInput.value.trim() !== selectedIdeaTitle.trim()) {
                selectedIdeaId = '';
            }
        });
    }
};
