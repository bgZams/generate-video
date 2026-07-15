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

let currentVideoMode = localStorage.getItem('video_mode') || 'short';

function updateEstimator(mode) {
    const info = ESTIMATOR_TEXTS[mode] || ESTIMATOR_TEXTS.short;
    const el = document.getElementById('estimator-text');
    if (el) el.innerHTML = `Mode: <strong>${VIDEO_MODE_PRESETS[mode]?.label || mode}</strong> — ~${info.slides}, estimasi <strong>${info.est}</strong>`;
}

window.initVideoModeSelector = function() {
    // Restore mode state from localStorage if exists
    const savedMode = localStorage.getItem('video_mode');
    if (savedMode && VIDEO_MODE_PRESETS[savedMode]) {
        currentVideoMode = savedMode;
        document.querySelectorAll('.mode-card').forEach(card => {
            if (card.dataset.mode === savedMode) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    const modeCards = document.querySelectorAll('.mode-card');
    console.log(`DEBUG: Found ${modeCards.length} .mode-card elements.`);

    modeCards.forEach(card => {
        console.log(`DEBUG: Attaching listener to card: ${card.dataset.mode}`);
        card.addEventListener('click', (e) => {
            console.log(`DEBUG: Card ${e.currentTarget.dataset.mode} clicked!`);
            document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentVideoMode = e.currentTarget.dataset.mode;
            localStorage.setItem('video_mode', currentVideoMode);

            // Dispatch custom event for resolution change
            const event = new CustomEvent('videoModeChange', { detail: { mode: currentVideoMode, resolution: VIDEO_MODE_PRESETS[currentVideoMode].resolutionDefault } });
            document.dispatchEvent(event);

            updateEstimator(currentVideoMode);
        });
    });

    updateEstimator(currentVideoMode); // Initial update

    // Dispatch initial event on load if a mode is already active
    const initialActiveCard = document.querySelector('.mode-card.active');
    if (initialActiveCard) {
        currentVideoMode = initialActiveCard.dataset.mode;
        localStorage.setItem('video_mode', currentVideoMode);
        const event = new CustomEvent('videoModeChange', { detail: { mode: currentVideoMode, resolution: VIDEO_MODE_PRESETS[currentVideoMode].resolutionDefault } });
        document.dispatchEvent(event);
    }
};

window.getCurrentVideoMode = () => currentVideoMode;
window.getVideoModePreset = (mode) => VIDEO_MODE_PRESETS[mode];