# SmartFace – Next.js সংস্করণ (Phase 1–2)

## ১. ডাটাবেস (পাসওয়ার্ড/বায়োমেট্রিক এখানে থাকবে, গুগল শিটে নয়)
1. neon.tech-এ বিনামূল্যে অ্যাকাউন্ট → New Project (Region: Singapore)।
2. Dashboard-এ **Connection string** কপি করুন (postgresql://… দিয়ে শুরু)। এটাই `DATABASE_URL`। কাউকে পাঠাবেন না।

## ২. Apps Script
1. `apps-script/Code.gs`-এর পুরো লেখা আপনার Apps Script-এ বসান (পুরোনোটা মুছে)।
2. Project Settings → Script properties → `API_SECRET` = একটি লম্বা র‍্যান্ডম গোপন লেখা।
3. Deploy → Manage deployments → ✏ → New version → Deploy (লিঙ্ক একই থাকবে, Access: Anyone)।

## ৩. GitHub
রিপোর ভেতরের পুরোনো `index.html` ও `Code.gs` মুছুন। ZIP Extract করে সব ফাইল/ফোল্ডার আপলোড করুন।

## ৪. Vercel
Framework Preset: **Next.js**। Environment Variables: `DATABASE_URL`, `GOOGLE_APPS_SCRIPT_URL` (/exec লিঙ্ক), `GOOGLE_APPS_SCRIPT_SECRET` (= API_SECRET), `SESSION_SECRET`, `SETUP_KEY`। তারপর Deploy/Redeploy।

## ৫. প্রথম অ্যাডমিন
`/setup` খুলে নাম, ইমেইল, পাসওয়ার্ড (১০+) ও SETUP_KEY দিন। তারপর `/login`। ড্যাশবোর্ডে Database ও Google Sheets-এর সবুজ বাতি দেখবেন।
