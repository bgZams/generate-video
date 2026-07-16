const cron = require('node-cron');
const automationService = require('./automationService');
const fs = require('fs');
const path = require('path');

/**
 * Scheduler Service - Manages cron jobs for automated video generation
 */
class SchedulerService {
    constructor() {
        this.jobs = {};
        this.configPath = path.join(__dirname, '../data/scheduler_config.json');
        this.loadConfig();
    }

    /**
     * Load scheduler configuration
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            } else {
                // Default: Daily at 9:00 AM
                this.config = {
                    enabled: false,
                    schedule: '0 5,11,16,20 * * *',
                    topic: 'Fakta Menarik Dunia',
                    voice: 'edge-id-gadis',
                    privacyStatus: 'public',
                    visualEffect: 'none',
                    vignette: false
                };
                this.saveConfig();
            }
        } catch (error) {
            console.error('Error loading scheduler config:', error);
            this.config = { enabled: false, schedule: '0 9 * * *' };
        }
    }

    /**
     * Save scheduler configuration
     */
    saveConfig() {
        try {
            const dataDir = path.dirname(this.configPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving scheduler config:', error);
        }
    }

    /**
     * Clean up old files in specified directories.
     * @param {string[]} dirs - Directories to clean.
     * @param {number} maxAgeHours - Files older than this will be deleted.
     */
    cleanupOldFiles(dirs, maxAgeHours = 7 * 24) { // Default: 7 days
        const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        dirs.forEach(dir => {
            const absoluteDirPath = path.join(__dirname, '..', dir);
            if (!fs.existsSync(absoluteDirPath)) return;

            fs.readdirSync(absoluteDirPath).forEach(file => {
                const filePath = path.join(absoluteDirPath, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (stats.isFile() && stats.mtimeMs < cutoff) {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ Deleted old file: ${filePath}`);
                    }
                } catch (e) {
                    console.error(`Error deleting file ${filePath}:`, e.message);
                }
            });
        });
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.jobs.main) {
            this.jobs.main.stop();
        }

        if (this.config.enabled) {
            console.log(`⏰ Scheduler Started: ${this.config.schedule}`);
            this.jobs.main = cron.schedule(this.config.schedule, async () => {
                console.log('🔔 Scheduled Task Triggered!');
                await automationService.runFullWorkflow({
                    topic: this.config.topic,
                    voice: this.config.voice,
                    privacyStatus: this.config.privacyStatus,
                    visualEffect: this.config.visualEffect || 'none',
                    vignette: this.config.vignette || false,
                    videoMode: this.config.videoMode || 'short'
                });
            });
        } else {
            console.log('💤 Scheduler is disabled.');
        }
    }

    /**
     * Update configuration and restart scheduler
     */
    update(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
        this.start();
        return this.config;
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            ...this.config,
            isRunning: !!this.jobs.main
        };
    }
}

module.exports = new SchedulerService();
