const fs = require('fs');
const path = require('path');
const axios = require('axios');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Facebook Service - Upload video/Reels ke Facebook Page via Graph API.
 *
 * Credentials file (data/facebook_credentials.json) expected shape:
 * {
 *   "app_id": "...",
 *   "app_secret": "...",
 *   "redirect_uri": "http://localhost:3000/api/facebook/callback"
 * }
 *
 * Token file (data/facebook_tokens.json) will store the selected
 * page access token + page id after user authorizes.
 */
class FacebookService {
    constructor() {
        this.tokenPath = path.join(__dirname, '../data/facebook_tokens.json');
        this.credentialsPath = path.join(__dirname, '../data/facebook_credentials.json');
        this.credentials = null;
        this.tokens = null;
        this.initialize();
    }

    initialize() {
        try {
            if (fs.existsSync(this.credentialsPath)) {
                this.credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
            } else {
                console.log('⚠️ Facebook Service: credentials file not found at ' + this.credentialsPath);
            }
            if (fs.existsSync(this.tokenPath)) {
                this.tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
                console.log('✅ Facebook Service initialized with existing tokens.');
            } else {
                console.log('⚠️ Facebook Service: tokens not found. Authentication required.');
            }
        } catch (error) {
            console.error('❌ Facebook Service Initialization Error:', error.message);
        }
    }

    _requireCredentials() {
        if (!this.credentials || !this.credentials.app_id || !this.credentials.app_secret) {
            throw new Error('Facebook credentials not configured. Isi data/facebook_credentials.json');
        }
    }

    getAuthUrl() {
        this._requireCredentials();
        const redirectUri = this.credentials.redirect_uri || 'http://localhost:3000/api/facebook/callback';
        const scopes = [
            'pages_show_list',
            'pages_read_engagement',
            'pages_manage_posts',
            'pages_manage_engagement'
        ].join(',');
        const url = new URL('https://www.facebook.com/' + GRAPH_VERSION + '/dialog/oauth');
        url.searchParams.set('client_id', this.credentials.app_id);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', scopes);
        url.searchParams.set('response_type', 'code');
        return url.toString();
    }

    async saveTokens(code) {
        this._requireCredentials();
        const redirectUri = this.credentials.redirect_uri || 'http://localhost:3000/api/facebook/callback';

        // 1. Exchange code -> short-lived user token
        const tokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
            params: {
                client_id: this.credentials.app_id,
                client_secret: this.credentials.app_secret,
                redirect_uri: redirectUri,
                code
            }
        });
        const userShortToken = tokenRes.data.access_token;

        // 2. Upgrade to long-lived user token (~60 days)
        const longRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: this.credentials.app_id,
                client_secret: this.credentials.app_secret,
                fb_exchange_token: userShortToken
            }
        });
        const userLongToken = longRes.data.access_token;

        // 3. Fetch pages the user manages + their page tokens.
        //    Page tokens derived from a long-lived user token do not expire.
        const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
            params: { access_token: userLongToken, fields: 'id,name,access_token,category' }
        });
        const pages = pagesRes.data.data || [];
        if (!pages.length) {
            throw new Error('Akun ini tidak mengelola Facebook Page apa pun.');
        }

        // Pilih Page pertama sebagai default (kebanyakan user hanya punya 1).
        const primary = pages[0];
        const tokens = {
            user_token: userLongToken,
            page_id: primary.id,
            page_name: primary.name,
            page_token: primary.access_token,
            available_pages: pages.map(p => ({ id: p.id, name: p.name, category: p.category })),
            saved_at: new Date().toISOString()
        };

        const dataDir = path.dirname(this.tokenPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
        this.tokens = tokens;
        console.log(`✅ Facebook tokens saved. Page: ${primary.name} (${primary.id})`);
        return tokens;
    }

    async revokeTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) fs.unlinkSync(this.tokenPath);
            this.tokens = null;
            console.log('✅ Facebook connection disconnected.');
            return true;
        } catch (error) {
            console.error('❌ Error revoking Facebook tokens:', error.message);
            return false;
        }
    }

    isAuthenticated() {
        return !!(this.tokens && this.tokens.page_token && this.tokens.page_id);
    }

    async getPageProfile() {
        if (!this.isAuthenticated()) return null;
        try {
            const res = await axios.get(`${GRAPH_BASE}/${this.tokens.page_id}`, {
                params: {
                    access_token: this.tokens.page_token,
                    fields: 'id,name,picture,fan_count'
                }
            });
            return {
                id: res.data.id,
                title: res.data.name,
                thumbnail: res.data.picture?.data?.url,
                followers: res.data.fan_count
            };
        } catch (error) {
            console.error('❌ Error fetching FB page profile:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Upload video to the connected Page.
     * Uses Graph API resumable upload (single-request form POST, baik untuk
     * Shorts ≤ ~1GB). Set `asReel=true` untuk publish sebagai Reel.
     */
    async uploadVideo({ path: videoPath, title, description, asReel = true }) {
        if (!this.isAuthenticated()) {
            throw new Error('Facebook belum terautentikasi.');
        }
        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found: ${videoPath}`);
        }
        const pageId = this.tokens.page_id;
        const pageToken = this.tokens.page_token;

        console.log(`🚀 Starting Facebook ${asReel ? 'Reel' : 'video'} upload: "${title}"...`);

        // Reels pipeline: 3 steps (start -> upload -> finish).
        // Start
        const startRes = await axios.post(
            `${GRAPH_BASE}/${pageId}/video_reels`,
            null,
            { params: { upload_phase: 'start', access_token: pageToken } }
        );
        const videoId = startRes.data.video_id;
        const uploadUrl = startRes.data.upload_url;

        // Upload binary via header-based protocol
        const stat = fs.statSync(videoPath);
        const stream = fs.createReadStream(videoPath);
        await axios.post(uploadUrl, stream, {
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            headers: {
                Authorization: `OAuth ${pageToken}`,
                offset: '0',
                file_size: String(stat.size),
                'Content-Type': 'application/octet-stream'
            }
        });

        // Finish (and publish)
        const finishRes = await axios.post(
            `${GRAPH_BASE}/${pageId}/video_reels`,
            null,
            {
                params: {
                    access_token: pageToken,
                    video_id: videoId,
                    upload_phase: 'finish',
                    video_state: 'PUBLISHED',
                    description: [title, description].filter(Boolean).join('\n\n').slice(0, 2200)
                }
            }
        );

        const permalink = `https://www.facebook.com/reel/${videoId}`;
        console.log(`   ✅ FB Reel published. ID: ${videoId}`);
        return {
            success: true,
            id: videoId,
            url: permalink,
            data: finishRes.data
        };
    }
}

module.exports = new FacebookService();
