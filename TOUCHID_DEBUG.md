# TouchID Registration Debugging Guide

## Issue
TouchID registration is failing in the admin panel.

## Common Causes

### 1. **Browser Requirements**
TouchID/WebAuthn requires:
- **HTTPS** in production OR **localhost** in development
- You MUST access via `http://localhost:3002` (NOT `http://127.0.0.1:3002` or IP address)
- Safari, Chrome, or Edge (Firefox has limited WebAuthn support)

### 2. **RP_ID and Origin Mismatch**
Current backend configuration (from `backend/src/routes/admin/webauthn.js`):
- RP_ID: `localhost` (development)
- ORIGIN: `http://localhost:3002` (development)

**ACTION REQUIRED**: Make sure you're accessing the admin panel at exactly `http://localhost:3002`

### 3. **Browser Console Errors**
Open Chrome/Safari DevTools (F12 or Cmd+Option+I) and check for errors when clicking "Register Security Key"

Common errors:
- `NotAllowedError`: User cancelled or timeout
- `SecurityError`: Wrong RP_ID/Origin configuration
- `InvalidStateError`: Credential already registered
- `NotSupportedError`: Browser doesn't support WebAuthn

## Debugging Steps

### Step 1: Verify Access URL
```bash
# Make sure you're accessing:
open http://localhost:3002/login

# NOT these:
# http://127.0.0.1:3002/login  ❌
# http://192.168.x.x:3002/login  ❌
```

### Step 2: Check Browser Console
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Click "Register Security Key" button
4. Look for errors in red

### Step 3: Check Backend Logs
```bash
# If running backend directly:
cd backend
pnpm dev

# Watch for errors when you attempt registration
```

### Step 4: Check Network Tab
1. Open DevTools → Network tab
2. Click "Register Security Key"
3. Look for these requests:
   - POST `/api/admin/webauthn/register/options` - Should return 200
   - POST `/api/admin/webauthn/register/verify` - Should return 200 or error

### Step 5: Verify Browser Support
```javascript
// Paste in browser console:
if (window.PublicKeyCredential) {
  console.log('✅ WebAuthn is supported');
  PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    .then(available => {
      if (available) {
        console.log('✅ TouchID/FaceID/Windows Hello is available');
      } else {
        console.log('❌ Platform authenticator (TouchID) NOT available');
      }
    });
} else {
  console.log('❌ WebAuthn NOT supported in this browser');
}
```

## Quick Fix Checklist

- [ ] Accessing via `http://localhost:3002` (not 127.0.0.1 or IP)
- [ ] Backend server running on port 3001
- [ ] Admin frontend running on port 3002
- [ ] Using Safari, Chrome, or Edge browser
- [ ] Browser console shows no errors before clicking button
- [ ] Database is accessible (check with `docker-compose ps`)

## Test Registration Flow

1. Go to `http://localhost:3002/login`
2. Click "Register Security Key"
3. Enter email: `test@example.com`
4. Click "Register Security Key" button
5. Browser should prompt for TouchID/security key
6. Check browser console for any errors

## Expected Success Flow

1. Click "Register Security Key" → No console errors
2. POST to `/register/options` → Returns 200 with challenge
3. Browser shows TouchID prompt
4. Approve with TouchID
5. POST to `/register/verify` → Returns `{"verified":true}`
6. Alert: "Security key registered!"

## Next Steps

If you see a specific error, please share:
1. The exact error message from browser console
2. The Network tab requests/responses
3. Any backend server logs when you attempt registration
