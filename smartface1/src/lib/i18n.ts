import { cookies } from 'next/headers';
const D: Record<string, Record<string, string>> = {
  en: {
    login: 'Sign in', email: 'Email', password: 'Password', signing: 'Please wait…', company: 'SmartFace HR & Attendance',
    welcome: 'Welcome', logout: 'Sign out', employees: 'Total employees', present: 'Present today', absent: 'Absent today',
    late: 'Late today', soon: 'Coming in a later phase', setupTitle: 'First-time setup', name: 'Full name', setupKey: 'Setup key',
    create: 'Create administrator', setupDone: 'Administrator created. You can sign in now.', dataNote: 'Live from your Google Sheet',
    nav_dashboard: 'Dashboard', nav_employees: 'Employees', nav_attendance: 'Attendance', nav_leave: 'Leave', nav_payroll: 'Payroll', nav_reports: 'Reports', nav_settings: 'Settings',
    dbError: 'Could not read Google Sheets data. Check the Apps Script settings.',dbStatus: 'Database',sheetsStatus: 'Google Sheets',connected: 'Connected',failed: 'Not connected'
  },
  bn: {
    login: 'সাইন ইন', email: 'ইমেইল', password: 'পাসওয়ার্ড', signing: 'অপেক্ষা করুন…', company: 'স্মার্টফেস এইচআর ও অ্যাটেনডেন্স',
    welcome: 'স্বাগতম', logout: 'সাইন আউট', employees: 'মোট কর্মী', present: 'আজ উপস্থিত', absent: 'আজ অনুপস্থিত',
    late: 'আজ দেরিতে', soon: 'পরবর্তী ফেজে আসছে', setupTitle: 'প্রথমবার সেটআপ', name: 'পূর্ণ নাম', setupKey: 'সেটআপ কী',
    create: 'অ্যাডমিন তৈরি করুন', setupDone: 'অ্যাডমিন তৈরি হয়েছে। এখন সাইন ইন করুন।', dataNote: 'আপনার গুগল শিট থেকে সরাসরি',
    nav_dashboard: 'ড্যাশবোর্ড', nav_employees: 'কর্মী', nav_attendance: 'হাজিরা', nav_leave: 'ছুটি', nav_payroll: 'বেতন', nav_reports: 'রিপোর্ট', nav_settings: 'সেটিংস',
    dbError: 'গুগল শিটের ডাটা পড়া যায়নি। Apps Script সেটিং দেখুন।',dbStatus: 'ডাটাবেস',sheetsStatus: 'গুগল শিট',connected: 'সংযুক্ত',failed: 'সংযুক্ত নয়'
  }
};
export function getLang(): 'en' | 'bn' { return cookies().get('lang')?.value === 'bn' ? 'bn' : 'en'; }
export function dict() { const l = getLang(); return { l, t: (k: string) => D[l][k] || k }; }
