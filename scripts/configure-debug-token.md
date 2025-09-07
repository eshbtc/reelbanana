# Configure Debug Token for E2E Testing

## Firebase App Check Debug Token Setup

To enable E2E testing with the debug token `CCB3BE2A-AD22-49A7-8EE2-B4884C5E43FB`, you need to configure it in the Firebase Console.

### Steps:

1. **Go to Firebase Console**
   - Open: https://console.firebase.google.com/
   - Select project: `reel-banana-35a54`

2. **Navigate to App Check**
   - In the left sidebar, click "App Check"
   - You should see your web app listed

3. **Add Debug Token**
   - Click on your web app (reel-banana-35a54)
   - Scroll down to "Debug tokens" section
   - Click "Add debug token"
   - Enter the token: `CCB3BE2A-AD22-49A7-8EE2-B4884C5E43FB`
   - Add a label: "E2E Testing"
   - Click "Save"

4. **Verify Configuration**
   - The debug token should now appear in the list
   - Status should show as "Active"

### Test the Configuration:

Once configured, you can test with:

```bash
export APP_CHECK_TOKEN="CCB3BE2A-AD22-49A7-8EE2-B4884C5E43FB"
./scripts/e2e_smoke.sh
```

### Security Notes:

- Debug tokens are only for development/testing
- They should be removed from production
- The token is project-specific and app-specific
- Only works for the configured Firebase project

### Alternative: Use Real Tokens

If you prefer not to use debug tokens, you can get real App Check tokens from the browser:

1. Go to https://reel-banana-35a54.web.app
2. Open Dev Tools → Console
3. Run: `await firebase.appCheck().getToken()`
4. Copy the token and use it for testing

This approach is more secure but requires manual token generation for each test session.
