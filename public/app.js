document.addEventListener('DOMContentLoaded', () => {
    const slidesContainer = document.getElementById('slides-container');
    const btnAddSlide = document.getElementById('btn-add-slide');
    const form = document.getElementById('video-form');
    
    let slideCount = 1;

    // Tab switching for image source (includes ref mode)
    function setupTabSwitching(slideEl) {
        const tabs = slideEl.querySelectorAll('.tab-option');
        const inputArea = slideEl.querySelector('.image-input-area');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const mode = tab.querySelector('input[type="radio"]').value;
                inputArea.setAttribute('data-mode', mode);
                
                // Show/hide areas
                inputArea.querySelector('.auto-search-info').style.display = mode === 'auto' ? '' : 'none';
                inputArea.querySelector('.upload-area').style.display = mode === 'upload' ? '' : 'none';
                inputArea.querySelector('.url-area').style.display = mode === 'url' ? '' : 'none';
                inputArea.querySelector('.ref-area').style.display = mode === 'ref' ? '' : 'none';
            });
        });
    }

    // Update all ref dropdowns with current slide list
    function updateRefDropdowns() {
        const allSlides = document.querySelectorAll('.slide-item');
        const slideLabels = [];
        allSlides.forEach((s, idx) => {
            slideLabels.push({ index: idx, label: `Slide ${idx + 1}` });
        });

        allSlides.forEach((slideEl, myIdx) => {
            const refSelect = slideEl.querySelector('.ref-select');
            if (!refSelect) return;
            
            const currentVal = refSelect.value;
            // Clear options
            refSelect.innerHTML = '<option value="">-- Pilih Slide --</option>';
            
            // Add options (exclude self)
            slideLabels.forEach(sl => {
                if (sl.index !== myIdx) {
                    const opt = document.createElement('option');
                    opt.value = sl.index;
                    opt.textContent = sl.label;
                    refSelect.appendChild(opt);
                }
            });

            // Restore previous selection if still valid
            if (currentVal !== '' && refSelect.querySelector(`option[value="${currentVal}"]`)) {
                refSelect.value = currentVal;
            }
        });
    }

    // Setup initial slide
    setupTabSwitching(document.querySelector('.slide-item'));
    updateDeleteButtons();
    updateRefDropdowns();

    btnAddSlide.addEventListener('click', () => {
        const countInput = document.getElementById('slide-count-input');
        const count = Math.max(1, Math.min(50, parseInt(countInput.value) || 1));
        
        for (let n = 0; n < count; n++) {
            const slideIndex = slideCount++;
        
            const slideHTML = `
                <div class="glass-panel slide-item" data-index="${slideIndex}">
                    <div class="slide-header">
                        <h3>Slide ${slideIndex + 1}</h3>
                        <button type="button" class="btn-icon delete-slide">&times;</button>
                    </div>
                    <div class="form-group">
                        <label>Narration Text & Subtitles</label>
                        <textarea name="slide_text_${slideIndex}" placeholder="Type the text you want the AI voice to speak..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Background Image</label>
                        <div class="image-source-tabs">
                            <label class="tab-option active">
                                <input type="radio" name="slide_imgsrc_${slideIndex}" value="auto" checked>
                                <span>🔍 Auto</span>
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
                                <small>✨ Image will be automatically searched based on your narration text above.</small>
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
                                <small>🖇️ Gambar yang sama akan digunakan, tapi dengan efek gerak berbeda agar tetap dinamis.</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        
            slidesContainer.insertAdjacentHTML('beforeend', slideHTML);
            setupTabSwitching(slidesContainer.lastElementChild);
        }
        updateDeleteButtons();
        updateSlideHeaders();
        updateRefDropdowns();
    });

    slidesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-slide')) {
            const slideItem = e.target.closest('.slide-item');
            if (slidesContainer.children.length > 1) {
                slideItem.remove();
                updateSlideHeaders();
                updateDeleteButtons();
                updateRefDropdowns();
            }
        }
    });

    function updateDeleteButtons() {
        const deleteBtns = document.querySelectorAll('.delete-slide');
        if (deleteBtns.length === 1) {
            deleteBtns[0].disabled = true;
        } else {
            deleteBtns.forEach(btn => btn.disabled = false);
        }
    }

    function updateSlideHeaders() {
        const slides = document.querySelectorAll('.slide-item');
        slides.forEach((slide, idx) => {
            slide.querySelector('h3').textContent = `Slide ${idx + 1}`;
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const config = {
            resolution: formData.get('resolution'),
            slides: []
        };

        const finalFormData = new FormData();
        
        // Gather BGM 
        const bgmFile = formData.get('bgm_audio');
        if (bgmFile && bgmFile.size > 0) {
            finalFormData.append('bgm_audio', bgmFile);
        }

        // Gather Slides
        const slidePanels = document.querySelectorAll('.slide-item');
        slidePanels.forEach((panel, visualIndex) => {
            const idx = panel.getAttribute('data-index');
            const inputArea = panel.querySelector('.image-input-area');
            const mode = inputArea.getAttribute('data-mode');
            
            const text = formData.get(`slide_text_${idx}`);
            const imgUrl = formData.get(`slide_url_${idx}`);
            const imgFile = formData.get(`slide_img_${idx}`);
            const refSlide = formData.get(`slide_ref_${idx}`);
            
            const slideConfig = {
                text: text || "",
                imageSource: mode,
                imageUrl: mode === 'url' ? (imgUrl || "") : "",
                refSlide: mode === 'ref' ? parseInt(refSlide) : null
            };
            
            // If upload mode and file exists
            if (mode === 'upload' && imgFile && imgFile.size > 0) {
                finalFormData.append(`slide_img_${config.slides.length}`, imgFile);
            }
            
            config.slides.push(slideConfig);
        });

        finalFormData.append('payload', JSON.stringify(config));

        // UI State
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
            } else {
                alert('Error: ' + (data.error || 'Unknown error occurred.'));
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
