TECHNET AI BACKEND - RAILWAY DEPLOY

RAILWAY START COMMAND
node src/server.js

MANDATORY VARIABLES
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://technetgame.com.br,https://www.technetgame.com.br,https://technetgame-site.pages.dev
CORS_ORIGIN=true
API_URL=https://technetgame-backend-production.up.railway.app
OPENAI_API_KEY=YOUR_KEY
DEEPSEEK_API_KEY=YOUR_KEY

TEST THESE URLS AFTER DEPLOY
GET /api/v1/health
GET /api/v1/models
POST /api/v1/auth/demo

NOTES
- This backend keeps the old TechNetGame routes and also adds TechNet AI routes under /api/v1.
- If /api/v1/health returns {"error":"Rota não encontrada"}, the wrong code was deployed.
- The frontend technet-ai page must point to the Railway public domain of this service.

FALLBACK IA ATIVADO
- Groq principal via OPENAI_*
- OpenRouter fallback via OPENROUTER_*
- Configure as variáveis no Railway e faça redeploy.
