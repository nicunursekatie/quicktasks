# Firebase Functions Backend Migration Plan

## Current Setup
- **Frontend**: Static HTML/JS hosted on Firebase Hosting
- **Database**: Firestore (client-side access)
- **AI Integration**: Direct API calls from browser to OpenAI, Gemini, Groq, Anthropic

## Issues with Current Setup
1. **Security**: API keys exposed in browser localStorage
2. **CORS**: Some providers (OpenAI) have CORS restrictions for browser requests
3. **Rate Limiting**: No server-side control or request throttling
4. **Cost**: Can't monitor/control API usage effectively
5. **Features**: Limited to client-side capabilities

## Proposed Architecture

### Phase 1: Setup Firebase Functions
- Initialize Firebase Functions in the project
- Set up development environment
- Configure environment variables for API keys

### Phase 2: Create Backend API Endpoints
Create Cloud Functions for:

1. **AI Chat Endpoints**
   - `POST /api/ai/chat` - Universal AI chat endpoint
   - Route to appropriate provider based on user preference
   - Handle authentication and rate limiting

2. **Task Management**
   - `POST /api/tasks/breakdown` - ADHD-friendly breakdown
   - `POST /api/tasks/fuzzy-breakdown` - Fuzzy breakdown
   - `POST /api/tasks/simple-breakdown` - Simple breakdown
   - `POST /api/tasks/rephrase` - Task rephrasing

3. **Security & Auth**
   - Implement Firebase Authentication
   - Secure API keys in Functions environment
   - Add user-based rate limiting

### Phase 3: Database Migration
- Move user settings to Firestore
- Store API usage metrics
- Implement user preferences and history

### Phase 4: Frontend Updates
- Update `app.js` to call Firebase Functions instead of direct API calls
- Remove API keys from localStorage
- Add loading states and better error handling
- Implement retry logic

## Implementation Steps

### 1. Install Firebase CLI & Initialize Functions
```bash
npm install -g firebase-tools
firebase init functions
```

### 2. Install Dependencies
```bash
cd functions
npm install axios openai @google/generative-ai anthropic
```

### 3. Environment Configuration
```bash
firebase functions:config:set \
  openai.key="YOUR_KEY" \
  gemini.key="YOUR_KEY" \
  groq.key="YOUR_KEY" \
  anthropic.key="YOUR_KEY"
```

### 4. Create Function Examples

**functions/index.js**
```javascript
const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');

// AI Chat endpoint
exports.aiChat = onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');

  const { provider, prompt, systemPrompt } = req.body;

  // Route to appropriate AI provider
  switch(provider) {
    case 'openai':
      // Call OpenAI API
      break;
    case 'gemini':
      // Call Gemini API
      break;
    // etc...
  }
});

// Task breakdown endpoint
exports.taskBreakdown = onRequest(async (req, res) => {
  // Implementation
});
```

### 5. Update Frontend

**app.js changes**
```javascript
// Old: Direct API call
async function callOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
}

// New: Call Firebase Function
async function callAI(systemPrompt, userPrompt) {
  const response = await fetch('https://YOUR-PROJECT.cloudfunctions.net/aiChat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: settings.aiProvider,
      systemPrompt,
      userPrompt
    })
  });
}
```

## Benefits

1. **Security**
   - API keys stored securely server-side
   - No exposure in browser/localStorage

2. **Reliability**
   - No CORS issues
   - Centralized error handling
   - Request validation

3. **Monitoring**
   - Track API usage per user
   - Cost monitoring and alerts
   - Rate limiting and quotas

4. **Flexibility**
   - Easier to add new AI providers
   - Can implement caching
   - Server-side processing capabilities

5. **Scalability**
   - Auto-scaling with Firebase Functions
   - Better performance for complex operations

## Timeline Estimate

- **Phase 1**: 2-3 hours (setup)
- **Phase 2**: 4-6 hours (endpoint development)
- **Phase 3**: 2-3 hours (database migration)
- **Phase 4**: 3-4 hours (frontend updates)
- **Testing**: 2-3 hours

**Total**: ~15-20 hours

## Cost Considerations

- Firebase Functions free tier: 2M invocations/month
- Likely to stay within free tier for moderate usage
- AI API costs remain the same (just moved server-side)

## Next Steps

1. Review and approve this plan
2. Set up Firebase Functions
3. Implement basic AI endpoint
4. Test with one AI provider
5. Migrate remaining providers
6. Update frontend
7. Deploy and test
