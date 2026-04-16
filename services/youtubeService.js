const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * YouTube Service - Handles video uploads and channel management
 */
class YouTubeService {
    constructor() {
        this.youtube = null;
        this.oAuth2Client = null;
        this.tokenPath = path.join(__dirname, '../data/youtube_tokens.json');
        this.credentialsPath = path.join(__dirname, '../data/youtube_credentials.json');

        this.initialize();
    }

    /**
     * Initialize the OAuth2 client
     */
    initialize() {
        try {
            if (fs.existsSync(this.credentialsPath)) {
                const content = fs.readFileSync(this.credentialsPath, 'utf8');
                const credentials = JSON.parse(content);

                // Flexible structure detection
                const config = credentials.installed || credentials.web || credentials;

                if (!config || typeof config !== 'object') {
                    throw new Error('Invalid credentials format: config object not found.');
                }

                this.oAuth2Client = new google.auth.OAuth2(
                    config.client_id,
                    config.client_secret,
                    (config.redirect_uris && config.redirect_uris[0]) || 'http://localhost:3000/api/youtube/callback'
                );

                if (fs.existsSync(this.tokenPath)) {
                    const token = fs.readFileSync(this.tokenPath, 'utf8');
                    this.oAuth2Client.setCredentials(JSON.parse(token));
                    this.youtube = google.youtube({ version: 'v3', auth: this.oAuth2Client });
                    console.log('✅ YouTube Service initialized with existing tokens.');
                } else {
                    console.log('⚠️ YouTube Service: Tokens not found. Authentication required.');
                }
            } else {
                console.log('⚠️ YouTube Service: Credentials file not found at ' + this.credentialsPath);
            }
        } catch (error) {
            console.error('❌ YouTube Service Initialization Error:', error.message);
        }
    }

    /**
     * Upload a video to YouTube
     * @param {Object} videoData 
     * @param {string} videoData.path - Local path to mp4 file
     * @param {string} videoData.title - Video title
     * @param {string} videoData.description - Video description
     * @param {Array} videoData.tags - Array of tags
     * @param {string} videoData.privacyStatus - 'private', 'public', or 'unlisted'
     */
    async uploadVideo(videoData) {
        if (!this.youtube) {
            throw new Error('YouTube API not initialized. Please authenticate first.');
        }

        const {
            path: videoPath,
            title,
            description,
            tags = [],
            privacyStatus = 'private'
        } = videoData;

        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found at path: ${videoPath}`);
        }

        console.log(`🚀 Starting YouTube upload: "${title}" (${privacyStatus})...`);

        try {
            const response = await this.youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: (title || 'Untitled Video').substring(0, 100).replace(/[<>]/g, ''),
                        description: (description || '').substring(0, 5000).replace(/[<>]/g, ''),
                        tags: (() => {
                            const cleanTags = (Array.isArray(tags) ? tags : [])
                                .map(tag => String(tag).replace(/[<>]/g, '').trim())
                                .filter(tag => tag.length > 0 && tag.length <= 100);

                            const finalTags = [];
                            let currentLength = 0;
                            for (const tag of cleanTags) {
                                if (currentLength + tag.length + 1 <= 500) {
                                    finalTags.push(tag);
                                    currentLength += tag.length + 1;
                                } else break;
                            }
                            return finalTags.slice(0, 50);
                        })(),
                        categoryId: '22' // People & Blogs
                    },
                    status: {
                        privacyStatus: videoData.publishAt ? 'private' : privacyStatus,
                        publishAt: videoData.publishAt || undefined,
                        selfDeclaredMadeForKids: false
                    }
                },
                media: {
                    body: fs.createReadStream(videoPath)
                }
            });

            const videoId = response.data.id;
            console.log(`✅ Video uploaded successfully! ID: ${videoId}`);

            // Optional custom thumbnail
            let thumbnailResult = null;
            if (videoData.thumbnailPath && fs.existsSync(videoData.thumbnailPath)) {
                try {
                    console.log(`🖼️  Uploading custom thumbnail...`);
                    await this.youtube.thumbnails.set({
                        videoId,
                        media: {
                            body: fs.createReadStream(videoData.thumbnailPath)
                        }
                    });
                    thumbnailResult = { success: true };
                    console.log(`   ✅ Thumbnail uploaded.`);
                } catch (thumbErr) {
                    // Non-fatal — thumbnail permission may not be granted for all channels
                    console.warn(`   ⚠️ Thumbnail upload failed: ${thumbErr.message}`);
                    thumbnailResult = { success: false, error: thumbErr.message };
                }
            }

            return {
                success: true,
                id: videoId,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: thumbnailResult,
                data: response.data
            };
        } catch (error) {
            console.error('❌ YouTube Upload Error:', error.response?.data?.error || error.message);
            throw error;
        }
    }

    /**
     * Get Auth URL for the user to visit
     */
    getAuthUrl() {
        if (!this.oAuth2Client) {
            throw new Error('OAuth2 Client not initialized. Missing credentials.json?');
        }

        return this.oAuth2Client.generateAuthUrl({
            access_type: 'offline', // Important for refresh token
            scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
            prompt: 'select_account consent' // Force account selection and consent
        });
    }

    /**
     * Save tokens after user authorizes and returns code
     */
    async saveTokens(code) {
        if (!this.oAuth2Client) {
            throw new Error('OAuth2 Client not initialized.');
        }

        try {
            const { tokens } = await this.oAuth2Client.getToken(code);
            this.oAuth2Client.setCredentials(tokens);

            // Ensure data directory exists
            const dataDir = path.dirname(this.tokenPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            fs.writeFileSync(this.tokenPath, JSON.stringify(tokens));
            this.youtube = google.youtube({ version: 'v3', auth: this.oAuth2Client });

            console.log('✅ YouTube tokens saved successfully.');
            return tokens;
        } catch (error) {
            console.error('❌ YouTube Auth Error:', error.message);
            if (error.response) {
                console.error('Status:', error.response.status);
                const data = JSON.stringify(error.response.data);
                console.error('Response:', data);
            } else {
                console.error('No response (Possible Firewall/Network Block)');
            }
            throw error;
        }
    }

    /**
     * Revoke tokens and disconnect
     */
    async revokeTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) {
                fs.unlinkSync(this.tokenPath);
            }
            this.youtube = null;
            if (this.oAuth2Client) {
                this.oAuth2Client.setCredentials(null);
            }
            console.log('✅ YouTube connection disconnected.');
            return true;
        } catch (error) {
            console.error('❌ Error revoking tokens:', error.message);
            return false;
        }
    }

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return !!this.youtube;
    }

    /**
     * Get authenticated channel profile
     */
    async getChannelProfile() {
        if (!this.youtube) {
            return null;
        }

        try {
            const response = await this.youtube.channels.list({
                part: 'snippet,statistics',
                mine: true
            });

            const channel = response.data.items?.[0];
            if (!channel) return null;

            return {
                id: channel.id,
                title: channel.snippet.title,
                thumbnail: channel.snippet.thumbnails.default.url,
                subscribers: channel.statistics.subscriberCount
            };
        } catch (error) {
            console.error('❌ Error fetching channel profile:', error.message);
            return null;
        }
    }
}

module.exports = new YouTubeService();
