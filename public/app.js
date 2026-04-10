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
    let voiceSelection = 'shimmer'; // Default soft voice
    let speedSelection = 1.0; // Default normal speed

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
        });

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
        const slidePanels = getSlidePanels();
        const slideTarget = slidePanels.length || 1;
        const topic = ideaTopicInput.value.trim();
        const count = Math.max(1, Math.min(10, parseInt(ideaCountInput.value, 10) || 5));

        setIdeaLoading(true);
        setIdeaStatus('OpenAI sedang membuat daftar judul dan narasi...');

        try {
            const response = await fetch('/api/narration/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topic,
                    count,
                    slideCount: slideTarget,
                    model: modelSelect.value
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

    btnAddSlide.addEventListener('click', () => {
        const countInput = document.getElementById('slide-count-input');
        const count = Math.max(1, Math.min(50, parseInt(countInput.value, 10) || 1));
        appendSlides(count);
    });

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

    storyTitleInput.addEventListener('input', () => {
        if (storyTitleInput.value.trim() !== selectedIdeaTitle.trim()) {
            selectedIdeaId = '';
        }
    });

    btnGenerateIdeas.addEventListener('click', handleGenerateIdeas);
    btnRefreshHistory.addEventListener('click', loadHistory);

    // Voice and speed selection
    narratorVoiceSelect.addEventListener('change', (e) => {
        voiceSelection = e.target.value;
    });

    narratorSpeedSelect.addEventListener('change', (e) => {
        speedSelection = parseFloat(e.target.value);
    });

    // Generate audio button listener (event delegation)
    slidesContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('generate-audio')) {
            const slideIndex = parseInt(event.target.dataset.slide, 10);
            const slidePanel = document.querySelector(`.slide-item[data-index="${slideIndex}"]`);
            const textarea = slidePanel.querySelector('textarea');
            const narrationText = textarea.value.trim();
            
            handleGenerateAudio(slideIndex, narrationText);
        }
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const formData = new FormData(form);
        const config = {
            resolution: formData.get('resolution'),
            bgmMood: formData.get('bgm_mood') || 'upbeat',
            storyTitle: (formData.get('story_title') || '').trim(),
            storyIdeaId: selectedIdeaId || '',
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

            const data = await response.json();

            if (response.ok && data.success) {
                const videoURL = data.videoUrl;
                const resultVideo = document.getElementById('result-video');

                resultVideo.src = `${videoURL}?t=${new Date().getTime()}`;
                document.getElementById('download-btn').href = videoURL;
                document.getElementById('result-container').style.display = 'block';
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
            document.querySelector('.btn-text').textContent = 'Generate Video';
            document.querySelector('.spinner').style.display = 'none';
        }
    });
});
