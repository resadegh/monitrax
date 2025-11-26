# OAuth Quick Start - Google (5 Minutes)

The fastest way to enable social login in Monitrax.

---

## ⚡ 5-Minute Setup

### Step 1: Create Google Project (1 min)

1. Go to https://console.cloud.google.com/
2. Click "New Project"
3. Name: `Monitrax`
4. Click "Create"

### Step 2: Configure OAuth (2 min)

1. Search for "OAuth consent screen" in the search bar
2. Select "External" → Click "Create"
3. Fill in:
   - App name: `Monitrax`
   - User support email: `your-email@gmail.com`
   - Developer contact: `your-email@gmail.com`
4. Click "Save and Continue" (3 times - skip scopes and test users)

### Step 3: Get Credentials (1 min)

1. Go to "Credentials" (left sidebar)
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: `Monitrax Web`
5. Add redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
6. Click "Create"
7. **Copy** Client ID and Client Secret

### Step 4: Add to .env (1 min)

Create or edit `.env` in project root:

```bash
GOOGLE_CLIENT_ID="paste-your-client-id-here"
GOOGLE_CLIENT_SECRET="paste-your-client-secret-here"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"
```

### Step 5: Restart & Test

```bash
npm run dev
```

Go to: http://localhost:3000/login

You should now see "Continue with Google" button! 🎉

---

## ✅ Verification Checklist

- [ ] Created Google Cloud project
- [ ] Configured OAuth consent screen
- [ ] Created OAuth credentials
- [ ] Added redirect URI: `http://localhost:3000/api/auth/callback/google`
- [ ] Copied Client ID and Secret to `.env`
- [ ] Restarted dev server
- [ ] "Continue with Google" button appears on login page
- [ ] Clicking button redirects to Google login

---

## 🐛 Troubleshooting

**Button not showing?**
- Check `.env` file (not `.env.example`)
- Restart server: `Ctrl+C` then `npm run dev`
- Visit: http://localhost:3000/api/auth/providers
  - Should show `"google": true`

**"redirect_uri_mismatch" error?**
- Verify redirect URI in Google Console matches exactly:
  ```
  http://localhost:3000/api/auth/callback/google
  ```
- No trailing slash!
- Must include port `:3000`

**"invalid_client" error?**
- Double-check Client ID and Secret in `.env`
- No extra spaces
- Wrapped in quotes

---

## 📚 Next Steps

**Add more providers:**
- See full guide: `docs/OAUTH-SETUP.md`
- Facebook setup: ~10 minutes
- Microsoft setup: ~10 minutes
- Apple setup: ~30 minutes (requires $99/year developer account)

**Production deployment:**
1. Update OAuth consent screen with production domain
2. Add production redirect URI to Google Console:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```
3. Update `.env` production file:
   ```bash
   GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/callback/google"
   ```

---

**Need help?** See full documentation: `docs/OAUTH-SETUP.md`
