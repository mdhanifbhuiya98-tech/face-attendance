# SmartFace HR – Next.js + Neon + Google Sheets

## ডাটা কোথায় থাকে
- **Neon (PostgreSQL):** ইউজার, Argon2id পাসওয়ার্ড, লগইন হিস্ট্রি, এনক্রিপ্ট করা ফেস টেমপ্লেট
- **Google Sheet (Apps Script দিয়ে):** কর্মী, বিভাগ, শিফট, হাজিরা, ছুটি, বেতন, ছুটির দিন ইত্যাদি

## ধাপ
1. **Neon:** neon.tech → প্রজেক্ট → Connection string কপি (`DATABASE_URL`)।
2. **Apps Script:** `apps-script/Code.gs` পুরোটা বসান → Script properties-এ `API_SECRET` দিন → Deploy → Manage deployments → New version (Access: Anyone)।
3. **GitHub:** নতুন repository-তে এই ZIP-এর সব ফাইল ও ফোল্ডার (`src`, `public`, `apps-script` সহ) আপলোড করুন।
4. **Vercel:** Framework **Next.js**। Environment Variables:
   `DATABASE_URL`, `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_SECRET` (= API_SECRET), `SESSION_SECRET`, `SETUP_KEY`, `FACE_ENCRYPTION_KEY`
5. Deploy। তারপর `/setup` → অ্যাডমিন তৈরি → `/login`।
6. Settings মেনুতে "System status" তিনটিই ✓ হলে সব সংযুক্ত।

নিয়ম: কর্মী নিজের হাজিরা/ছুটি দিতে চাইলে ইউজারের ইমেইল ও Employees-এর ইমেইল একই হতে হবে।
