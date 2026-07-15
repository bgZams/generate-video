window.initMainFormAndFeedback = function() {
    const form = document.getElementById('video-form');
    const proCaptions = document.getElementById('pro_captions');
    const proCaptionChunk = document.getElementById('pro_caption_chunk');
    const proCaptionAccent = document.getElementById('pro_caption_accent');
    const proTransitions = document.getElementById('pro_transitions');
    const proProgressBar = document.getElementById('pro_progress_bar');
    const proAutoThumbnail = document.getElementById('pro_auto_thumbnail');

    const progressOverlay = document.getElementById('progress-overlay');
    const btnGenerate = document.getElementById('btn-generate');
    const btnGenerateText = document.querySelector('.btn-text');
    const spinner = document.querySelector('.spinner');
    const resultContainer = document.getElementById('result-container');
    const resultVideo = document.getElementById('result-video');
    const downloadBtn = document.getElementById('download-btn');
    const thumbWrapper = document.getElementById('result-thumbnail-wrapper');
    const thumbImg = document.getElementById('result-thumbnail');
    const thumbDl = document.getElementById('thumbnail-download-btn');

    async function handleSubmit(event) {
        event.preventDefault();

        // Perform basic validations
        if (!form) return;
        const formData = new FormData(form);

        const videoMode = window.getCurrentVideoMode ? window.getCurrentVideoMode() : 'short';
        const activeIdea = window.getSelectedIdea ? window.getSelectedIdea() : { id: '', title: '' };

        const config = {
            resolution: formData.get('resolution') || '9:16',
            bgmMood: formData.get('bgm_mood') || 'upbeat',
            localBgmPath: formData.get('bgm_local') || null,
            visualEffect: formData.get('visual_effect') || 'none',
            vignette: formData.get('vignette') === 'on',
            storyTitle: (formData.get('story_title') || '').trim(),
            storyIdeaId: activeIdea.id || '',
            videoMode: videoMode,
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

        const panels = window.getSlidePanels ? window.getSlidePanels() : [];
        panels.forEach(panel => {
            const idx = panel.getAttribute('data-index');
            const inputArea = panel.querySelector('.image-input-area');
            const mode = inputArea ? inputArea.getAttribute('data-mode') : 'auto';
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

        // Update UI for progress
        if (window.updateProgressUI) {
            window.updateProgressUI('starting', 2, 'Memulai proses render...');
        }
        if (progressOverlay) progressOverlay.style.display = 'flex';
        if (btnGenerate) btnGenerate.disabled = true;
        if (btnGenerateText) btnGenerateText.textContent = 'Generating...';
        if (spinner) spinner.style.display = 'inline-block';
        if (resultContainer) resultContainer.style.display = 'none';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                body: finalFormData
            });

            const jobId = response.headers.get('X-Job-Id');
            if (jobId && window.startProgressSSE) {
                window.startProgressSSE(jobId);
            }

            const data = await response.json();

            if (response.ok && data.success) {
                const videoURL = data.videoUrl;

                if (resultVideo) resultVideo.src = `${videoURL}?t=${new Date().getTime()}`;
                if (downloadBtn) downloadBtn.href = videoURL;
                if (resultContainer) resultContainer.style.display = 'block';

                if (thumbWrapper && thumbImg) {
                    if (data.thumbnailUrl) {
                        thumbImg.src = `${data.thumbnailUrl}?t=${Date.now()}`;
                        if (thumbDl) thumbDl.href = data.thumbnailUrl;
                        thumbWrapper.style.display = 'block';
                    } else {
                        thumbWrapper.style.display = 'none';
                    }
                }

                if (resultContainer) resultContainer.scrollIntoView({ behavior: 'smooth' });

                if (data.usedTitle && window.setSelectedIdea) {
                    window.setSelectedIdea(data.usedTitle.id || '', data.usedTitle.title || (formData.get('story_title') || '').trim());
                }

                if (window.loadHistory) {
                    window.loadHistory();
                }
            } else {
                alert(`Error: ${data.error || 'Unknown error occurred.'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to connect to the server.');
        } finally {
            if (progressOverlay) progressOverlay.style.display = 'none';
            if (btnGenerate) btnGenerate.disabled = false;
            if (btnGenerateText) btnGenerateText.textContent = '🎬 Generate Video';
            if (spinner) spinner.style.display = 'none';
            if (window.progressSSE) { window.progressSSE.close(); window.progressSSE = null; }
        }
    }

    if (form) {
        // Prevent stacking submit listeners
        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    }
};
