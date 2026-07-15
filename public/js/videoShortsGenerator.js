window.initVideoShortsGenerator = function() {
    const topicInput = document.getElementById('shorts-topic');
    const generateBtn = document.getElementById('generate-shorts-btn');
    const progressOverlay = document.getElementById('progress-overlay'); // Get progress overlay element

    // Function to get active AI configuration from global scope (assumed to be in globalSettings.js)
    function getActiveAIConfig() {
        if (window.getActiveAIConfig && typeof window.getActiveAIConfig === 'function') {
            return window.getActiveAIConfig();
        }
        console.warn('window.getActiveAIConfig is not defined. Using default AI config.');
        return { provider: 'gemini', apiKey: '', model: 'gemini-flash-latest' };
    }

    // Function to get global settings (e.g., voice, BGM mood)
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

            // Prepare generation options, using global settings where applicable
            const generationOptions = {
                topic: topic,
                videoMode: 'short', // Force 'short' mode for this generator
                provider: aiConfig.provider,
                aiApiKey: aiConfig.apiKey,
                model: aiConfig.model,
                // Global settings that might apply to all video generations
                voice: getGlobalSetting('narrator_voice', 'edge-id-gadis'),
                speed: getGlobalSetting('narrator_speed', 0.9),
                bgmMood: getGlobalSetting('bgm_mood', 'upbeat'),
                visualEffect: getGlobalSetting('visual_effect', 'none'),
                vignette: getGlobalSetting('vignette', false),
                privacyStatus: getGlobalSetting('youtube_privacy', 'public'),
                captions: getGlobalSetting('captions', true),       // Assuming captions on by default
                transitions: getGlobalSetting('transitions', true), // Assuming transitions on by default
                progressBar: getGlobalSetting('progressBar', true), // Assuming progress bar on by default
            };

            console.log('Generating Shorts Video with options:', generationOptions);
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
                    alert('Proses pembuatan video Shorts telah dimulai di background!');
                    // Start SSE to track progress, assuming jobId is returned
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