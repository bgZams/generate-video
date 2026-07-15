window.initVideoStandardGenerator = function() {
    const topicInput = document.getElementById('standard-topic');
    const generateBtn = document.getElementById('generate-standard-btn');
    const progressOverlay = document.getElementById('progress-overlay');

    function getActiveAIConfig() {
        if (window.getActiveAIConfig && typeof window.getActiveAIConfig === 'function') {
            return window.getActiveAIConfig();
        }
        console.warn('window.getActiveAIConfig is not defined. Using default AI config.');
        return { provider: 'gemini', apiKey: '', model: 'gemini-flash-latest' };
    }

    function getGlobalSetting(key, defaultValue) {
        if (window.getGlobalSetting && typeof window.getGlobalSetting === 'function') {
            return window.getGlobalSetting(key) || defaultValue;
        }
        return defaultValue;
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const topic = topicInput ? topicInput.value.trim() : '';

            if (!topic) {
                alert('Tema video tidak boleh kosong.');
                return;
            }

            const aiConfig = getActiveAIConfig();
            if (!aiConfig.apiKey) {
                alert(`Harap masukkan API Key ${aiConfig.provider.toUpperCase()} di bagian Global Settings.`);
                return;
            }

            const generationOptions = {
                topic: topic,
                videoMode: 'medium', // Force 'medium' mode
                provider: aiConfig.provider,
                aiApiKey: aiConfig.apiKey,
                model: aiConfig.model,
                // Global settings
                voice: getGlobalSetting('narrator_voice', 'edge-id-gadis'),
                speed: getGlobalSetting('narrator_speed', 1.0), // Default speed for standard video
                bgmMood: getGlobalSetting('bgm_mood', 'cinematic'), // Default BGM mood for standard video
                visualEffect: getGlobalSetting('visual_effect', 'cinematic'), // Default effect
                vignette: getGlobalSetting('vignette', false),
                privacyStatus: getGlobalSetting('youtube_privacy', 'private'), // Default privacy for uploads
                captions: getGlobalSetting('captions', true),
                transitions: getGlobalSetting('transitions', true),
                progressBar: getGlobalSetting('progressBar', true),
            };

            console.log('Generating Standard Video with options:', generationOptions);
            generateBtn.disabled = true;
            generateBtn.textContent = 'Membuat Video...';

            try {
                if (progressOverlay) progressOverlay.style.display = 'flex';
                window.updateProgressUI('starting', 5, 'Memulai proses...');

                const response = await fetch('/api/automation/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(generationOptions)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Gagal memulai pembuatan video dari server.');
                }

                const data = await response.json();

                if (data.success) {
                    alert('Proses pembuatan video Standar telah dimulai di background!');
                    const jobId = response.headers.get('X-Job-Id') || data.jobId;
                    if (jobId && window.startProgressSSE) {
                        window.startProgressSSE(jobId);
                    } else {
                        console.warn('Could not get jobId or window.startProgressSSE is not defined.');
                    }
                } else {
                    alert('Gagal memulai pembuatan video: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error initiating video generation:', error);
                alert('Terjadi kesalahan saat memulai pembuatan video: ' + error.message);
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '▶ Generate Video';
            }
        });
    }
};
