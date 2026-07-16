document.addEventListener('DOMContentLoaded', () => {
    const componentContainer = document.getElementById('component-container');
    const mainNavTabs = document.getElementById('main-nav-tabs');
    let activeComponent = '';

    const componentMapping = {
        'global-settings': 'components/global-settings.html',
        'video-shorts-generator': 'components/video-shorts-generator.html',
        'video-standard-generator': 'components/video-standard-generator.html',
        'video-long-generator': 'components/video-long-generator.html',
        'automation-connect': 'components/automation-connect.html'
    };

    // Global progress SSE tracking state
    let progressSSE = null;

    // =========================================================================
    // FormStateManager — namespaced, scalable form state across components
    // =========================================================================
    const FormStateManager = {
        // Namespaced store: { "global-settings": { "resolution": "16:9", ... }, ... }
        _store: {},
        // Tracks which component is currently rendered in the DOM
        _active: '',

        init() {
            document.addEventListener('input', this._onInput.bind(this));
            document.addEventListener('change', this._onInput.bind(this));
        },

        // ---- Auto-capture: delegated listener ----
        _onInput(e) {
            const ns = this._active;
            if (!ns) return;                       // no component mounted yet

            const el = e.target;
            if (!(el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;

            const fieldId = el.id || el.name;
            if (!fieldId) return;                   // unidentifiable element
            if (el.type === 'file' || el.type === 'password') return;  // skip

            if (!this._store[ns]) this._store[ns] = {};

            // Key = componentName::fieldId  (stored under namespace object for fast lookup)
            if (el.type === 'checkbox' || el.type === 'radio') {
                this._store[ns][fieldId] = { type: 'bool', value: el.checked };
            } else {
                this._store[ns][fieldId] = { type: 'value', value: el.value };
            }
        },

        // ---- Public API ----

        /** Snapshot every trackable input currently in the DOM into the given namespace. */
        save(component) {
            const container = document.getElementById('video-form') || document.getElementById('component-container');
            if (!container) return;

            if (!this._store[component]) this._store[component] = {};

            container.querySelectorAll('input, select, textarea').forEach(el => {
                const fieldId = el.id || el.name;
                if (!fieldId) return;
                if (el.type === 'file' || el.type === 'password') return;

                if (el.type === 'checkbox' || el.type === 'radio') {
                    this._store[component][fieldId] = { type: 'bool', value: el.checked };
                } else {
                    this._store[component][fieldId] = { type: 'value', value: el.value };
                }
            });
        },

        /**
         * Restore saved state for a component back into the DOM.
         * @param {string}  component         - namespace key
         * @param {Object}  [opts]
         * @param {boolean} [opts.notify=false] - if true, dispatch 'change' after setting each value
         */
        restore(component, opts) {
            const notify = (opts && opts.notify === true);
            const bucket = this._store[component];
            if (!bucket) return;

            Object.keys(bucket).forEach(fieldId => {
                const el = document.getElementById(fieldId)
                        || document.querySelector('[name="' + fieldId + '"]');
                if (!el) return;

                const entry = bucket[fieldId];
                if (entry.type === 'bool') {
                    el.checked = entry.value;
                } else {
                    el.value = entry.value;
                }

                if (notify) {
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        },

        /** Remove all saved state for a single component. */
        clear(component) {
            delete this._store[component];
        },

        /** Remove state for a component AND stop tracking it as active. */
        destroy(component) {
            delete this._store[component];
            if (this._active === component) this._active = '';
        },

        /** Tell the manager which component is currently in the DOM. */
        setActive(component) {
            this._active = component;
        }
    };

    // Boot the manager once
    FormStateManager.init();
    // Expose to window so component scripts can call save/restore/clear if needed
    window.FormStateManager = FormStateManager;

    window.updateProgressUI = function(phase, pct, message) {
        const fillEl = document.getElementById('progress-bar-fill');
        const pctEl = document.getElementById('progress-pct');
        const txtEl = document.getElementById('progress-text');
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
        if (txtEl) txtEl.textContent = message || 'Memproses...';

        // Handle error phase — progress bar merah + pesan error
        if (phase === 'error') {
            if (fillEl) fillEl.style.background = '#e53935';
            document.querySelectorAll('.phase-item').forEach(el => {
                el.classList.remove('active');
            });
            return;
        } else {
            if (fillEl) fillEl.style.background = '';
        }

        const phaseOrder = ['tts', 'image', 'render', 'bgm', 'thumbnail', 'done'];
        const activeIdx = phaseOrder.indexOf(phase);
        document.querySelectorAll('.phase-item').forEach((el, i) => {
            el.classList.remove('active', 'done');
            if (i < activeIdx) el.classList.add('done');
            else if (i === activeIdx) el.classList.add('active');
        });
    };

    window.startProgressSSE = function(jobId) {
        if (progressSSE) { progressSSE.close(); progressSSE = null; }
        if (!jobId) return;
        progressSSE = new EventSource(`/api/job/${jobId}/progress`);
        progressSSE.onmessage = (ev) => {
            try {
                const { phase, pct, message } = JSON.parse(ev.data);
                window.updateProgressUI(phase, pct, message);
                if (phase === 'done' || phase === 'error') {
                    progressSSE.close();
                    progressSSE = null;
                }
            } catch (_) {}
        };
        progressSSE.onerror = () => {
            window.updateProgressUI('error', 100, 'Koneksi ke server terputus. Coba refresh.');
            progressSSE.close();
            progressSSE = null;
        };
        window.progressSSE = progressSSE;
    };

    // Load a component's HTML & scripts dynamically
    async function loadComponent(componentName) {
        const path = componentMapping[componentName];
        if (!path) {
            console.error(`Component ${componentName} not found.`);
            return;
        }

        // Save state of the component that is about to be removed from the DOM
        if (activeComponent) {
            FormStateManager.save(activeComponent);
        }

        // Clean up previous interval/listeners if any
        if (window.currentConsoleInterval) {
            clearInterval(window.currentConsoleInterval);
            window.currentConsoleInterval = null;
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load component ${componentName}: ${response.statusText}`);
            }
            const html = await response.text();
            
            // Render HTML content inside form wrapper so inputs are naturally serialized together
            const form = document.getElementById('video-form');
            if (form) {
                form.innerHTML = html;
            } else {
                componentContainer.innerHTML = html;
            }
            
            activeComponent = componentName;

            // Tell the state manager which component is now in the DOM
            FormStateManager.setActive(componentName);

            // Execute scripts inside the template (dynamic module execution)
            const templateScripts = (form || componentContainer).querySelectorAll('script');
            templateScripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                if (oldScript.src) {
                    // Extract path relative to root or base to append cache buster
                    const srcUrl = new URL(oldScript.src, window.location.href);
                    srcUrl.searchParams.set('t', Date.now());
                    newScript.src = srcUrl.pathname + srcUrl.search;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                newScript.type = oldScript.type || 'text/javascript';
                oldScript.parentNode.removeChild(oldScript);
                document.body.appendChild(newScript);
            });

            // Initialize JavaScript context for components
            initializeDynamicElements();

            // Restore previously saved form state after component init
            // `notify: false` prevents infinite loops and unwanted event bubbling side effects
            FormStateManager.restore(componentName, { notify: false });

            // Update Tab active style
            if (mainNavTabs) {
                mainNavTabs.querySelectorAll('.tab-button').forEach(button => {
                    if (button.dataset.component === componentName) {
                        button.classList.add('active');
                    } else {
                        button.classList.remove('active');
                    }
                });
            }

        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
            componentContainer.innerHTML = `<p style="color: red;">Failed to load ${componentName}.</p>`;
        }
    }

    // Initialize dynamic elements based on active tab component
    function initializeDynamicElements() {
        switch (activeComponent) {
            case 'global-settings':
                if (window.initGlobalSettings) window.initGlobalSettings();
                break;
            case 'video-shorts-generator':
                if (window.initVideoShortsGenerator) window.initVideoShortsGenerator();
                break;
            case 'video-standard-generator':
                if (window.initVideoStandardGenerator) window.initVideoStandardGenerator();
                break;
            case 'video-long-generator':
                if (window.initVideoLongGenerator) window.initVideoLongGenerator();
                break;
            case 'automation-connect':
                if (window.initAutomationConnect) window.initAutomationConnect();
                break;
            default:
                console.warn(`No init found for component: ${activeComponent}`);
        }
    }

    // Single global listener for videoModeChange custom event
    document.addEventListener('videoModeChange', (e) => {
        const newMode = e.detail.mode;
        const resolutionSelect = document.getElementById('resolution');
        if (resolutionSelect) {
            const preset = window.getVideoModePreset ? window.getVideoModePreset(newMode) : null;
            if (preset) resolutionSelect.value = preset.resolutionDefault;
        }
        
        // Auto-resize slides based on the selected preset (e.g. 9 for shorts, 25 for medium, 50 for long)
        const preset = window.getVideoModePreset ? window.getVideoModePreset(newMode) : null;
        if (preset && window.ensureSlideCount) {
            window.ensureSlideCount(preset.slideCount);
        }
    });

    // Navigation Tab switching handler
    if (mainNavTabs) {
        mainNavTabs.addEventListener('click', (event) => {
            const button = event.target.closest('.tab-button');
            if (button) {
                const componentName = button.dataset.component;
                if (componentName && componentName !== activeComponent) {
                    loadComponent(componentName);
                }
            }
        });
    }

    // Initial Load
    loadComponent('global-settings');
});
