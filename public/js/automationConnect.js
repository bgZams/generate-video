window.initAutomationConnect = function() {
    const schedulerStatusBadge = document.getElementById('scheduler-status-badge');
    const youtubeStatusBadge = document.getElementById('youtube-status-badge');
    const btnToggleScheduler = document.getElementById('btn-toggle-scheduler');
    const btnConnectYoutube = document.getElementById('btn-connect-youtube');
    const btnDisconnectYoutube = document.getElementById('btn-disconnect-youtube');
    const btnSaveScheduler = document.getElementById('btn-save-scheduler');
    const btnRunNow = document.getElementById('btn-run-now');
    const schedulerTopicInput = document.getElementById('scheduler-topic');
    const schedulerCronInput = document.getElementById('scheduler-cron');
    const schedulerPrivacySelect = document.getElementById('scheduler-privacy');
    const btnConnectFacebook = document.getElementById('btn-connect-facebook');
    const btnDisconnectFacebook = document.getElementById('btn-disconnect-facebook');
    const btnConnectTiktok = document.getElementById('btn-connect-tiktok');
    const btnDisconnectTiktok = document.getElementById('btn-disconnect-tiktok');

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

    async function handleRunNow() {
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
            const aiCfg = window.getActiveAIConfig();
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
                    topic: schedulerTopicInput ? schedulerTopicInput.value : '',
                    voice: document.getElementById('narrator_voice') ? document.getElementById('narrator_voice').value : 'edge-id-gadis',
                    speed: document.getElementById('narrator_speed') ? parseFloat(document.getElementById('narrator_speed').value) : 0.9,
                    bgmMood: document.getElementById('bgm_mood') ? document.getElementById('bgm_mood').value : 'upbeat',
                    visualEffect: document.getElementById('visual_effect') ? document.getElementById('visual_effect').value || 'none' : 'none',
                    vignette: document.getElementById('vignette') ? document.getElementById('vignette').checked || false : false,
                    privacyStatus: schedulerPrivacySelect ? schedulerPrivacySelect.value : 'private',
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
            } else {
                throw new Error(data.error || 'Gagal memproses otomasi.');
            }
        } catch (error) {
            console.error('Failed to run automation:', error);
            alert('Error: ' + error.message);
        } finally {
            btnRunNow.disabled = false;
            btnRunNow.textContent = 'Run Automation Now (Manual)';
        }
    }

    if (btnToggleScheduler) {
        btnToggleScheduler.addEventListener('click', async () => {
            const isCurrentlyEnabled = schedulerStatusBadge ? schedulerStatusBadge.textContent === 'ON' : false;
            await saveSchedulerConfig({ enabled: !isCurrentlyEnabled });
        });
    }

    if (btnSaveScheduler) {
        btnSaveScheduler.addEventListener('click', async () => {
            const schedEffect = document.getElementById('scheduler-effect');
            const schedVignette = document.getElementById('scheduler-vignette');

            await saveSchedulerConfig({
                topic: schedulerTopicInput ? schedulerTopicInput.value : '',
                schedule: schedulerCronInput ? schedulerCronInput.value : '',
                privacyStatus: schedulerPrivacySelect ? schedulerPrivacySelect.value : 'private',
                visualEffect: schedEffect ? schedEffect.value : 'none',
                vignette: schedVignette ? schedVignette.checked : false
            });
            alert('Pengaturan jadwal berhasil disimpan!');
        });
    }

    if (btnRunNow) {
        btnRunNow.addEventListener('click', handleRunNow);
    }

    if (btnConnectYoutube) {
        btnConnectYoutube.addEventListener('click', async () => {
            openOAuthWindow('/api/youtube/auth-url', 'isYouTubeAuthenticated', 'YouTube');
        });
    }

    if (btnDisconnectYoutube) {
        btnDisconnectYoutube.addEventListener('click', async () => {
            disconnectPlatform('/api/youtube/disconnect', 'YouTube');
        });
    }

    if (btnConnectFacebook) btnConnectFacebook.addEventListener('click', () => openOAuthWindow('/api/facebook/auth-url', 'isFacebookAuthenticated', 'Facebook'));
    if (btnDisconnectFacebook) btnDisconnectFacebook.addEventListener('click', () => disconnectPlatform('/api/facebook/disconnect', 'Facebook'));
    if (btnConnectTiktok) btnConnectTiktok.addEventListener('click', () => openOAuthWindow('/api/tiktok/auth-url', 'isTiktokAuthenticated', 'TikTok'));
    if (btnDisconnectTiktok) btnDisconnectTiktok.addEventListener('click', () => disconnectPlatform('/api/tiktok/disconnect', 'TikTok'));

    updateSchedulerUI(); // Initial load
};
