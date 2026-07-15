let bulkGeneratedIdeas = [];

window.initBulkModePanel = function() {
    const bulkTopicInput = document.getElementById('bulk_topic');
    const bulkCountSelect = document.getElementById('bulk_count');
    const btnBulkGenerateTitles = document.getElementById('btn-bulk-generate-titles');
    const btnBulkAddManual = document.getElementById('btn-bulk-add-manual');
    const btnBulkProcessAll = document.getElementById('btn-bulk-process-all');
    const bulkTitleList = document.getElementById('bulk-title-list');
    const bulkItemsContainer = document.getElementById('bulk-items-container');

    function renderBulkItems(ideas) {
        if (!bulkItemsContainer) return;
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
        bulkItemsContainer.querySelectorAll('.delete-bulk-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                bulkGeneratedIdeas.splice(idx, 1);
                renderBulkItems(bulkGeneratedIdeas);
            });
        });
    }

    async function handleBulkGenerateTitles() {
        const topic = bulkTopicInput ? bulkTopicInput.value.trim() : '';
        const count = bulkCountSelect ? parseInt(bulkCountSelect.value, 10) : 1;

        if (!topic) {
            alert('Silakan masukkan tema utama terlebih dahulu.');
            return;
        }

        btnBulkGenerateTitles.disabled = true;
        btnBulkGenerateTitles.textContent = '⏳ Sedang generate judul terbaik...';

        try {
            const aiCfg = window.getActiveAIConfig();
            if (!aiCfg.apiKey) {
                throw new Error(`API key ${aiCfg.provider.toUpperCase()} belum diisi. Isi di panel AI.`);
            }

            const response = await fetch('/api/narration/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    count,
                    slideCount: 9, // Bulk mode defaults to 9 slides
                    provider: aiCfg.provider,
                    apiKey: aiCfg.apiKey,
                    model: aiCfg.model
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Gagal generate judul.');
            }

            bulkGeneratedIdeas = [...bulkGeneratedIdeas, ...(data.ideas || [])];
            renderBulkItems(bulkGeneratedIdeas);
            if (bulkTitleList) bulkTitleList.style.display = 'block';
            if (bulkTitleList) bulkTitleList.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            btnBulkGenerateTitles.disabled = false;
            btnBulkGenerateTitles.textContent = 'Step 1: Generate Judul Terbaik (AI)';
        }
    }

    function handleBulkAddManual() {
        const manualIdea = {
            id: 'manual-' + Date.now(),
            title: 'Judul Video Baru',
            summary: 'Ringkasan video manual.',
            narrationSegments: Array(9).fill('Ketik narasi slide di sini...'),
            isManual: true
        };
        bulkGeneratedIdeas.push(manualIdea);
        renderBulkItems(bulkGeneratedIdeas);
        if (bulkTitleList) bulkTitleList.style.display = 'block';
    }

    async function handleBulkProcessAll() {
        const items = document.querySelectorAll('.bulk-item');
        if (items.length === 0) return;

        document.querySelectorAll('.bulk-edit-narration').forEach(textarea => {
            const vIdx = parseInt(textarea.dataset.video);
            const sIdx = parseInt(textarea.dataset.slide);
            bulkGeneratedIdeas[vIdx].narrationSegments[sIdx] = textarea.value;
        });

        if (!confirm(`Mulai memproses ${items.length} video? Judul dan narasi yang Anda edit akan digunakan.`)) {
            return;
        }

        const aiCfg = window.getActiveAIConfig();
        const bulkData = Array.from(items).map((item, index) => {
            const title = item.querySelector('.bulk-item-title').value;
            const time = item.querySelector('.bulk-item-time').value;
            const idea = bulkGeneratedIdeas[index];

            return {
                title,
                publishAt: time ? new Date(time).toISOString() : null,
                topic: bulkTopicInput ? bulkTopicInput.value || idea.topic || 'Custom Video' : 'Custom Video',
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
                    // Global settings from UI (fallback to defaults if elements don't exist in DOM)
                    voice: document.getElementById('narrator_voice') ? document.getElementById('narrator_voice').value : 'edge-id-gadis',
                    speed: document.getElementById('narrator_speed') ? parseFloat(document.getElementById('narrator_speed').value) : 0.9,
                    bgmMood: document.getElementById('bgm_mood') ? document.getElementById('bgm_mood').value : 'upbeat',
                    visualEffect: document.getElementById('visual_effect') ? document.getElementById('visual_effect').value || 'none' : 'none',
                    vignette: document.getElementById('vignette') ? document.getElementById('vignette').checked || false : false,
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
                if (bulkTitleList) bulkTitleList.style.display = 'none';
                if (bulkTopicInput) bulkTopicInput.value = '';
                bulkGeneratedIdeas = [];
            } else {
                throw new Error(data.error || 'Gagal memproses bulk.');
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            btnBulkProcessAll.disabled = false;
            btnBulkProcessAll.textContent = 'Step 3: PROSES SEMUA VIDEO & UPLOAD';
        }
    }

    if (btnBulkGenerateTitles) btnBulkGenerateTitles.addEventListener('click', handleBulkGenerateTitles);
    if (btnBulkAddManual) btnBulkAddManual.addEventListener('click', handleBulkAddManual);
    if (btnBulkProcessAll) btnBulkProcessAll.addEventListener('click', handleBulkProcessAll);

    // Initial render of existing bulk items if any
    if (bulkGeneratedIdeas.length > 0) {
        renderBulkItems(bulkGeneratedIdeas);
        if (bulkTitleList) bulkTitleList.style.display = 'block';
    }
};
