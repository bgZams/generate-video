// Global handler for TTS Audio Generation (accessible from any component, like Slides Editor)
window.handleGenerateAudio = async function(slideIndex, narrationText) {
    const generateBtn = document.querySelector(`.generate-audio[data-slide="${slideIndex}"]`);
    const audioContainer = document.querySelector(`.slide-audio-${slideIndex}`);

    if (!narrationText || !narrationText.trim()) {
        alert('Please enter narration text first.');
        return;
    }

    // Attempt to read voice/speed settings from document if they exist, otherwise use fallback
    const narratorVoiceSelect = document.getElementById('narrator_voice');
    const narratorSpeedSelect = document.getElementById('narrator_speed');
    const voiceVal = narratorVoiceSelect ? narratorVoiceSelect.value : 'edge-id-gadis';
    const speedVal = narratorSpeedSelect ? parseFloat(narratorSpeedSelect.value) : 0.9;

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
                voice: voiceVal,
                speed: speedVal
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
};

window.initAiNarrationPanel = function() {
    const btnGenerateIdeas = document.getElementById('btn-generate-ideas');
    const btnRefreshHistory = document.getElementById('btn-refresh-history');
    const ideaStatus = document.getElementById('idea-status');
    const ideaResults = document.getElementById('idea-results');
    const historyResults = document.getElementById('history-results');
    const ideaTopicInput = document.getElementById('idea_topic');
    const ideaCountInput = document.getElementById('idea_count');

    function setIdeaStatus(message, isError = false) {
        if (ideaStatus) {
            ideaStatus.textContent = message;
            ideaStatus.classList.toggle('error-text', isError);
        }
    }

    function setIdeaLoading(isLoading) {
        if (btnGenerateIdeas) {
            btnGenerateIdeas.disabled = isLoading;
            btnGenerateIdeas.textContent = isLoading ? 'Generating...' : 'Generate Judul & Narasi';
        }
    }

    // Make setIdeaStatus helper globally available so applyIdeaToSlides can call it
    window.setIdeaStatus = setIdeaStatus;

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
                <span>${item.slideCount || item.narrationSegments?.length || 0} slide</span>
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
            button.addEventListener('click', () => {
                if (window.applyIdeaToSlides) {
                    window.applyIdeaToSlides(item);
                } else {
                    alert('Error: applyIdeaToSlides function not available.');
                }
            });

            actions.appendChild(button);
            card.appendChild(actions);
        }

        return card;
    }

    function renderIdeaList(container, items, options = {}) {
        if (!container) return;
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

    async function loadHistory() {
        if (!historyResults) return;
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

    // Expose loadHistory globally
    window.loadHistory = loadHistory;

    async function handleGenerateIdeas() {
        const mode = window.getCurrentVideoMode ? window.getCurrentVideoMode() : 'short';
        const preset = window.getVideoModePreset ? window.getVideoModePreset(mode) : { slideCount: 9 };
        const slideTarget = preset.slideCount;
        const topic = ideaTopicInput ? ideaTopicInput.value.trim() : '';
        const count = ideaCountInput ? Math.max(1, Math.min(10, parseInt(ideaCountInput.value, 10) || 5)) : 5;

        setIdeaLoading(true);
        setIdeaStatus(`AI sedang membuat ${count} judul + narasi [mode: ${mode}]...`);

        try {
            const aiCfg = window.getActiveAIConfig();
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
                    model: aiCfg.model,
                    videoMode: mode
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

            if (data.ideas && data.ideas.length > 0) {
                const firstIdea = data.ideas[0];
                if (window.applyIdeaToSlides) {
                    window.applyIdeaToSlides(firstIdea);
                } else {
                    alert('Could not automatically apply first idea to slides.');
                }
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

    if (btnGenerateIdeas) btnGenerateIdeas.addEventListener('click', handleGenerateIdeas);
    if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', loadHistory);

    loadHistory(); // Load history on mount
};
