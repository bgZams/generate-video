# Privacy Policy

**Last updated:** 2026-04-18

## 1. Overview

This application ("the App") is a self-hosted tool installed and operated by the individual user (the "Operator") on their own computer or server. This Privacy Policy explains what data the App handles and how.

The App is **single-tenant**: it is used only by the Operator, who is also the owner of the connected social media accounts. The App's authors do not operate any central server that receives, stores, or processes user data.

## 2. Data We Do NOT Collect
 
- The App does not transmit any data to its authors.
- The App does not use analytics, telemetry, or tracking of any kind.
- The App does not collect data from users of the Operator's social media accounts (viewers, followers, commenters, etc.).

## 3. Data the App Handles Locally

When the Operator connects their social media accounts, the following data is stored **locally on the Operator's machine**, inside the `data/` directory of the App's installation:

- **OAuth access tokens and refresh tokens** for YouTube, Facebook, and TikTok.
- **Basic public profile information** returned by each platform's API (channel/page/username, display name, avatar URL, follower count) — used only to display connection status in the UI.
- **Scheduler configuration** (topics, cron schedule, privacy preferences).
- **Title history** to avoid duplicate content generation.

These files never leave the Operator's machine unless the Operator explicitly copies them.

## 4. Data Sent to Third-Party APIs

When the Operator triggers an upload, the App sends the following data to the corresponding platform's API:

- **YouTube Data API** — the generated video file, title, description, tags, privacy setting, and optional thumbnail.
- **Meta Graph API (Facebook)** — the generated video file and caption text, published as a Reel on the Operator's Page.
- **TikTok Content Posting API** — the generated video file and caption, uploaded to the Operator's TikTok inbox (or published directly if the Operator's app has been approved for that scope).

These uploads are authorized by the Operator's own OAuth tokens and are governed by each platform's Privacy Policy:

- Google/YouTube: https://policies.google.com/privacy
- Meta/Facebook: https://www.facebook.com/privacy/policy
- TikTok: https://www.tiktok.com/legal/privacy-policy

## 5. AI Provider APIs

The App uses generative-AI providers (Gemini, OpenAI, and/or Claude) to produce video scripts and metadata. Prompts sent to these providers may include the topic the Operator entered. The App does not send OAuth tokens or connected-account data to AI providers.

AI provider policies:
- Google Gemini: https://ai.google.dev/terms
- OpenAI: https://openai.com/policies/privacy-policy
- Anthropic Claude: https://www.anthropic.com/legal/privacy

## 6. Scopes Requested

| Platform | Scopes | Purpose |
|----------|--------|---------|
| YouTube  | `youtube.upload`, `youtube.readonly` | Upload videos and read the Operator's own channel profile. |
| Facebook | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement` | List the Operator's Pages and publish Reels on them. |
| TikTok   | `user.info.basic`, `video.upload` (and `video.publish` if direct mode is enabled) | Upload videos to the Operator's account. |

The App only requests the scopes listed above.

## 7. Data Retention & Deletion

- All tokens and profile information remain on the Operator's machine until the Operator disconnects the platform through the App's UI (which deletes the corresponding token file) or manually deletes the files under `data/`.
- Revoking access in the platform's own security settings (Google Account Permissions, Meta Business Integrations, TikTok Manage Apps) will immediately invalidate the tokens held by the App.

## 8. Security

- Tokens are stored as plain JSON files inside the App installation directory. The Operator is responsible for the security of their own machine and must not commit these files to public source control.
- All communication with third-party APIs uses HTTPS.

## 9. Children's Privacy

The App is not directed at children under 13. The Operator is responsible for ensuring that any content they publish complies with the target platform's rules regarding minors.

## 10. Changes to This Policy

This Privacy Policy may be updated from time to time. The most recent version will be published in the App's repository.

## 11. Contact

For questions about this Privacy Policy, please open an issue in the App's public repository.
