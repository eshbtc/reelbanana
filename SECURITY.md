# 🔐 ReelBanana Security Guide

This document outlines the security measures implemented for the ReelBanana project to protect sensitive data and API keys.

## 🚨 Security Status: SECURED ✅

All sensitive configuration data has been moved from the codebase to Google Cloud Secret Manager.

## 📋 What Was Secured

### Firebase Configuration
- ✅ `firebase-api-key` - Firebase API key
- ✅ `firebase-project-id` - Firebase project ID  
- ✅ `firebase-auth-domain` - Firebase auth domain
- ✅ `firebase-storage-bucket` - Firebase storage bucket
- ✅ `firebase-messaging-sender-id` - Firebase messaging sender ID
- ✅ `firebase-app-id` - Firebase app ID

### Backend Service Configuration
- ✅ All backend services use environment variables for sensitive data
- ✅ ElevenLabs API key stored as environment variable in Cloud Run
- ✅ Google Cloud Storage credentials handled automatically by Cloud Run

## 🛡️ Security Measures Implemented

### 1. Google Cloud Secret Manager
All sensitive configuration is now stored in Google Cloud Secret Manager:

```bash
# List all Firebase secrets
gcloud secrets list --filter="name~firebase"
```

### 2. Environment Variables
The application now uses environment variables instead of hardcoded values:

```typescript
// Before (INSECURE - hardcoded)
const firebaseConfig = {
  apiKey: "AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg",
  // ... other config
};

// After (SECURE - environment variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  // ... other config
};
```

### 3. .gitignore Protection
Updated `.gitignore` to prevent accidental commits of sensitive files:

```
# Environment variables and sensitive data
.env
.env.local
.env.production
.env.ai-studio
.env.*.local
*.env

# API keys and secrets
**/secrets/
**/keys/
**/*.key
**/*.pem
**/*.p12
```

### 4. Environment Template
Created `env.template` for safe configuration sharing without exposing real values.

## 🚀 Setup Instructions

### For Development

1. **Run the setup script:**
   ```bash
   ./scripts/setup-secrets.sh
   ```

2. **Or manually create .env.local:**
   ```bash
   # Retrieve secrets and create .env.local
   echo "VITE_FIREBASE_API_KEY=$(gcloud secrets versions access latest --secret=firebase-api-key)" > .env.local
   echo "VITE_FIREBASE_PROJECT_ID=$(gcloud secrets versions access latest --secret=firebase-project-id)" >> .env.local
   echo "VITE_FIREBASE_AUTH_DOMAIN=$(gcloud secrets versions access latest --secret=firebase-auth-domain)" >> .env.local
   echo "VITE_FIREBASE_STORAGE_BUCKET=$(gcloud secrets versions access latest --secret=firebase-storage-bucket)" >> .env.local
   echo "VITE_FIREBASE_MESSAGING_SENDER_ID=$(gcloud secrets versions access latest --secret=firebase-messaging-sender-id)" >> .env.local
   echo "VITE_FIREBASE_APP_ID=$(gcloud secrets versions access latest --secret=firebase-app-id)" >> .env.local
   echo "NODE_ENV=development" >> .env.local
   ```

### For AI Studio Deployment

1. **Set environment variables in AI Studio:**
   - `VITE_FIREBASE_API_KEY` = (retrieve from Secret Manager)
   - `VITE_FIREBASE_PROJECT_ID` = (retrieve from Secret Manager)
   - `VITE_FIREBASE_AUTH_DOMAIN` = (retrieve from Secret Manager)
   - `VITE_FIREBASE_STORAGE_BUCKET` = (retrieve from Secret Manager)
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = (retrieve from Secret Manager)
   - `VITE_FIREBASE_APP_ID` = (retrieve from Secret Manager)
   - `NODE_ENV` = `ai-studio`

### For Production Deployment

1. **Set environment variables in your deployment platform**
2. **Use the same Secret Manager secrets**
3. **Set `NODE_ENV=production`**

## 🔧 Managing Secrets

### View All Secrets
```bash
gcloud secrets list
```

### Retrieve a Secret Value
```bash
gcloud secrets versions access latest --secret=firebase-api-key
```

### Update a Secret
```bash
echo "new-value" | gcloud secrets versions add firebase-api-key --data-file=-
```

### Delete a Secret (if needed)
```bash
gcloud secrets delete firebase-api-key
```

## 🚨 Security Best Practices

### ✅ DO:
- Use Google Cloud Secret Manager for all sensitive data
- Set up proper IAM permissions for Secret Manager
- Rotate API keys regularly
- Monitor API usage and set up billing alerts
- Use different keys for development and production
- Keep .env files out of version control

### ❌ DON'T:
- Hardcode API keys in source code
- Commit .env files to version control
- Share API keys in chat/email
- Use the same keys across environments
- Ignore security warnings

## 🔍 Monitoring and Alerts

### Set up monitoring for:
1. **API Usage**: Monitor Firebase and Gemini API usage
2. **Billing Alerts**: Set up Google Cloud billing alerts
3. **Access Logs**: Monitor Secret Manager access logs
4. **Failed Authentication**: Monitor failed API calls

### Google Cloud Console:
- [Secret Manager](https://console.cloud.google.com/security/secret-manager)
- [Firebase Console](https://console.firebase.google.com)
- [Billing](https://console.cloud.google.com/billing)

## 🆘 Emergency Procedures

### If API Keys Are Compromised:

1. **Immediately rotate the keys:**
   ```bash
   # Update the secret in Secret Manager
   echo "new-api-key" | gcloud secrets versions add firebase-api-key --data-file=-
   ```

2. **Update all deployments** with new environment variables

3. **Monitor for suspicious activity**

4. **Review access logs** in Google Cloud Console

## 📞 Support

If you encounter security issues:

1. Check this security guide
2. Review Google Cloud Secret Manager documentation
3. Contact your security team
4. Consider implementing additional security measures like Firebase App Check

---

**Last Updated**: September 6, 2025  
**Security Status**: ✅ SECURED  
**Next Review**: Recommended monthly
