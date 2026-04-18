const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TIKTOK_API = 'https://open.tiktokapis.com';
const AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/';

/**
 * TikTok Service - Upload video via Content Posting API (v2).
 *
 * Credentials file (data/tiktok_credentials.json):
 * {
 *   "client_key": "...",
 *   "client_secret": "...",
 *   "redirect_uri": "http://localhost:3000/api/tiktok/callback",
 *   "mode": "direct" | "inbox"    // default: "inbox" (draft)
 * }
 *
 * Mode explanation:
 *  - "inbox" (default): Upload ke draft inbox. User finalisasi caption &
 *    publish manual di aplikasi TikTok. Tidak butuh audited scope.
 *  - "direct": Langsung publish. Butuh scope `video.publish` + aplikasi
 *    sudah lulus review TikTok Content Posting API.
 */
class TikTokService {
    constructor() {
        this.tokenPath = path.join(__dirname, '../data/tiktok_tokens.json');
        this.credentialsPath = path.join(__dirname, '../data/tiktok_credentials.json');
        this.credentials = null;
        this.tokens = null;
        this.initialize();
    }

    initialize() {
        try {
            if (fs.existsSync(this.credentialsPath)) {
                this.credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
            } else {
                console.log('⚠️ TikTok Service: credentials file not found at ' + this.credentialsPath);
            }
            if (fs.existsSync(this.tokenPath)) {
                this.tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
                console.log('✅ TikTok Service initialized with existing tokens.');
            } else {
                console.log('⚠️ TikTok Service: tokens not found. Authentication required.');
            }
        } catch (error) {
            console.error('❌ TikTok Service Initialization Error:', error.message);
        }
    }

    _requireCredentials() {
        if (!this.credentials || !this.credentials.client_key || !this.credentials.client_secret) {
            throw new Error('TikTok credentials not configured. Isi data/tiktok_credentials.json');
        }
    }

    _getMode() {
        return (this.credentials && this.credentials.mode) || 'inbox';
    }

    getAuthUrl() {
        this._requireCredentials();
        const redirectUri = this.credentials.redirect_uri || 'http://localhost:3000/api/tiktok/callback';
        // Inbox mode: cukup video.upload. Direct publish butuh video.publish juga.
        const scopes = this._getMode() === 'direct'
            ? 'user.info.basic,video.upload,video.publish'
            : 'user.info.basic,video.upload';
        const url = new URL(AUTH_BASE);
        url.searchParams.set('client_key', this.credentials.client_key);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', scopes);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('state', 'tt_' + Date.now());
        return url.toString();
    }

    async saveTokens(code) {
        this._requireCredentials();
        const redirectUri = this.credentials.redirect_uri || 'http://localhost:3000/api/tiktok/callback';

        const res = await axios.post(
            `${TIKTOK_API}/v2/oauth/token/`,
            new URLSearchParams({
                client_key: this.credentials.client_key,
                client_secret: this.credentials.client_secret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const data = res.data;
        if (data.error) {
            throw new Error(`TikTok token exchange failed: ${data.error_description || data.error}`);
        }

        const tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in || 0) * 1000,
            refresh_expires_at: Date.now() + (data.refresh_expires_in || 0) * 1000,
            open_id: data.open_id,
            scope: data.scope,
            saved_at: new Date().toISOString()
        };

        const dataDir = path.dirname(this.tokenPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
        this.tokens = tokens;
        console.log('✅ TikTok tokens saved.');
        return tokens;
    }

    async _ensureFreshToken() {
        if (!this.tokens) throw new Error('TikTok belum terautentikasi.');
        // Refresh if access token expires within the next 60 seconds.
        if (this.tokens.expires_at && Date.now() < this.tokens.expires_at - 60_000) {
            return this.tokens.access_token;
        }
        if (!this.tokens.refresh_token) {
            throw new Error('TikTok refresh token hilang — silakan re-auth.');
        }
        const res = await axios.post(
            `${TIKTOK_API}/v2/oauth/token/`,
            new URLSearchParams({
                client_key: this.credentials.client_key,
                client_secret: this.credentials.client_secret,
                grant_type: 'refresh_token',
                refresh_token: this.tokens.refresh_token
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const data = res.data;
        if (data.error) throw new Error(`TikTok refresh failed: ${data.error_description || data.error}`);

        this.tokens.access_token = data.access_token;
        this.tokens.refresh_token = data.refresh_token || this.tokens.refresh_token;
        this.tokens.expires_at = Date.now() + (data.expires_in || 0) * 1000;
        fs.writeFileSync(this.tokenPath, JSON.stringify(this.tokens, null, 2));
        return this.tokens.access_token;
    }

    async revokeTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) fs.unlinkSync(this.tokenPath);
            this.tokens = null;
            console.log('✅ TikTok connection disconnected.');
            return true;
        } catch (error) {
            console.error('❌ Error revoking TikTok tokens:', error.message);
            return false;
        }
    }

    isAuthenticated() {
        return !!(this.tokens && this.tokens.access_token);
    }

    async getUserProfile() {
        if (!this.isAuthenticated()) return null;
        try {
            const token = await this._ensureFreshToken();
            const res = await axios.get(`${TIKTOK_API}/v2/user/info/`, {
                params: { fields: 'open_id,display_name,avatar_url,follower_count' },
                headers: { Authorization: `Bearer ${token}` }
            });
            const u = res.data?.data?.user;
            if (!u) return null;
            return {
                id: u.open_id,
                title: u.display_name,
                thumbnail: u.avatar_url,
                followers: u.follower_count
            };
        } catch (error) {
            console.error('❌ Error fetching TikTok user:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Upload video. Default ke `inbox` (draft) kecuali credentials.mode = "direct".
     * Alur: init -> PUT chunk -> (direct mode) auto-publish; (inbox mode) user finish di app.
     */
    async uploadVideo({ path: videoPath, title, description }) {
        if (!this.isAuthenticated()) throw new Error('TikTok belum terautentikasi.');
        if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);

        const token = await this._ensureFreshToken();
        const mode = this._getMode();
        const stat = fs.statSync(videoPath);
        const videoSize = stat.size;

        console.log(`🚀 Starting TikTok upload (${mode} mode): "${title}"...`);

        const initEndpoint = mode === 'direct'
            ? `${TIKTOK_API}/v2/post/publish/video/init/`
            : `${TIKTOK_API}/v2/post/publish/inbox/video/init/`;

        const sourceInfo = {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1
        };
        const body = mode === 'direct'
            ? {
                post_info: {
                    title: [title, description].filter(Boolean).join('\n\n').slice(0, 2200),
                    privacy_level: 'SELF_ONLY',
                    disable_duet: false,
                    disable_comment: false,
                    disable_stitch: false
                },
                source_info: sourceInfo
            }
            : { source_info: sourceInfo };

        const initRes = await axios.post(initEndpoint, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (initRes.data.error && initRes.data.error.code !== 'ok') {
            throw new Error(`TikTok init failed: ${initRes.data.error.message}`);
        }
        const publishId = initRes.data.data.publish_id;
        const uploadUrl = initRes.data.data.upload_url;

        // PUT the whole file as one chunk
        await axios.put(uploadUrl, fs.createReadStream(videoPath), {
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': videoSize,
                'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`
            }
        });

        console.log(`   ✅ TikTok upload complete. publish_id=${publishId} (${mode})`);
        return {
            success: true,
            id: publishId,
            mode,
            note: mode === 'inbox'
                ? 'Video terkirim ke inbox TikTok — finalisasi & publish manual di app.'
                : 'Video dipublish langsung ke TikTok (privacy: SELF_ONLY).'
        };
    }
}

module.exports = new TikTokService();
