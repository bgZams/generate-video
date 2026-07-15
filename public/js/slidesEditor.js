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
                        <span>🔍 Auto (Pexels)</span>
                    </label>
                    <label class="tab-option">
                        <input type="radio" name="slide_imgsrc_${slideIndex}" value="upload">
                        <span>📁 Upload</span>
                    </label>
                    <label class="tab-option">
                        <input type="radio" name="slide_imgsrc_${slideIndex}" value="url">
                        <span>🔗 URL</span>
                    </label>
                    <label class="tab-option">
                        <input type="radio" name="slide_imgsrc_${slideIndex}" value="ref">
                        <span>🖇️ Same as...</span>
                    </label>
                </div>
                <div class="image-input-area" data-mode="auto">
                    <div class="auto-search-info">
                        <small>✨ Gambar otomatis dicari dari <strong>Pexels</strong> berdasarkan teks narasi — relevan dan berkualitas tinggi.</small>
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
                        <small>🖇️ Gambar yang sama, efek gerak berbeda agar tetap dinamis.</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function setupImageSourceTabs(slideEl) {
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

function appendSlides(countToAdd, container) {
    const targetContainer = container || document.getElementById('slides-container');
    if (!targetContainer) return;
    for (let index = 0; index < countToAdd; index += 1) {
        const nextIndex = document.querySelectorAll('.slide-item').length;
        targetContainer.insertAdjacentHTML('beforeend', createSlideHTML(nextIndex));
        setupImageSourceTabs(targetContainer.lastElementChild);
    }
    updateDeleteButtons();
    updateSlideHeaders();
    updateRefDropdowns();
}

// Globally expose getSlidePanels so the form submission can parse them
window.getSlidePanels = () => {
    return Array.from(document.querySelectorAll('.slide-item'));
};

window.ensureSlideCount = (targetCount) => {
    const currentSlides = document.querySelectorAll('.slide-item');
    const container = document.getElementById('slides-container');
    if (!container) return;

    if (currentSlides.length < targetCount) {
        appendSlides(targetCount - currentSlides.length, container);
    } else if (currentSlides.length > targetCount) {
        Array.from(currentSlides)
            .slice(targetCount)
            .forEach(slide => slide.remove());
        updateDeleteButtons();
        updateSlideHeaders();
        updateRefDropdowns();
    }
};

window.applyIdeaToSlides = (item) => {
    const segments = Array.isArray(item.narrationSegments) ? item.narrationSegments : [];
    window.ensureSlideCount(segments.length || 1);

    const storyTitleInput = document.getElementById('story_title');
    if (storyTitleInput) storyTitleInput.value = item.title || '';
    window.setSelectedIdea(item.id || '', item.title || '');

    window.getSlidePanels().forEach((panel, index) => {
        const textarea = panel.querySelector('textarea');
        if (textarea) {
            textarea.value = segments[index] || '';
        }

        const autoRadio = panel.querySelector('input[value="auto"]');
        if (autoRadio) {
            autoRadio.checked = true;
            const changeEvent = new Event('change', { bubbles: true });
            autoRadio.dispatchEvent(changeEvent);
        }
    });

    updateRefDropdowns();

    if (window.setIdeaStatus) {
        window.setIdeaStatus(`Judul "${item.title}" sudah dimasukkan ke slide.`);
    }
};

window.initSlidesEditor = function() {
    const slidesContainer = document.getElementById('slides-container');
    const btnAddSlide = document.getElementById('btn-add-slide');

    if (slidesContainer) {
        // Initialize with 1 slide if container is empty
        const initialCount = slidesContainer.querySelectorAll('.slide-item').length;
        if (initialCount === 0) {
            appendSlides(1, slidesContainer);
        } else {
            updateDeleteButtons();
            updateSlideHeaders();
            updateRefDropdowns();
        }
    }

    if (btnAddSlide) {
        btnAddSlide.addEventListener('click', () => {
            const countInput = document.getElementById('slide-count-input');
            const count = Math.max(1, Math.min(50, parseInt(countInput.value, 10) || 1));
            appendSlides(count, slidesContainer);
        });
    }

    if (slidesContainer) {
        slidesContainer.addEventListener('click', event => {
            if (event.target.classList.contains('delete-slide')) {
                const slideItem = event.target.closest('.slide-item');
                if (!slideItem || document.querySelectorAll('.slide-item').length <= 1) {
                    return;
                }
                slideItem.remove();
                updateSlideHeaders();
                updateDeleteButtons();
                updateRefDropdowns();
            } else if (event.target.classList.contains('generate-audio')) {
                const slideIndex = parseInt(event.target.dataset.slide, 10);
                const slidePanel = document.querySelector(`.slide-item[data-index="${slideIndex}"]`);
                if (!slidePanel) return;
                const textarea = slidePanel.querySelector('textarea');
                const narrationText = textarea ? textarea.value.trim() : '';
                if (window.handleGenerateAudio) {
                    window.handleGenerateAudio(slideIndex, narrationText);
                } else {
                    alert('Error: Audio generation function not available.');
                }
            }
        });
    }
};
