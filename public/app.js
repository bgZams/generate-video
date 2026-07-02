document.addEventListener('DOMContentLoaded', () => {
    const slidesContainer = document.getElementById('slides-container');
    const btnAddSlide = document.getElementById('btn-add-slide');
    const form = document.getElementById('video-form');
    const storyTitleInput = document.getElementById('story_title');
    const modelSelect = document.getElementById('openai_model');
    const ideaTopicInput = document.getElementById('idea_topic');
    const ideaCountInput = document.getElementById('idea_count');
    const btnGenerateIdeas = document.getElementById('btn-generate-ideas');
    const btnRefreshHistory = document.getElementById('btn-refresh-history');
    const ideaStatus = document.getElementById('idea-status');
    const ideaResults = document.getElementById('idea-results');
    const historyResults = document.getElementById('history-results');
    const narratorVoiceSelect = document.getElementById('narrator_voice');
    const narratorSpeedSelect = document.getElementById('narrator_speed');

    let slideCount = document.querySelectorAll('.slide-item').length;
    let selectedIdeaId = '';
    let selectedIdeaTitle = '';
    let voiceSelection = 'shimmer';
    let speedSelection = 1.0;

    // ===== VIDEO MODE STATE =====
    const VIDEO_MODE_PRESETS = {
        short:  { slideCount: 9,  maxDurationSec: 58,  resolutionDefault: '9:16',  label: 'Shorts / Reels' },
        medium: { slideCount: 25, maxDurationSec: 300, resolutionDefault: '16:9',  label: 'Video Standar (2-5 menit)' },
        long:   { slideCount: 50, maxDurationSec: 900, resolutionDefault: '16:9',  label: 'Video Panjang (5-15 menit)' }
    };
    const ESTIMATOR_TEXTS = {
        short:  { slides: '9 slides', est: '30–58 detik' },
        medium: { slides: '25 slides', est: '2–5 menit' },
        long:   { slides: '50 slides', est: '5–15 menit' }
    };
    let currentVideoMode = 'short';

    function updateEstimator(mode) {
        const info = ESTIMATOR_TEXTS[mode] || ESTIMATOR_TEXTS.short;
        const preset = VIDEO_MODE_PRESETS[mode] || VIDEO_MODE_PRESETS.short;
        const el = document.getElementById('estimator-text');
        if (el) el.innerHTML = `Mode: <strong>${VIDEO_MODE_PRESETS[mode]?.label || mode}</strong> — ~${info.slides}, estimasi <strong>${info.est}</strong>`;
        // Auto-update resolution
        const resEl = document.getElementById('resolution');
        if (resEl) resEl.value = preset.resolutionDefault;
    }

    // Mode card click handler
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentVideoMode = card.dataset.mode;
            updateEstimator(currentVideoMode);
        });
    });

    updateEstimator('short'); // init

    // ===== SSE PROGRESS TRACKING =====
    let progressSSE = null;

    function updateProgressUI(phase, pct, message) {
        const fillEl = document.getElementById('progress-bar-fill');
        const pctEl = document.getElementById('progress-pct');
        const txtEl = document.getElementById('progress-text');
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
        if (txtEl) txtEl.textContent = message || 'Memproses...';

        // Update phase indicators
        const phaseOrder = ['tts', 'image', 'render', 'bgm', 'thumbnail', 'done'];
        const activeIdx = phaseOrder.indexOf(phase);
        document.querySelectorAll('.phase-item').forEach((el, i) => {
            el.classList.remove('active', 'done');
            if (i < activeIdx) el.classList.add('done');
            else if (i === activeIdx) el.classList.add('active');
        });
    }

    function startProgressSSE(jobId) {
        if (progressSSE) { progressSSE.close(); progressSSE = null; }
        if (!jobId) return;
        progressSSE = new EventSource(`/api/job/${jobId}/progress`);
        progressSSE.onmessage = (ev) => {
            try {
                const { phase, pct, message } = JSON.parse(ev.data);
                updateProgressUI(phase, pct, message);
                if (phase === 'done') {
                    progressSSE.close();
                    progressSSE = null;
                }
            } catch (_) {}
        };
        progressSSE.onerror = () => {
            progressSSE.close();
            progressSSE = null;
        };
    }

    // ===== AI PROVIDER / API KEY PERSISTENCE =====
    const LS_KEYS = {
        provider: 'ai_provider',
        keys: 'ai_api_keys',     // { gemini, openai, claude }
        models: 'ai_models'      // { gemini, openai, claude }
    };

    const providerSelect = document.getElementById('ai_provider');
    const providerConfigs = document.querySelectorAll('.provider-config');
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

    function loadStoredAIConfig() {
        try {
            const provider = localStorage.getItem(LS_KEYS.provider) || 'gemini';
            const storedKeys = JSON.parse(localStorage.getItem(LS_KEYS.keys) || '{}');
            const storedModels = JSON.parse(localStorage.getItem(LS_KEYS.models) || '{}');

            if (providerSelect) providerSelect.value = provider;

            Object.keys(keyInputs).forEach(p => {
                if (keyInputs[p] && storedKeys[p]) {
                    keyInputs[p].value = storedKeys[p];
                }
                if (modelSelects[p] && storedModels[p]) {
                    // Only set if option exists
                    const opt = modelSelects[p].querySelector(`option[value="${storedModels[p]}"]`);
                    if (opt) modelSelects[p].value = storedModels[p];
                }
                updateKeyStatus(p);
            });

            updateProviderVisibility();
        } catch (err) {
            console.warn('Failed to load AI config from localStorage:', err);
        }
    }

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
        const current = providerSelect ? providerSelect.value : 'gemini';
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

    function getActiveAIConfig() {
        const provider = providerSelect ? providerSelect.value : 'gemini';
        const apiKey = keyInputs[provider] ? keyInputs[provider].value.trim() : '';
        const model = modelSelects[provider] ? modelSelects[provider].value : '';
        return { provider, apiKey, model };
    }

    // Event wiring
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

    loadStoredAIConfig();

    // Initialize Local Music Dropdown
    const bgmLocalSelect = document.getElementById('bgm_local');
    async function loadLocalMusic() {
        if (!bgmLocalSelect) return;
        try {
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

    function createSlideHTML(slideIndex) {
        return `
            <div class="glass-panel slide-item" data-index="${slideIndex}">
                <div class="slide-header">
                    <h3>Slide ${slideIndex + 1}</h3>
                    <button type="button" class="btn-icon delete-slide">&times;</button>
                </div>
                <div class="form-group">
                    <label>Narration Text & Subtitles</label>
                    <textarea name="slide_text_${slideIndex}" placeholder="Type the text you want the AI voice to speak..."></textarea>
                    <div class="audio-controls" style="margin-top: 10px;">
                        <button type="button" class="btn-secondary generate-audio" data-slide="${slideIndex}">
                            🎙️ Generate Voice
                        </button>
                        <audio class="slide-audio-${slideIndex}" controls style="display:none; width:100%; margin-top:8px;"></audio>
                    </div>
                </div>
                <div class="form-group">
                    <label>Background Image</label>
                    <div class="image-source-tabs">
                        <label class="tab-option active">
                            <input type="radio" name="slide_imgsrc_${slideIndex}" value="auto" checked>
                            <span>Auto</span>
                        </label>
                        <label class="tab-option">
                            <input type="radio" name="slide_imgsrc_${slideIndex}" value="upload">
                            <span>Upload</span>
                        </label>
                        <label class="tab-option">
                            <input type="radio" name="slide_imgsrc_${slideIndex}" value="url">
                            <span>URL</span>
                        </label>
                        <label class="tab-option">
                            <input type="radio" name="slide_imgsrc_${slideIndex}" value="ref">
                            <span>Same as...</span>
                        </label>
                    </div>
                    <div class="image-input-area" data-mode="auto">
                        <div class="auto-search-info">
                            <small>Image will be automatically searched based on your narration text above.</small>
                        </div>
                        <div class="upload-area" style="display:none;">
                            <input type="file" name="slide_img_${slideIndex}" accept="image/*">
                        </div>
                        <div class="url-area" style="display:none;">
                            <input type="url" name="slide_url_${slideIndex}" placeholder="https://domain.com/image.jpg">
                        </div>
                        <div class="ref-area" style="display:none;">
                            <select name="slide_ref_${slideIndex}" class="ref-select">
                                <option value="">-- Pilih Slide --</option>
                            </select>
                            <small>Gambar yang sama akan digunakan, tapi dengan efek gerak berbeda agar tetap dinamis.</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function setupTabSwitching(slideEl) {
        const tabs = slideEl.querySelectorAll('.tab-option');
        const inputArea = slideEl.querySelector('.image-input-area');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(item => item.classList.remove('active'));
                tab.classList.add('active');

                const mode = tab.querySelector('input[type="radio"]').value;
                inputArea.setAttribute('data-mode', mode);
                inputArea.querySelector('.auto-search-info').style.display = mode === 'auto' ? '' : 'none';
                inputArea.querySelector('.upload-area').style.display = mode === 'upload' ? '' : 'none';
                inputArea.querySelector('.url-area').style.display = mode === 'url' ? '' : 'none';
                inputArea.querySelector('.ref-area').style.display = mode === 'ref' ? '' : 'none';
            });
        });
    }

    function initializeAllSlides() {
        document.querySelectorAll('.slide-item').forEach(slide => setupTabSwitching(slide));
        updateDeleteButtons();
        updateSlideHeaders();
        updateRefDropdowns();
    }

    function updateRefDropdowns() {
        const allSlides = document.querySelectorAll('.slide-item');
        const slideLabels = [];

        allSlides.forEach((slide, index) => {
            slideLabels.push({ index, label: `Slide ${index + 1}` });
        });

        allSlides.forEach((slideEl, currentIndex) => {
            const refSelect = slideEl.querySelector('.ref-select');
            if (!refSelect) {
                return;
            }

            const currentValue = refSelect.value;
            refSelect.innerHTML = '<option value="">-- Pilih Slide --</option>';

            slideLabels.forEach(slide => {
                if (slide.index === currentIndex) {
                    return;
                }

                const option = document.createElement('option');
                option.value = slide.index;
                option.textContent = slide.label;
                refSelect.appendChild(option);
            });

            if (currentValue && refSelect.querySelector(`option[value="${currentValue}"]`)) {
                refSelect.value = currentValue;
            }
        });
    }

    function updateDeleteButtons() {
        const deleteBtns = document.querySelectorAll('.delete-slide');
        if (deleteBtns.length === 1) {
            deleteBtns[0].disabled = true;
            return;
        }

        deleteBtns.forEach(button => {
            button.disabled = false;
        });
    }

    function updateSlideHeaders() {
        const slides = document.querySelectorAll('.slide-item');
        slides.forEach((slide, index) => {
            slide.querySelector('h3').textContent = `Slide ${index + 1}`;
        });
    }

    function appendSlides(countToAdd) {
        for (let index = 0; index < countToAdd; index += 1) {
            const nextIndex = slideCount;
            slideCount = document.querySelectorAll('.slide-item').length;
            slidesContainer.insertAdjacentHTML('beforeend', createSlideHTML(nextIndex));
            setupTabSwitching(slidesContainer.lastElementChild);
            slideCount += 1;
        }

        updateDeleteButtons();
        updateSlideHeaders();
        updateRefDropdowns();
    }

        function ensureSlideCount(targetCount) {
        const currentSlides = document.querySelectorAll('.slide-item');

        if (currentSlides.length < targetCount) {
            appendSlides(targetCount - currentSlides.length);
            slideCount = document.querySelectorAll('.slide-item').length;
        } else if (currentSlides.length > targetCount) {
            Array.from(currentSlides)
                .slice(targetCount)
                .forEach(slide => slide.remove());

            slideCount = document.querySelectorAll('.slide-item').length;
            updateDeleteButtons();
            updateSlideHeaders();
            updateRefDropdowns();
        }
    }

    function getSlidePanels() {
        return Array.from(document.querySelectorAll('.slide-item'));
    }

    function setIdeaStatus(message, isError = false) {
        ideaStatus.textContent = message;
        ideaStatus.classList.toggle('error-text', isError);
    }

    function setIdeaLoading(isLoading) {
        btnGenerateIdeas.disabled = isLoading;
        btnGenerateIdeas.textContent = isLoading ? 'Generating...' : 'Generate Judul & Narasi';
    }

    async function handleGenerateAudio(slideIndex, narrationText) {
        const generateBtn = document.querySelector(`.generate-audio[data-slide="${slideIndex}"]`);
        const audioContainer = document.querySelector(`.slide-audio-${slideIndex}`);

        if (!narrationText || !narrationText.trim()) {
            alert('Please enter narration text first.');
            return;
        }

        const originalText = generateBtn.textContent;
        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Generating...';

        try {
            const response = await fetch('/api/tts/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: narrationText,
                    voice: voiceSelection,
                    speed: parseFloat(speedSelection)
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate audio');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            audioContainer.src = audioUrl;
            audioContainer.style.display = 'block';
            generateBtn.textContent = '✅ Audio Ready';
            
            setTimeout(() => {
                generateBtn.textContent = originalText;
                generateBtn.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('Audio generation error:', error);
            alert(`Error: ${error.message}`);
            generateBtn.textContent = originalText;
            generateBtn.disabled = false;
        }
    }

    function createIdeaCard(item, { showApplyButton }) {
        const card = document.createElement('article');
        card.className = 'idea-card';
        card.dataset.ideaId = item.id || '';

        const badgeText = item.isUsed ? `Sudah dipakai ${item.useCount || 1}x` : 'Belum dipakai';
        const narrationHtml = (item.narrationSegments || [])
            .map((segment, index) => `<li><strong>Slide ${index + 1}:</strong> ${segment}</li>`)
            .join('');

        card.innerHTML = `
            <div class="idea-card-header">
                <div>
                    <h4>${item.title}</h4>
                    <p>${item.summary || 'Tanpa ringkasan tambahan.'}</p>
                </div>
                <span class="idea-badge ${item.isUsed ? 'used' : 'fresh'}">${badgeText}</span>
            </div>
            <ul class="idea-narration">${narrationHtml || '<li>Narasi belum tersedia.</li>'}</ul>
            <div class="idea-meta">
                <span>${item.slideCount || item.narrationSegments.length || 0} slide</span>
                <span>${item.model || '-'}</span>
            </div>
        `;

        if (showApplyButton) {
            const actions = document.createElement('div');
            actions.className = 'idea-card-actions';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn-secondary';
            button.textContent = 'Pakai ke Slide';
            button.addEventListener('click', () => applyIdeaToSlides(item));

            actions.appendChild(button);
            card.appendChild(actions);
        }

        return card;
    }

    function renderIdeaList(container, items, options = {}) {
        container.innerHTML = '';

        if (!items || !items.length) {
            container.classList.add('empty-state');
            container.textContent = options.emptyText || 'Belum ada data.';
            return;
        }

        container.classList.remove('empty-state');
        items.forEach(item => {
            container.appendChild(createIdeaCard(item, options));
        });
    }

    function applyIdeaToSlides(item) {
        const segments = Array.isArray(item.narrationSegments) ? item.narrationSegments : [];
        ensureSlideCount(segments.length || 1);

        storyTitleInput.value = item.title || '';
        selectedIdeaId = item.id || '';
        selectedIdeaTitle = item.title || '';

        getSlidePanels().forEach((panel, index) => {
            const textarea = panel.querySelector('textarea');
            if (textarea) {
                textarea.value = segments[index] || '';
            }
            
            // Reset to Auto search when applying new AI idea
            const autoRadio = panel.querySelector('input[value="auto"]');
            if (autoRadio) {
                autoRadio.checked = true;
                const changeEvent = new Event('change', { bubbles: true });
                autoRadio.dispatchEvent(changeEvent);
            }
        });

        updateRefDropdowns();

        setIdeaStatus(`Judul "${item.title}" sudah dimasukkan ke slide.`);
        window.scrollTo({ top: form.offsetTop, behavior: 'smooth' });
    }

    async function loadHistory() {
        try {
            historyResults.textContent = 'Memuat histori judul...';
            historyResults.classList.add('empty-state');

            const response = await fetch('/api/narration/history');
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Gagal memuat histori.');
            }

            renderIdeaList(historyResults, data.items, {
                showApplyButton: true,
                emptyText: 'Belum ada histori judul.'
            });
        } catch (error) {
            historyResults.classList.add('empty-state');
            historyResults.textContent = error.message || 'Gagal memuat histori.';
        }
    }

    async function handleGenerateIdeas() {
        const preset = VIDEO_MODE_PRESETS[currentVideoMode] || VIDEO_MODE_PRESETS.short;
        const slideTarget = preset.slideCount;
        const topic = ideaTopicInput.value.trim();
        const count = Math.max(1, Math.min(10, parseInt(ideaCountInput.value, 10) || 5));

        setIdeaLoading(true);
        setIdeaStatus(`AI sedang membuat ${count} judul + narasi [mode: ${currentVideoMode}]...`);

        try {
            const aiCfg = getActiveAIConfig();
            if (!aiCfg.apiKey) {
                throw new Error(`API key ${aiCfg.provider.toUpperCase()} belum diisi. Masukkan di panel AI di atas.`);
            }

            const response = await fetch('/api/narration/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    count,
                    slideCount: slideTarget,
                    provider: aiCfg.provider,
                    apiKey: aiCfg.apiKey,
                    model: aiCfg.model || modelSelect.value,
                    videoMode: currentVideoMode
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Gagal generate ide.');
            }

            renderIdeaList(ideaResults, data.ideas, {
                showApplyButton: true,
                emptyText: 'Belum ada hasil.'
            });
            renderIdeaList(historyResults, data.history || [], {
                showApplyButton: true,
                emptyText: 'Belum ada histori judul.'
            });

            // AUTO-APPLY FIRST IDEA TO SLIDES
            if (data.ideas && data.ideas.length > 0) {
                const firstIdea = data.ideas[0];
                applyIdeaToSlides(firstIdea);
                setIdeaStatus(`✓ Slide otomatis diisi dengan ide pertama. Ada ${data.ideas.length} ide alternatif lain di bawah.`);
            } else {
                setIdeaStatus(`${data.ideas.length} ide berhasil dibuat untuk ${slideTarget} slide.`);
            }
        } catch (error) {
            setIdeaStatus(error.message || 'Gagal generate ide.', true);
        } finally {
            setIdeaLoading(false);
        }
    }

    initializeAllSlides();
    loadHistory();

    if (btnAddSlide) {
        btnAddSlide.addEventListener('click', () => {
            const countInput = document.getElementById('slide-count-input');
            const count = Math.max(1, Math.min(50, parseInt(countInput.value, 10) || 1));
            appendSlides(count);
        });
    }

    slidesContainer.addEventListener('click', event => {
        if (!event.target.classList.contains('delete-slide')) {
            return;
        }

        const slideItem = event.target.closest('.slide-item');
        if (!slideItem || slidesContainer.children.length <= 1) {
            return;
        }

        slideItem.remove();
        slideCount = document.querySelectorAll('.slide-item').length;
        updateSlideHeaders();
        updateDeleteButtons();
        updateRefDropdowns();
    });

    if (storyTitleInput) {
        storyTitleInput.addEventListener('input', () => {
            if (storyTitleInput.value.trim() !== selectedIdeaTitle.trim()) {
                selectedIdeaId = '';
            }
        });
    }

    if (btnGenerateIdeas) btnGenerateIdeas.addEventListener('click', handleGenerateIdeas);
    if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', loadHistory);

    // Voice and speed selection
    if (narratorVoiceSelect) {
        narratorVoiceSelect.addEventListener('change', (e) => {
            voiceSelection = e.target.value;
        });
    }
    if (narratorSpeedSelect) {
        narratorSpeedSelect.addEventListener('change', (e) => {
            speedSelection = parseFloat(e.target.value);
        });
    }

    // Generate audio button listener (event delegation)
    if (slidesContainer) {
        slidesContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('generate-audio')) {
                const slideIndex = parseInt(event.target.dataset.slide, 10);
                const slidePanel = document.querySelector(`.slide-item[data-index="${slideIndex}"]`);
                const textarea = slidePanel.querySelector('textarea');
                const narrationText = textarea.value.trim();
                
                handleGenerateAudio(slideIndex, narrationText);
            }
        });
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const formData = new FormData(form);

        // Pro Shorts toggles
        const proCaptions       = document.getElementById('pro_captions');
        const proCaptionChunk   = document.getElementById('pro_caption_chunk');
        const proCaptionAccent  = document.getElementById('pro_caption_accent');
        const proTransitions    = document.getElementById('pro_transitions');
        const proProgressBar    = document.getElementById('pro_progress_bar');
        const proAutoThumbnail  = document.getElementById('pro_auto_thumbnail');

        const config = {
            resolution: formData.get('resolution'),
            bgmMood: formData.get('bgm_mood') || 'upbeat',
            localBgmPath: formData.get('bgm_local') || null,
            visualEffect: formData.get('visual_effect') || 'none',
            vignette: formData.get('vignette') === 'on',
            storyTitle: (formData.get('story_title') || '').trim(),
            storyIdeaId: selectedIdeaId || '',
            videoMode: currentVideoMode,
            // Pro pipeline flags (defaults = ON to match backend)
            captions:           proCaptions       ? proCaptions.checked       : true,
            captionChunkSize:   proCaptionChunk   ? parseInt(proCaptionChunk.value, 10) || 2 : 2,
            captionAccent:      proCaptionAccent  ? proCaptionAccent.value    : 'yellow',
            transitions:        proTransitions    ? proTransitions.checked    : true,
            progressBar:        proProgressBar    ? proProgressBar.checked    : true,
            generateThumbnail:  proAutoThumbnail  ? proAutoThumbnail.checked  : true,
            slides: []
        };

        const finalFormData = new FormData();
        const bgmFile = formData.get('bgm_audio');

        if (bgmFile && bgmFile.size > 0) {
            finalFormData.append('bgm_audio', bgmFile);
        }

        getSlidePanels().forEach(panel => {
            const idx = panel.getAttribute('data-index');
            const inputArea = panel.querySelector('.image-input-area');
            const mode = inputArea.getAttribute('data-mode');
            const text = formData.get(`slide_text_${idx}`);
            const imgUrl = formData.get(`slide_url_${idx}`);
            const imgFile = formData.get(`slide_img_${idx}`);
            const refSlide = formData.get(`slide_ref_${idx}`);

            const slideConfig = {
                text: text || '',
                imageSource: mode,
                imageUrl: mode === 'url' ? (imgUrl || '') : '',
                refSlide: mode === 'ref' ? parseInt(refSlide, 10) : null
            };

            if (mode === 'upload' && imgFile && imgFile.size > 0) {
                finalFormData.append(`slide_img_${config.slides.length}`, imgFile);
            }

            config.slides.push(slideConfig);
        });

        finalFormData.append('payload', JSON.stringify(config));

        // Reset progress UI
        updateProgressUI('starting', 2, 'Memulai proses render...');
        document.getElementById('progress-overlay').style.display = 'flex';
        document.getElementById('btn-generate').disabled = true;
        document.querySelector('.btn-text').textContent = 'Generating...';
        document.querySelector('.spinner').style.display = 'inline-block';
        document.getElementById('result-container').style.display = 'none';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                body: finalFormData
            });

            // Grab jobId from response header for SSE progress
            const jobId = response.headers.get('X-Job-Id');
            if (jobId) startProgressSSE(jobId);

            const data = await response.json();

            if (response.ok && data.success) {
                const videoURL = data.videoUrl;
                const resultVideo = document.getElementById('result-video');

                resultVideo.src = `${videoURL}?t=${new Date().getTime()}`;
                document.getElementById('download-btn').href = videoURL;
                document.getElementById('result-container').style.display = 'block';

                // Show auto-generated thumbnail if present
                const thumbWrapper = document.getElementById('result-thumbnail-wrapper');
                const thumbImg     = document.getElementById('result-thumbnail');
                const thumbDl      = document.getElementById('thumbnail-download-btn');
                if (thumbWrapper && thumbImg) {
                    if (data.thumbnailUrl) {
                        thumbImg.src = `${data.thumbnailUrl}?t=${Date.now()}`;
                        if (thumbDl) thumbDl.href = data.thumbnailUrl;
                        thumbWrapper.style.display = 'block';
                    } else {
                        thumbWrapper.style.display = 'none';
                    }
                }

                document.getElementById('result-container').scrollIntoView({ behavior: 'smooth' });

                if (data.usedTitle) {
                    selectedIdeaId = data.usedTitle.id || selectedIdeaId;
                    selectedIdeaTitle = data.usedTitle.title || storyTitleInput.value.trim();
                }

                await loadHistory();
            } else {
                alert(`Error: ${data.error || 'Unknown error occurred.'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to connect to the server.');
        } finally {
            document.getElementById('progress-overlay').style.display = 'none';
            document.getElementById('btn-generate').disabled = false;
            document.querySelector('.btn-text').textContent = '🎬 Generate Video';
            document.querySelector('.spinner').style.display = 'none';
            if (progressSSE) { progressSSE.close(); progressSSE = null; }
        }
    });

    // ===== AUTOMATION & YOUTUBE LOGIC =====
    const schedulerStatusBadge = document.getElementById('scheduler-status-badge');
    const youtubeStatusBadge = document.getElementById('youtube-status-badge');
    const btnToggleScheduler = document.getElementById('btn-toggle-scheduler');
    const btnConnectYoutube = document.getElementById('btn-connect-youtube');
    const btnDisconnectYoutube = document.getElementById('btn-disconnect-youtube');

    function renderPlatformStatus({ isAuth, profile, badgeId, connectId, disconnectId, infoId, nameId, connectLabel, reconnectLabel, profilePrefix }) {
        const badge = document.getElementById(badgeId);
        const connectBtn = document.getElementById(connectId);
        const disconnectBtn = document.getElementById(disconnectId);
        const info = document.getElementById(infoId);
        const nameEl = document.getElementById(nameId);
        if (!badge) return;
        if (isAuth) {
            badge.textContent = 'CONNECTED';
            badge.className = 'badge badge-on';
            if (connectBtn) connectBtn.textContent = reconnectLabel;
            if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
            if (info && nameEl && profile) {
                nameEl.textContent = `${profilePrefix}: ${profile.title}`;
                info.style.display = 'flex';
            }
        } else {
            badge.textContent = 'DISCONNECTED';
            badge.className = 'badge badge-off';
            if (connectBtn) connectBtn.textContent = connectLabel;
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (info) info.style.display = 'none';
        }
    }

    async function openOAuthWindow(urlEndpoint, statusKey, label) {
        try {
            const response = await fetch(urlEndpoint);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error while getting auth URL');
            }
            const data = await response.json();
            if (!data.success || !data.url) {
                alert(`Gagal mendapatkan URL autentikasi ${label}.`);
                return;
            }
            window.open(data.url, '_blank');
            alert(`Halaman autentikasi ${label} terbuka di tab baru. Izinkan aplikasi lalu kembali ke sini.`);
            const pollInterval = setInterval(async () => {
                const statusRes = await fetch('/api/scheduler/status');
                const statusData = await statusRes.json();
                if (statusData[statusKey]) {
                    updateSchedulerUI();
                    clearInterval(pollInterval);
                }
            }, 5000);
        } catch (error) {
            console.error(`Failed to get ${label} auth URL:`, error);
            alert(`Gagal menghubungkan ke ${label}: ${error.message}`);
        }
    }

    async function disconnectPlatform(endpoint, label) {
        if (!confirm(`Putuskan koneksi ${label}?`)) return;
        try {
            const response = await fetch(endpoint, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                await updateSchedulerUI();
                alert(`Koneksi ${label} diputuskan.`);
            } else {
                alert(`Gagal memutuskan ${label}: ` + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error(`Failed to disconnect ${label}:`, error);
            alert('Error saat menghubungi server: ' + error.message);
        }
    }
    const btnSaveScheduler = document.getElementById('btn-save-scheduler');
    const btnRunNow = document.getElementById('btn-run-now');
    const schedulerTopicInput = document.getElementById('scheduler-topic');
    const schedulerCronInput = document.getElementById('scheduler-cron');
    const schedulerPrivacySelect = document.getElementById('scheduler-privacy');

    async function updateSchedulerUI() {
        try {
            const response = await fetch('/api/scheduler/status');
            const data = await response.json();
            if (data.success) {
                const config = data.status;
                
                // Update Badge
                if (schedulerStatusBadge) {
                    if (config.enabled) {
                        schedulerStatusBadge.textContent = 'ON';
                        schedulerStatusBadge.className = 'badge badge-on';
                        if (btnToggleScheduler) btnToggleScheduler.textContent = 'Disable Scheduler';
                    } else {
                        schedulerStatusBadge.textContent = 'OFF';
                        schedulerStatusBadge.className = 'badge badge-off';
                        if (btnToggleScheduler) btnToggleScheduler.textContent = 'Enable Scheduler';
                    }
                }

                // Update YouTube Badge
                if (youtubeStatusBadge) {
                    if (data.isYouTubeAuthenticated) {
                        youtubeStatusBadge.textContent = 'CONNECTED';
                        youtubeStatusBadge.className = 'badge badge-on';
                        if (btnConnectYoutube) btnConnectYoutube.textContent = 'Re-connect YouTube';
                        if (btnDisconnectYoutube) btnDisconnectYoutube.style.display = 'inline-block';

                        // Show channel info
                        const channelInfo = document.getElementById('youtube-channel-info');
                        const channelName = document.getElementById('youtube-channel-name');
                        if (channelInfo && channelName && data.youtubeProfile) {
                            channelName.textContent = `Channel: ${data.youtubeProfile.title}`;
                            channelInfo.style.display = 'flex';
                        }
                    } else {
                        youtubeStatusBadge.textContent = 'DISCONNECTED';
                        youtubeStatusBadge.className = 'badge badge-off';
                        if (btnConnectYoutube) btnConnectYoutube.textContent = 'Connect YouTube';
                        if (btnDisconnectYoutube) btnDisconnectYoutube.style.display = 'none';

                        const channelInfo = document.getElementById('youtube-channel-info');
                        if (channelInfo) channelInfo.style.display = 'none';
                    }
                }

                renderPlatformStatus({
                    isAuth: data.isFacebookAuthenticated,
                    profile: data.facebookProfile,
                    badgeId: 'facebook-status-badge',
                    connectId: 'btn-connect-facebook',
                    disconnectId: 'btn-disconnect-facebook',
                    infoId: 'facebook-page-info',
                    nameId: 'facebook-page-name',
                    connectLabel: 'Connect Facebook',
                    reconnectLabel: 'Re-connect Facebook',
                    profilePrefix: 'Page'
                });
                renderPlatformStatus({
                    isAuth: data.isTiktokAuthenticated,
                    profile: data.tiktokProfile,
                    badgeId: 'tiktok-status-badge',
                    connectId: 'btn-connect-tiktok',
                    disconnectId: 'btn-disconnect-tiktok',
                    infoId: 'tiktok-user-info',
                    nameId: 'tiktok-user-name',
                    connectLabel: 'Connect TikTok',
                    reconnectLabel: 'Re-connect TikTok',
                    profilePrefix: 'User'
                });

                // Update Form
                if (schedulerTopicInput) schedulerTopicInput.value = config.topic || '';
                if (schedulerCronInput) schedulerCronInput.value = config.schedule || '';
                if (schedulerPrivacySelect) schedulerPrivacySelect.value = config.privacyStatus || 'private';
                
                const schedEffect = document.getElementById('scheduler-effect');
                const schedVignette = document.getElementById('scheduler-vignette');
                if (schedEffect) schedEffect.value = config.visualEffect || 'none';
                if (schedVignette) schedVignette.checked = !!config.vignette;
            } else {
                console.error('Failed to fetch scheduler status: data.success is false');
            }
        } catch (error) {
            console.error('Failed to fetch scheduler status:', error);
        }
    }

    if (btnToggleScheduler) {
        btnToggleScheduler.addEventListener('click', async () => {
            if (!schedulerStatusBadge) return;
            const isCurrentlyEnabled = schedulerStatusBadge.textContent === 'ON';
            await saveSchedulerConfig({ enabled: !isCurrentlyEnabled });
        });
    }

    if (btnSaveScheduler) {
        btnSaveScheduler.addEventListener('click', async () => {
            const schedEffect = document.getElementById('scheduler-effect');
            const schedVignette = document.getElementById('scheduler-vignette');
            
            await saveSchedulerConfig({
                topic: schedulerTopicInput.value,
                schedule: schedulerCronInput.value,
                privacyStatus: schedulerPrivacySelect.value,
                visualEffect: schedEffect ? schedEffect.value : 'none',
                vignette: schedVignette ? schedVignette.checked : false
            });
            alert('Pengaturan jadwal berhasil disimpan!');
        });
    }

    async function saveSchedulerConfig(config) {
        try {
            const response = await fetch('/api/scheduler/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await response.json();
            if (data.success) {
                updateSchedulerUI();
            } else {
                alert('Gagal menyimpan konfigurasi: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to save scheduler config:', error);
            alert('Error saat menghubungi server: ' + error.message);
        }
    }

    if (btnRunNow) {
        btnRunNow.addEventListener('click', async () => {
            const scheduleTimeInput = document.getElementById('manual-schedule-time');
            let publishAt = null;
            
            if (scheduleTimeInput && scheduleTimeInput.value) {
                publishAt = new Date(scheduleTimeInput.value).toISOString();
                const confirmMsg = `Video akan dibuat sekarang dan dijadwalkan publikasi di YouTube pada: ${new Date(scheduleTimeInput.value).toLocaleString()}.\n\nLanjutkan?`;
                if (!confirm(confirmMsg)) return;
            } else {
                if (!confirm('Jalankan otomasi sekarang (Upload akan langsung di-publish sesuai privasi)?')) return;
            }

            btnRunNow.disabled = true;
            btnRunNow.textContent = '⏳ Processing...';
            
            try {
                const aiCfg = getActiveAIConfig();
                if (!aiCfg.apiKey) {
                    alert(`API key ${aiCfg.provider.toUpperCase()} belum diisi. Isi dulu di panel AI.`);
                    btnRunNow.disabled = false;
                    btnRunNow.textContent = 'Run Automation Now (Manual)';
                    return;
                }

                const response = await fetch('/api/automation/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: schedulerTopicInput.value,
                        voice: document.getElementById('narrator_voice').value,
                        speed: parseFloat(document.getElementById('narrator_speed').value) || 0.9,
                        bgmMood: document.getElementById('bgm_mood').value,
                        manualBgmPath: document.getElementById('bgm_local').value || null,
                        visualEffect: document.getElementById('visual_effect').value || 'none',
                        vignette: document.getElementById('vignette').checked || false,
                        privacyStatus: schedulerPrivacySelect.value,
                        publishAt: publishAt,
                        provider: aiCfg.provider,
                        aiApiKey: aiCfg.apiKey,
                        model: aiCfg.model,
                        platforms: {
                            youtube:  document.getElementById('target-youtube')?.checked !== false,
                            facebook: document.getElementById('target-facebook')?.checked !== false,
                            tiktok:   document.getElementById('target-tiktok')?.checked !== false
                        }
                    })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Proses otomasi telah dimulai di background. Silakan cek console server untuk detail log.');
                }
            } catch (error) {
                console.error('Failed to run automation:', error);
            } finally {
                btnRunNow.disabled = false;
                btnRunNow.textContent = 'Run Automation Now (Manual)';
            }
        });
    }

    if (btnConnectYoutube) {
        btnConnectYoutube.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/youtube/auth-url');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Server error while getting auth URL');
                }
                
                const data = await response.json();
                if (data.success && data.url) {
                    window.open(data.url, '_blank');
                    alert('Halaman autentikasi YouTube telah dibuka di tab baru. Silakan izinkan aplikasi dan kembali ke sini setelah selesai.');
                    
                    // Poll for status update every 5 seconds
                    const pollInterval = setInterval(async () => {
                        const statusRes = await fetch('/api/scheduler/status');
                        const statusData = await statusRes.json();
                        if (statusData.isYouTubeAuthenticated) {
                            updateSchedulerUI();
                            clearInterval(pollInterval);
                        }
                    }, 5000);
                } else {
                    alert('Gagal mendapatkan URL autentikasi.');
                }
            } catch (error) {
                console.error('Failed to get YouTube auth URL:', error);
                alert('Gagal menghubungkan ke YouTube: ' + error.message);
            }
        });
    }

    if (btnDisconnectYoutube) {
        btnDisconnectYoutube.addEventListener('click', async () => {
            if (!confirm('Apakah Anda yakin ingin memutuskan koneksi YouTube dan berpindah channel?')) return;
            
            try {
                const response = await fetch('/api/youtube/disconnect', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    await updateSchedulerUI();
                    alert('Koneksi YouTube diputuskan. Anda sekarang dapat menghubungkan channel lain.');
                } else {
                    alert('Gagal memutuskan koneksi: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Failed to disconnect YouTube:', error);
                alert('Error saat menghubungi server: ' + error.message);
            }
        });
    }

    const btnConnectFacebook = document.getElementById('btn-connect-facebook');
    const btnDisconnectFacebook = document.getElementById('btn-disconnect-facebook');
    const btnConnectTiktok = document.getElementById('btn-connect-tiktok');
    const btnDisconnectTiktok = document.getElementById('btn-disconnect-tiktok');

    if (btnConnectFacebook) btnConnectFacebook.addEventListener('click', () =>
        openOAuthWindow('/api/facebook/auth-url', 'isFacebookAuthenticated', 'Facebook'));
    if (btnDisconnectFacebook) btnDisconnectFacebook.addEventListener('click', () =>
        disconnectPlatform('/api/facebook/disconnect', 'Facebook'));
    if (btnConnectTiktok) btnConnectTiktok.addEventListener('click', () =>
        openOAuthWindow('/api/tiktok/auth-url', 'isTiktokAuthenticated', 'TikTok'));
    if (btnDisconnectTiktok) btnDisconnectTiktok.addEventListener('click', () =>
        disconnectPlatform('/api/tiktok/disconnect', 'TikTok'));

    // ===== LOG CONSOLE LOGIC =====
    const logConsole = document.getElementById('log-console');
    const logStatus = document.getElementById('log-status');
    let lastLogCount = 0;

    async function pollLogs() {
        try {
            const response = await fetch('/api/logs');
            const data = await response.json();
            
            if (data.logs && data.logs.length !== lastLogCount) {
                // If log buffer was cleared or drastically changed, clear console
                if (data.logs.length < lastLogCount) logConsole.innerHTML = '';
                
                // Add only new logs
                const newLogs = data.logs.slice(lastLogCount);
                newLogs.forEach(log => {
                    const div = document.createElement('div');
                    div.style.marginBottom = '4px';
                    div.style.borderLeft = `3px solid ${log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#10b981'}`;
                    div.style.paddingLeft = '8px';
                    
                    const timeSpan = document.createElement('span');
                    timeSpan.style.opacity = '0.5';
                    timeSpan.style.marginRight = '8px';
                    timeSpan.textContent = log.timestamp;
                    
                    const msgSpan = document.createElement('span');
                    msgSpan.style.color = log.type === 'error' ? '#fca5a5' : log.type === 'warn' ? '#fde68a' : '#e0e7ff';
                    msgSpan.textContent = log.message;
                    
                    div.appendChild(timeSpan);
                    div.appendChild(msgSpan);
                    logConsole.appendChild(div);
                });
                
                lastLogCount = data.logs.length;
                logConsole.scrollTop = logConsole.scrollHeight;
            }
            logStatus.textContent = 'Live Connected';
            logStatus.style.color = '#10b981';
        } catch (error) {
            logStatus.textContent = 'Log Stream Error';
            logStatus.style.color = '#ef4444';
        }
    }

    // Start polling every 2 seconds
    setInterval(pollLogs, 2000);
    pollLogs();

    // ===== BULK AUTOMATION LOGIC =====
    const bulkTopicInput = document.getElementById('bulk_topic');
    const bulkCountSelect = document.getElementById('bulk_count');
    const btnBulkGenerateTitles = document.getElementById('btn-bulk-generate-titles');
    const btnBulkAddManual = document.getElementById('btn-bulk-add-manual');
    const btnBulkProcessAll = document.getElementById('btn-bulk-process-all');
    const bulkTitleList = document.getElementById('bulk-title-list');
    const bulkItemsContainer = document.getElementById('bulk-items-container');

    let bulkGeneratedIdeas = [];

    if (btnBulkGenerateTitles) {
        btnBulkGenerateTitles.addEventListener('click', async () => {
            const topic = bulkTopicInput.value.trim();
            const count = parseInt(bulkCountSelect.value, 10);

            if (!topic) {
                alert('Silakan masukkan tema utama terlebih dahulu.');
                return;
            }

            btnBulkGenerateTitles.disabled = true;
            btnBulkGenerateTitles.textContent = '⏳ Sedang generate judul terbaik...';

            try {
                const aiCfg = getActiveAIConfig();
                if (!aiCfg.apiKey) {
                    throw new Error(`API key ${aiCfg.provider.toUpperCase()} belum diisi. Isi di panel AI.`);
                }

                const response = await fetch('/api/narration/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic,
                        count,
                        slideCount: 9,
                        provider: aiCfg.provider,
                        apiKey: aiCfg.apiKey,
                        model: aiCfg.model
                    })
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Gagal generate judul.');
                }

                // Add to current list
                bulkGeneratedIdeas = [...bulkGeneratedIdeas, ...(data.ideas || [])];
                renderBulkItems(bulkGeneratedIdeas);
                bulkTitleList.style.display = 'block';
                bulkTitleList.scrollIntoView({ behavior: 'smooth' });

            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                btnBulkGenerateTitles.disabled = false;
                btnBulkGenerateTitles.textContent = 'Step 1: Generate Judul Terbaik (AI)';
            }
        });
    }

    if (btnBulkAddManual) {
        btnBulkAddManual.addEventListener('click', () => {
            const manualIdea = {
                id: 'manual-' + Date.now(),
                title: 'Judul Video Baru',
                summary: 'Ringkasan video manual.',
                narrationSegments: Array(9).fill('Ketik narasi slide di sini...'),
                isManual: true
            };
            bulkGeneratedIdeas.push(manualIdea);
            renderBulkItems(bulkGeneratedIdeas);
            bulkTitleList.style.display = 'block';
        });
    }

    function renderBulkItems(ideas) {
        bulkItemsContainer.innerHTML = '';

        let now = new Date();
        now.setMinutes(now.getMinutes() + 30);

        ideas.forEach((idea, index) => {
            const item = document.createElement('div');
            item.className = 'bulk-item';
            item.style.flexDirection = 'column';
            item.style.alignItems = 'stretch';

            const schedTime = new Date(now.getTime() + index * 2 * 60 * 60 * 1000);
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            const localISOTime = (new Date(schedTime - tzoffset)).toISOString().slice(0, 16);

            const narrationHtml = (idea.narrationSegments || [])
                .map((text, sIdx) => `
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 0.7rem; opacity: 0.6;">Slide ${sIdx+1}</label>
                        <textarea class="bulk-edit-narration" data-video="${index}" data-slide="${sIdx}" style="min-height: 40px; font-size: 0.85rem; padding: 5px 8px;">${text}</textarea>
                    </div>
                `).join('');

            item.innerHTML = `
                <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <input type="text" class="bulk-item-title" value="${idea.title}" data-index="${index}" style="font-weight: bold; border-color: rgba(99, 102, 241, 0.4);">
                    </div>
                    <div class="bulk-item-schedule" style="min-width: 180px;">
                        <input type="datetime-local" class="bulk-item-time" value="${localISOTime}" data-index="${index}">
                    </div>
                    <button type="button" class="btn-icon delete-bulk-item" data-index="${index}" style="color: #ef4444; font-size: 1.2rem;">&times;</button>
                </div>

                <details style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px;">
                    <summary style="cursor: pointer; font-size: 0.85rem; color: #a5b4fc;">📝 Edit Narasi Slide (${idea.narrationSegments.length} Slide)</summary>
                    <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        ${narrationHtml}
                    </div>
                </details>
            `;
            bulkItemsContainer.appendChild(item);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-bulk-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                bulkGeneratedIdeas.splice(idx, 1);
                renderBulkItems(bulkGeneratedIdeas);
            });
        });
    }

    if (btnBulkProcessAll) {
        btnBulkProcessAll.addEventListener('click', async () => {
            const items = document.querySelectorAll('.bulk-item');
            if (items.length === 0) return;

            // Sync edited narrations back to bulkGeneratedIdeas array
            document.querySelectorAll('.bulk-edit-narration').forEach(textarea => {
                const vIdx = parseInt(textarea.dataset.video);
                const sIdx = parseInt(textarea.dataset.slide);
                bulkGeneratedIdeas[vIdx].narrationSegments[sIdx] = textarea.value;
            });

            if (!confirm(`Mulai memproses ${items.length} video? Judul dan narasi yang Anda edit akan digunakan.`)) {
                return;
            }

            const aiCfg = getActiveAIConfig();
            const bulkData = Array.from(items).map((item, index) => {
                const title = item.querySelector('.bulk-item-title').value;
                const time = item.querySelector('.bulk-item-time').value;
                const idea = bulkGeneratedIdeas[index];

                return {
                    title,
                    publishAt: time ? new Date(time).toISOString() : null,
                    topic: bulkTopicInput.value || idea.topic || 'Custom Video',
                    ideaId: idea.id,
                    narrationSegments: idea.narrationSegments
                };
            });

            btnBulkProcessAll.disabled = true;
            btnBulkProcessAll.textContent = '⏳ Mengirim permintaan ke server...';

            try {
                const response = await fetch('/api/automation/bulk-run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: bulkData,
                        provider: aiCfg.provider,
                        aiApiKey: aiCfg.apiKey,
                        model: aiCfg.model,
                        // Global settings from UI
                        voice: document.getElementById('narrator_voice').value,
                        speed: parseFloat(document.getElementById('narrator_speed').value) || 0.9,
                        bgmMood: document.getElementById('bgm_mood').value,
                        visualEffect: document.getElementById('visual_effect').value || 'none',
                        vignette: document.getElementById('vignette').checked || false,
                        platforms: {
                            youtube:  document.getElementById('target-youtube')?.checked !== false,
                            facebook: document.getElementById('target-facebook')?.checked !== false,
                            tiktok:   document.getElementById('target-tiktok')?.checked !== false
                        }
                    })
                });

                const data = await response.json();
                if (data.success) {
                    alert(`Berhasil! ${items.length} tugas telah ditambahkan ke antrean server.\n\nAnda dapat melihat progress di log console.`);
                    bulkTitleList.style.display = 'none';
                    bulkTopicInput.value = '';
                } else {
                    throw new Error(data.error || 'Gagal memproses bulk.');
                }
            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                btnBulkProcessAll.disabled = false;
                btnBulkProcessAll.textContent = 'Step 3: PROSES SEMUA VIDEO & UPLOAD';
            }
        });
    }

    // ===== MASTER TERMINAL LOGIC =====
    const terminalInput = document.getElementById('terminal-input');
    const btnSendCommand = document.getElementById('btn-send-command');

    function addToTerminal(msg, type = 'info') {
        const div = document.createElement('div');
        div.style.marginBottom = '6px';
        div.style.paddingLeft = '10px';

        const colors = {
            info: '#e0e7ff',
            success: '#10b981',
            error: '#fca5a5',
            ai: '#a5b4fc',
            user: '#6366f1'
        };

        if (type === 'user') {
            div.innerHTML = `<span style="color: ${colors.user}; font-weight: bold;">YOU > </span> ${msg}`;
        } else if (type === 'ai') {
            div.innerHTML = `<span style="color: ${colors.ai}; font-weight: bold;">CLAUDE > </span> ${msg}`;
        } else {
            div.style.borderLeft = `2px solid ${colors[type] || colors.info}`;
            div.textContent = msg;
        }

        logConsole.appendChild(div);
        logConsole.scrollTop = logConsole.scrollHeight;
    }

    async function handleMasterCommand() {
        const cmd = terminalInput.value.trim();
        if (!cmd) return;

        addToTerminal(cmd, 'user');
        terminalInput.value = '';
        terminalInput.disabled = true;
        btnSendCommand.disabled = true;

        addToTerminal('Claude is connecting from local terminal...', 'ai');

        try {
            const response = await fetch('/api/master/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            const requestId = data.requestId;

            // Polling for Claude's response from terminal
            const pollInterval = setInterval(async () => {
                const res = await fetch(`/api/master/response/${requestId}`);
                const statusData = await res.json();

                if (statusData.status === 'completed') {
                    clearInterval(pollInterval);
                    addToTerminal(statusData.response || 'Perintah selesai dieksekusi!', 'ai');
                    if (statusData.actionLogs) {
                        statusData.actionLogs.forEach(log => addToTerminal(`→ ${log}`, 'info'));
                    }
                    terminalInput.disabled = false;
                    btnSendCommand.disabled = false;
                    terminalInput.focus();
                }
            }, 2000);

        } catch (error) {
            addToTerminal('Error: ' + error.message, 'error');
            terminalInput.disabled = false;
            btnSendCommand.disabled = false;
        }
    }

    if (btnSendCommand) btnSendCommand.addEventListener('click', handleMasterCommand);
    if (terminalInput) {
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleMasterCommand();
        });
    }

    // Initial load
    updateSchedulerUI();
});
