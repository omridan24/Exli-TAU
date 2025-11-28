Exli - Financial Operating System

📂 Project Structure

exli-front/: React Frontend (Vite + Tailwind + Firebase)

exli-backend/: Python API (Flask + Gemini AI + Pandas)


🚀 Frontend Workflow (React)

1. Run Locally (Development)

Use this to verify UI changes before deploying.

cd exli-front
npm run dev


URL: http://localhost:5173

Note: It connects to the live Cloud Run backend and live Firebase DB (if configured).

2. Deploy to Production

When you are happy with your changes:

Build the static files:

npm run build


(This creates/updates the dist folder)

Deploy to Firebase Hosting:

firebase deploy


(This uploads the dist folder to the web)

Verify: Open https://exli-24.web.app

🧠 Backend Workflow (Cloud Run)

Since the backend relies on cloud secrets and heavy libraries, we usually don't run it locally. We deploy changes directly to test them.

1. Make Changes

Edit main.py or requirements.txt.

2. Deploy to Cloud

Run this single command to package and ship your code.
Important: Always include your API key or it might get unset.

cd exli-backend
gcloud run deploy exli-processor --source . --set-env-vars GEMINI_API_KEY="YOUR_AIZA_KEY"


Time: Takes ~45-90 seconds.

Verify: Check the URL provided in the terminal or visit /health_check.

3. Debugging Logs

If something breaks, watch the logs live in your terminal:

gcloud run services logs tail exli-processor
