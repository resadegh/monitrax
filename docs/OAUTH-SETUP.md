# OAuth Setup Guide - Monitrax

This guide explains how to configure OAuth providers for social login in Monitrax.

---

## Quick Start

1. Choose at least one OAuth provider (Google recommended for easiest setup)
2. Follow the provider-specific instructions below
3. Add credentials to your `.env` file
4. Restart your application
5. Social login buttons will appear automatically on the login page

---

## Table of Contents

- [Google OAuth 2.0](#google-oauth-20) (⭐ **Recommended - Easiest Setup**)
- [Facebook Login](#facebook-login)
- [Microsoft OAuth 2.0](#microsoft-oauth-20)
- [Apple Sign In](#apple-sign-in) (⚠️ **Advanced - Requires Apple Developer Account**)
- [Testing Your Configuration](#testing-your-configuration)
- [Troubleshooting](#troubleshooting)

---

## Google OAuth 2.0

⭐ **Recommended for beginners** - Free, no verification required for development.

### Prerequisites
- A Google account (Gmail)

### Step-by-Step Setup

#### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: `Monitrax` (or your preferred name)
4. Click **Create**

#### 2. Enable Google+ API

1. In the search bar, type "Google+ API" or go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click **Enable**

#### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (for testing with any Google account)
3. Click **Create**
4. Fill in required fields:
   - **App name:** Monitrax
   - **User support email:** your-email@gmail.com
   - **Developer contact:** your-email@gmail.com
5. Click **Save and Continue**
6. On **Scopes** page, click **Add or Remove Scopes**
7. Add these scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
8. Click **Update** → **Save and Continue**
9. On **Test users**, click **Add Users** and add your test email addresses
10. Click **Save and Continue**

#### 4. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type:** Web application
4. **Name:** Monitrax Web Client
5. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:3000
   ```
6. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

#### 5. Add to Environment Variables

Add to your `.env` file:

```bash
GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"
```

#### 6. Production Setup

For production, add your production domain:

1. Go back to **Credentials** → Edit your OAuth client
2. Add production URLs:
   - **Authorized JavaScript origins:** `https://yourdomain.com`
   - **Authorized redirect URIs:** `https://yourdomain.com/api/auth/callback/google`
3. Update `.env` for production:
   ```bash
   GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/callback/google"
   ```

---

## Facebook Login

### Prerequisites
- A Facebook account
- A verified email address and phone number on Facebook

### Step-by-Step Setup

#### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Consumer** as app type
4. Click **Next**
5. Fill in details:
   - **App name:** Monitrax
   - **App contact email:** your-email@example.com
6. Click **Create App**

#### 2. Add Facebook Login Product

1. In the dashboard, find **Facebook Login**
2. Click **Set Up**
3. Select **Web** platform
4. Enter Site URL: `http://localhost:3000`
5. Click **Save** → **Continue**
6. Skip the rest of the quickstart

#### 3. Configure Facebook Login Settings

1. Go to **Products** → **Facebook Login** → **Settings**
2. Under **Valid OAuth Redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/facebook
   ```
3. Click **Save Changes**

#### 4. Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy **App ID**
3. Click **Show** on **App Secret** and copy it
4. (You may need to re-enter your Facebook password)

#### 5. Add to Environment Variables

Add to your `.env` file:

```bash
FACEBOOK_CLIENT_ID="your-app-id-here"
FACEBOOK_CLIENT_SECRET="your-app-secret-here"
FACEBOOK_REDIRECT_URI="http://localhost:3000/api/auth/callback/facebook"
```

#### 6. Switch to Live Mode (Production)

1. Toggle **App Mode** from **Development** to **Live** (top of dashboard)
2. You may need to provide additional information (privacy policy URL, etc.)
3. Add production redirect URI:
   ```
   https://yourdomain.com/api/auth/callback/facebook
   ```

---

## Microsoft OAuth 2.0

### Prerequisites
- A Microsoft account (Outlook, Hotmail, or Azure)

### Step-by-Step Setup

#### 1. Register Application

1. Go to [Azure Portal - App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Fill in details:
   - **Name:** Monitrax
   - **Supported account types:** Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI:** Select **Web** and enter:
     ```
     http://localhost:3000/api/auth/callback/microsoft
     ```
4. Click **Register**

#### 2. Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. **Description:** Monitrax Web Client
4. **Expires:** 24 months (or custom)
5. Click **Add**
6. **⚠️ IMPORTANT:** Copy the **Value** immediately (you won't be able to see it again)

#### 3. Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `User.Read`
   - `email`
   - `openid`
   - `profile`
6. Click **Add permissions**

#### 4. Get Application ID

1. Go to **Overview**
2. Copy **Application (client) ID**

#### 5. Add to Environment Variables

Add to your `.env` file:

```bash
MICROSOFT_CLIENT_ID="your-application-id-here"
MICROSOFT_CLIENT_SECRET="your-client-secret-here"
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/auth/callback/microsoft"
```

#### 6. Production Setup

For production:

1. Go to **Authentication**
2. Add production redirect URI:
   ```
   https://yourdomain.com/api/auth/callback/microsoft
   ```
3. Update `.env`:
   ```bash
   MICROSOFT_REDIRECT_URI="https://yourdomain.com/api/auth/callback/microsoft"
   ```

---

## Apple Sign In

⚠️ **Advanced Setup Required**

### Prerequisites
- An Apple Developer account ($99/year)
- A verified domain

### Step-by-Step Setup

#### 1. Create an App ID

1. Go to [Apple Developer - Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click **+** → Select **App IDs** → **Continue**
3. Select **App** → **Continue**
4. Fill in:
   - **Description:** Monitrax
   - **Bundle ID:** `com.yourdomain.monitrax`
5. Check **Sign in with Apple**
6. Click **Continue** → **Register**

#### 2. Create a Services ID

1. Go to **Identifiers** → Click **+**
2. Select **Services IDs** → **Continue**
3. Fill in:
   - **Description:** Monitrax Web
   - **Identifier:** `com.yourdomain.monitrax.web`
4. Check **Sign in with Apple**
5. Click **Configure**
6. **Primary App ID:** Select the App ID created in step 1
7. Add **Domains and Subdomains:**
   ```
   yourdomain.com
   ```
8. Add **Return URLs:**
   ```
   https://yourdomain.com/api/auth/callback/apple
   ```
   (⚠️ Apple requires HTTPS - no localhost testing)
9. Click **Save** → **Continue** → **Register**

#### 3. Create a Private Key

1. Go to **Keys** → Click **+**
2. **Key Name:** Monitrax Apple Sign In Key
3. Check **Sign in with Apple**
4. Click **Configure** → Select your App ID
5. Click **Save** → **Continue** → **Register**
6. **Download** the `.p8` file immediately (you can only download once)
7. Note the **Key ID** (10-character string)

#### 4. Generate Client Secret (JWT)

Apple requires generating a JWT token as the client secret. Use this Node.js script:

```javascript
// generate-apple-secret.js
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('./AuthKey_XXXXXXXXXX.p8', 'utf8');

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',
  audience: 'https://appleid.apple.com',
  issuer: 'YOUR_TEAM_ID',  // 10-character Team ID
  subject: 'com.yourdomain.monitrax.web',  // Your Services ID
  keyid: 'YOUR_KEY_ID',  // 10-character Key ID
});

console.log('Apple Client Secret (JWT):');
console.log(token);
```

Run:
```bash
npm install jsonwebtoken
node generate-apple-secret.js
```

#### 5. Add to Environment Variables

```bash
APPLE_CLIENT_ID="com.yourdomain.monitrax.web"
APPLE_CLIENT_SECRET="eyJhbGciOiJFUzI1NiIsImtpZCI6..."  # Generated JWT
APPLE_REDIRECT_URI="https://yourdomain.com/api/auth/callback/apple"
```

**⚠️ Note:** Apple Sign In only works in production with HTTPS. Cannot be tested on localhost.

---

## Testing Your Configuration

### 1. Verify Environment Variables

Check your `.env` file has at least one provider configured:

```bash
# At minimum for Google
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"
```

### 2. Restart Application

```bash
npm run dev
```

### 3. Check Configured Providers

Visit: `http://localhost:3000/api/auth/providers`

You should see:

```json
{
  "providers": ["google"],
  "available": {
    "google": true,
    "facebook": false,
    "apple": false,
    "microsoft": false
  }
}
```

### 4. Test Login Flow

1. Go to: `http://localhost:3000/login`
2. You should see a "Continue with Google" button (or whichever provider you configured)
3. Click the button
4. Complete OAuth flow in popup/redirect
5. You should be redirected back and logged in

---

## Troubleshooting

### Issue: "OAuth providers not configured" message still showing

**Solution:**
1. Verify environment variables are set in `.env` (not `.env.example`)
2. Restart your dev server: `npm run dev`
3. Check for typos in CLIENT_ID and CLIENT_SECRET
4. Clear browser cache and reload

### Issue: "redirect_uri_mismatch" error

**Solution:**
1. Verify redirect URI in provider console exactly matches your `.env` file
2. Common mistakes:
   - `http://` vs `https://`
   - Trailing slash: `/api/auth/callback/google` vs `/api/auth/callback/google/`
   - Port number: `:3000` included or not
3. Update provider console if needed
4. Wait 5-10 minutes for changes to propagate

### Issue: "invalid_client" error

**Solution:**
1. Double-check CLIENT_ID and CLIENT_SECRET are correct
2. Ensure no extra spaces in `.env` file
3. For Google: Check if API is enabled (Google+ API)
4. For Facebook: Check if app is in Development vs Live mode

### Issue: "Access blocked: This app's request is invalid"

**Solution (Google):**
1. Go to OAuth consent screen
2. Verify all required fields are filled
3. Add test users if app is in "Testing" mode
4. Check scopes are added correctly

### Issue: Provider button not showing on login page

**Solution:**
1. Check `/api/auth/providers` endpoint returns `true` for provider
2. Verify `getConfiguredProviders()` function in `lib/auth/oauth.ts`
3. Check browser console for JavaScript errors
4. Clear browser cache

### Issue: "User cancelled the OAuth flow"

**Normal behavior** - User clicked "Cancel" or closed OAuth popup. No action needed.

---

## Security Best Practices

### Development
- ✅ Use test/development credentials only
- ✅ Add test users to OAuth consent screen
- ✅ Keep `.env` in `.gitignore`
- ✅ Never commit credentials to Git

### Production
- ✅ Use separate production credentials
- ✅ Enable HTTPS (required for all providers)
- ✅ Verify your domain ownership
- ✅ Set up OAuth consent screen properly
- ✅ Request only necessary scopes
- ✅ Rotate client secrets periodically
- ✅ Use environment variables or secret management
- ✅ Monitor OAuth provider dashboards for suspicious activity

---

## FAQ

**Q: Do I need all four providers?**
A: No. Configure at least one. Google is recommended for easiest setup.

**Q: Can I test Apple Sign In on localhost?**
A: No. Apple requires HTTPS and a verified domain. Use Google or Facebook for local testing.

**Q: What if I don't want OAuth?**
A: That's fine! Users can still sign in with email/password or magic links.

**Q: How much does this cost?**
A: Google, Facebook, and Microsoft are free. Apple requires a $99/year developer account.

**Q: What data does OAuth collect?**
A: Only: email, name (optional), profile picture (optional). No passwords are stored for OAuth users.

**Q: Can users link multiple OAuth accounts?**
A: Yes! Users can link Google, Facebook, etc. to the same Monitrax account.

**Q: How do I add more providers?**
A: Edit `lib/auth/oauth.ts` to add new providers. Follow existing patterns.

---

## Need Help?

- Check the [Troubleshooting](#troubleshooting) section
- Review provider-specific documentation:
  - [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)
  - [Facebook Login Docs](https://developers.facebook.com/docs/facebook-login)
  - [Microsoft Identity Docs](https://learn.microsoft.com/en-us/azure/active-directory/develop/)
  - [Apple Sign In Docs](https://developer.apple.com/sign-in-with-apple/)
- Open an issue on GitHub with:
  - Which provider you're configuring
  - Error message you're seeing
  - Steps you've already tried

---

**Last Updated:** 2025-11-26
**Version:** 1.0
