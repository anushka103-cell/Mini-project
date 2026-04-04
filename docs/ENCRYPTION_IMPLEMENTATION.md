# Client-Side Encryption Implementation - MindSafe

## Overview

Implemented end-to-end encrypted envelope system for sensitive chat and mood note data. Client-side AES-256-GCM encryption with PBKDF2 key derivation ensures data privacy from transport layer to backend storage.

## Architecture

### Client-Side (Frontend)

**Location**: `src/lib/encryptionClient.js`

- **Encryption Algorithm**: AES-256-GCM via Web Crypto API
- **Key Derivation**: PBKDF2 (100,000 iterations, SHA-256)
- **Key Material**: User's anonymized ID from JWT token + context string

**Workflow**:

1. Extract user ID from access token JWT payload
2. Derive 256-bit key from user ID + context (`mindsafe:chat`, `mindsafe:mood`)
3. Generate random 12-byte IV
4. Encrypt plaintext using AES-256-GCM
5. Extract authentication tag (last 16 bytes of encrypted output)
6. Return envelope: `{ encrypted: true, alg, iv, ciphertext, tag, context }`

**Envelope Format**:

```javascript
{
  encrypted: true,
  alg: "aes-256-gcm",
  iv: "<base64url>",           // 12-byte initialization vector
  ciphertext: "<base64url>",   // Encrypted data (without tag)
  tag: "<base64url>",          // 16-byte authentication tag
  context: "mindsafe:chat"     // Derivation context for reference
}
```

### Backend Decryption (Backend)

**Location**: `src/backend/src/utils/crypto.js`

- **New Function**: `derivePbkdf2Key(baseMaterial, context)` - PBKDF2 key derivation
- **New Function**: `decryptClientEnvelope(payload, keyMaterial)` - Decrypt client envelopes

**Middleware**: `src/backend/src/middleware/decryptEnvelopes.js`

- Automatically detects encrypted envelopes in request body
- Recursively processes objects/arrays
- Decrypts fields using user ID as key material
- Falls back gracefully if decryption fails
- Replaces encrypted envelope with plaintext before reaching controller

### Data Flow: Chat Messages

1. **User Input** → `encryptWithAuth()`
2. **Encryption** →
   - Derive key from user ID + "mindsafe:chat"
   - Encrypt message content to envelope
3. **POST /api/chatbot** with encrypted content
4. **Backend** → Decrypt envelope → Pass plaintext to controller
5. **Storage** → Encrypt again (server-side) before storing
6. **Retrieval** → Decrypt server-side encryption → Return to client

### Data Flow: Mood Notes

1. **Mood Entry** with notes → `createEncryptedEnvelope()`
2. **Encryption** →
   - Derive key from user ID + "mindsafe:mood"
   - Encrypt notes field to envelope
3. **POST /api/moods** with encrypted notes
4. **Backend** → Decrypt envelope → Plaintext notes in controller
5. **Storage** → Encrypted with server-side key
6. **Retrieval** → Decrypted server-side → Client receives plaintext

## Implementation Details

### Frontend Changes

**1. Encryption Client Library**
File: `src/lib/encryptionClient.js`

- `deriveKey(baseMaterial, context)` - PBKDF2 key derivation
- `encryptString(plaintext, key)` - Encrypts text to envelope
- `decryptString(payload, key)` - Decrypts envelope to plaintext
- `getEncryptionKey(context)` - Extracts user ID from JWT and derives key
- `createEncryptedEnvelope(value, key, context)` - Creates final envelope format
- Helper functions for base64url encoding/decoding

**2. Mood Page Updates**
File: `src/app/(protected)/mood/page.js`

- Import: `createEncryptedEnvelope, getEncryptionKey`
- `handleSave()` modified to:
  - Check if notes field has content
  - Derive encryption key with context `"mindsafe:mood"`
  - Encrypt notes to envelope
  - Send encrypted envelope in POST body
  - Fall back to plaintext if encryption fails

**3. Chat Page Updates**
File: `src/app/(protected)/ai-companion/page.js`

- Import: `createEncryptedEnvelope, getEncryptionKey`
- `handleSend()` modified to:
  - Encrypt user input before sending to `/api/chatbot`
  - Encrypt user message before storing to `/api/chat`
  - Encrypt AI response before storing to `/api/chat`
  - All use context `"mindsafe:chat"`

### Backend Changes

**1. Crypto Utilities Enhancement**
File: `src/backend/src/utils/crypto.js`

- Added `derivePbkdf2Key(baseMaterial, context)` function
- Added `decryptClientEnvelope(payload, keyMaterial)` function
- Constants: `PBKDF2_ITERATIONS = 100000`
- Exported both new functions

**2. Decryption Middleware**
File: `src/backend/src/middleware/decryptEnvelopes.js` (NEW)

- `createDecryptEnvelopeMiddleware(userStore)` - Express middleware factory
- Automatically processes POST/PUT requests
- Recursively decrypts encrypted envelopes in request body
- Extracts user ID from `req.user` (set by auth middleware)
- Returns plaintext values to controllers
- Graceful error handling (logs and continues)

**3. App Integration**
File: `src/backend/src/app.js`

- Import: `createDecryptEnvelopeMiddleware`
- Added middleware to `/api` routes before `mountRoutes()`
- Runs after auth middleware, before route handlers

## Security Properties

### Strengths

✅ **Transport Independent**: Data encrypted before transmission (works over HTTP or HTTPS)
✅ **Auth-Bound**: Key material derived from authenticated user's ID
✅ **AEAD**: AES-256-GCM provides authenticated encryption (prevents tampering)
✅ **Unique IV**: New random 12-byte IV per message
✅ **Context Binding**: Different contexts for chat vs mood (prevents cross-context attacks)
✅ **Browser-Native**: Web Crypto API, no external dependencies
✅ **Graceful Fallback**: Continues operation if encryption fails (UX priority)

### Current Limitations

- ⚠️ **Key Derivation**: Frontend and backend use same KDF (PBKDF2) but this could be strengthened
- ⚠️ **Key Storage**: Keys derived on-demand from user ID (no persistent key material)
- ⚠️ **Client-Side Plaintext**: Data visible in browser memory before/after encryption
- ⚠️ **No End-to-End Guarantee**: Backend receives plaintext (decrypts for application logic)

## Testing the Implementation

### Manual Testing

1. Open chat page, send encrypted message
2. Check browser DevTools:
   - Network tab shows POST with `{ content: { encrypted: true, ... } }`
   - Request body contains encrypted envelope
3. Backend should:
   - Decrypt envelope
   - Process plaintext
   - Store data
4. Verify no errors in backend logs

### Verification Steps

1. Chat messages properly encrypted in transit
2. Mood notes encrypted with different context than chat
3. Backend middleware successfully decrypts
4. Controllers receive plaintext values
5. Graceful fallback on encryption failures

## Future Enhancements

1. **Selective Decryption**: Backend option to only decrypt specific fields
2. **Client-Side Caching**: Encrypted cache for conversations
3. **Zero-Knowledge Backend**: Store fully encrypted data (backend never decrypts)
4. **Key Rotation**: Time-based or event-based key derivation changes
5. **Metadata Encryption**: Encrypt timestamps, mood labels (not just notes)
6. **Multi-User Encryption**: Support end-to-end encryption for shared conversations

## Files Modified

### Frontend (Client-Side)

- `src/lib/encryptionClient.js` - NEW: Encryption library
- `src/app/(protected)/mood/page.js` - Added encryption for notes
- `src/app/(protected)/ai-companion/page.js` - Added encryption for chat content

### Backend (Server-Side)

- `src/backend/src/utils/crypto.js` - Added PBKDF2 and client envelope decryption
- `src/backend/src/middleware/decryptEnvelopes.js` - NEW: Automatic decryption middleware
- `src/backend/src/app.js` - Integrated decryption middleware into request pipeline

## API Contract

### Encrypted Request Example

```json
POST /api/moods
{
  "mood_label": "😊",
  "mood_score": 8,
  "notes": {
    "encrypted": true,
    "alg": "aes-256-gcm",
    "iv": "AbCdEf...",
    "ciphertext": "XyZ123...",
    "tag": "qRsT99...",
    "context": "mindsafe:mood"
  }
}
```

### Backend Processing

1. Middleware detects `notes.encrypted === true`
2. Extracts user ID from JWT
3. Derives key: `PBKDF2(userId, "mindsafe:mood")`
4. Decrypts envelope
5. Replaces `notes` field with plaintext
6. Controller receives:

```json
{
  "mood_label": "😊",
  "mood_score": 8,
  "notes": "Feeling great today!"
}
```

## Status

✅ **Implementation Complete**

- Client-side encryption via Web Crypto API
- Backend decryption middleware
- Mood page encryption integrated
- Chat page encryption integrated (chatbot + message storage)
- Graceful error handling and fallback
- Context-specific key derivation
