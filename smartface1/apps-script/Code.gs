/**
 * SmartFace HR – Code.gs (Phase 1: লগইন, রোল, ইউজার, ড্যাশবোর্ড)
 * ব্যবহার: Google Sheet > Extensions > Apps Script-এ শুধু এই Code.gs পেস্ট করুন। index.html থাকবে Vercel-এ।
 * Project Settings > Script properties: API_SECRET = Vercel-এর GOOGLE_APPS_SCRIPT_SECRET-এর হুবহু মান (Next.js সার্ভারের জন্য)
 * (পুরোনো দুই-ফাইল পদ্ধতির জন্য) SETUP_KEY = আপনার গোপন কী (প্রথম অ্যাডমিন বানাতে লাগবে)
 * Project Settings > Time zone = Asia/Dhaka
 * Deploy > New deployment > Web app > Execute as: Me
 */
var SESSION_HOURS = 8, MAX_FAILS = 5, LOCK_MIN = 15, HASH_ROUNDS = 2000;
var ROLES = ['super_admin', 'hr_admin', 'hr_manager', 'dept_manager', 'employee'];

var SCHEMA = {
  users: ['id','email','name','role','password_hash','active','failed_attempts','locked_until','employee_id','last_login','created_at','updated_at'],
  sessions: ['id','user_id','token_hash','expires_at','created_at','updated_at'],
  login_history: ['id','user_id','email','success','reason','created_at','updated_at'],
  audit_logs: ['id','user_id','action','table_name','record_id','details','created_at','updated_at'],
  company_settings: ['id','key','value','created_at','updated_at'],
  departments: ['id','name','manager_employee_id','created_at','updated_at'],
  designations: ['id','name','created_at','updated_at'],
  employees: ['id','employee_code','full_name','photo_file_id','gender','phone','email','present_address','permanent_address','department_id','designation_id','joining_date','employment_type','employment_status','salary','shift_id','manager_id','emergency_contact','face_enrolled','created_at','updated_at']
};

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'SmartFace API' })).setMimeType(ContentService.MimeType.JSON);
}
// index.html (Vercel-এ হোস্ট করা) এই doPost-কে fetch দিয়ে কল করে
function doPost(e) {
  var r;
  try {
    var b = JSON.parse(e.postData.contents);
    if (b.secret !== undefined) {
      // Next.js সার্ভার থেকে আসা কল: API_SECRET মিলতে হবে এবং শুধু নির্ধারিত অ্যাকশন চলবে
      var s = PropertiesService.getScriptProperties().getProperty('API_SECRET');
      if (!s || b.secret !== s) throw new Error('unauthorized');
      if (!SRV_OK_[b.action]) throw new Error('action not allowed');
      r = api(b.action, '', b.payload, true);
    } else {
      r = api(b.action, b.token, b.payload);
    }
  } catch (err) {
    r = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}
var SRV_OK_ = { ping: 1, dashboard: 1, list: 1, save: 1, remove: 1, mark: 1, upload: 1, file: 1 };

/* ---------- একমাত্র এন্ট্রি পয়েন্ট (index.html এটাই কল করে) ---------- */
function api(action, token, p, server) {
  try {
    p = p || {};
    var fn = ACTIONS[action];
    if (!fn) throw new Error('unknown action');
    var ctx = PUBLIC_[action] ? null : (server ? { user: { id: 'server', role: 'super_admin', email: 'server@system' }, session: {} } : auth_(token));
    return { ok: true, data: fn(p, ctx, token) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
var PUBLIC_ = { bootstrap: 1, setup: 1, login: 1 };

var ACTIONS = {
  bootstrap: function () {
    var ready = !!sheet_('users');
    return { needsSetup: !ready || find_('users', {}, 1).length === 0 };
  },

  setup: function (p) {
    var key = PropertiesService.getScriptProperties().getProperty('SETUP_KEY');
    if (!key || p.setupKey !== key) throw new Error('Invalid setup key');
    var email = cleanEmail_(p.email);
    if (String(p.password || '').length < 10) throw new Error('Password must be at least 10 characters');
    setupSheets_();
    return withLock_(function () {
      if (find_('users', {}, 1).length) throw new Error('Setup already completed');
      insert_('users', { email: email, name: String(p.name || '').trim(), role: 'super_admin', active: 'true', failed_attempts: '0', password_hash: hashPw_(String(p.password)) });
      return 'ok';
    });
  },

  login: function (p) {
    var email = cleanEmail_(p.email);
    var u = find_('users', { email: email }, 1)[0];
    var log = function (ok, why) { insert_('login_history', { user_id: u ? u.id : '', email: email, success: String(ok), reason: why }); };
    if (!u || u.active !== 'true') { log(false, 'unknown or inactive'); throw new Error('Invalid email or password'); }
    if (u.locked_until && new Date(u.locked_until) > new Date()) { log(false, 'locked'); throw new Error('Account locked. Try again in ' + LOCK_MIN + ' minutes.'); }
    if (!verifyPw_(String(p.password || ''), u.password_hash)) {
      var n = (parseInt(u.failed_attempts, 10) || 0) + 1, patch = { failed_attempts: String(n) };
      if (n >= MAX_FAILS) { patch.failed_attempts = '0'; patch.locked_until = new Date(Date.now() + LOCK_MIN * 60000).toISOString(); }
      withLock_(function () { update_('users', u.id, patch); });
      log(false, 'wrong password');
      throw new Error('Invalid email or password');
    }
    var token = Utilities.getUuid() + Utilities.getUuid();
    withLock_(function () {
      update_('users', u.id, { failed_attempts: '0', locked_until: '', last_login: new Date().toISOString() });
      insert_('sessions', { user_id: u.id, token_hash: sha_(token), expires_at: new Date(Date.now() + SESSION_HOURS * 3600000).toISOString() });
    });
    log(true, 'ok');
    return { token: token, user: pub_(u) };
  },

  logout: function (p, ctx, token) {
    withLock_(function () { update_('sessions', ctx.session.id, { expires_at: new Date(0).toISOString() }); });
    return 'ok';
  },

  me: function (p, ctx) { return pub_(ctx.user); },

  dashboard: function () {
    return { employees: find_('employees', {}, 0).length, present: 0, absent: 0, late: 0 };
  },

  changePassword: function (p, ctx) {
    if (!verifyPw_(String(p.oldPassword || ''), ctx.user.password_hash)) throw new Error('Current password is wrong');
    if (String(p.newPassword || '').length < 10) throw new Error('Password must be at least 10 characters');
    withLock_(function () { update_('users', ctx.user.id, { password_hash: hashPw_(String(p.newPassword)) }); });
    return 'ok';
  },

  listUsers: function (p, ctx) {
    needRole_(ctx, ['super_admin', 'hr_admin']);
    return find_('users', {}, 0).map(pub_);
  },

  createUser: function (p, ctx) {
    needRole_(ctx, ['super_admin', 'hr_admin']);
    if (ROLES.indexOf(p.role) < 0) throw new Error('Invalid role');
    if (p.role === 'super_admin' && ctx.user.role !== 'super_admin') throw new Error('Only a super administrator can create one');
    if (String(p.password || '').length < 10) throw new Error('Password must be at least 10 characters');
    var email = cleanEmail_(p.email);
    return withLock_(function () {
      if (find_('users', { email: email }, 1).length) throw new Error('Email already exists');
      var u = insert_('users', { email: email, name: String(p.name || '').trim(), role: p.role, active: 'true', failed_attempts: '0', password_hash: hashPw_(String(p.password)) });
      insert_('audit_logs', { user_id: ctx.user.id, action: 'create_user', table_name: 'users', record_id: u.id, details: email + ' / ' + p.role });
      return pub_(u);
    });
  },

  setUserActive: function (p, ctx) {
    needRole_(ctx, ['super_admin', 'hr_admin']);
    if (p.id === ctx.user.id) throw new Error('You cannot change your own status');
    withLock_(function () {
      update_('users', p.id, { active: p.active ? 'true' : 'false' });
      insert_('audit_logs', { user_id: ctx.user.id, action: p.active ? 'activate_user' : 'deactivate_user', table_name: 'users', record_id: p.id });
    });
    return 'ok';
  }
};

/* ---------- নিরাপত্তা ---------- */
function auth_(token) {
  if (!token) throw new Error('Session expired');
  var s = find_('sessions', { token_hash: sha_(token) }, 1)[0];
  if (!s || new Date(s.expires_at) < new Date()) throw new Error('Session expired');
  var u = find_('users', { id: s.user_id }, 1)[0];
  if (!u || u.active !== 'true') throw new Error('Session expired');
  return { user: u, session: s };
}
function needRole_(ctx, roles) { if (roles.indexOf(ctx.user.role) < 0) throw new Error('Permission denied'); }
function pub_(u) { return { id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, last_login: u.last_login }; }
function cleanEmail_(e) {
  e = String(e || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error('Invalid email');
  return e;
}
function hex_(b) { return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join(''); }
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)); }
// দ্রষ্টব্য: Apps Script-এ Argon2id নেই; salt + HMAC-SHA256 এর বহু-রাউন্ড ব্যবহার করা হয়েছে (সীমাবদ্ধতা)
function hashPw_(pw, salt) {
  salt = salt || Utilities.getUuid();
  var key = Utilities.newBlob(salt).getBytes();
  var d = Utilities.computeHmacSha256Signature(Utilities.newBlob(pw).getBytes(), key); // দুটোই byte[]
  for (var i = 1; i < HASH_ROUNDS; i++) d = Utilities.computeHmacSha256Signature(d, key);
  return salt + '$' + Utilities.base64Encode(d);
}
function verifyPw_(pw, stored) {
  if (!stored || stored.indexOf('$') < 0) return false;
  var salt = stored.split('$')[0];
  var a = hashPw_(pw, salt), diff = a.length ^ stored.length;
  for (var i = 0; i < a.length && i < stored.length; i++) diff |= a.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

/* ---------- শিট ডাটা লেয়ার ---------- */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function sheet_(t) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t); }

function setupSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (t) {
    var sh = ss.getSheetByName(t) || ss.insertSheet(t);
    var have = sh.getLastRow() === 0 ? [] : sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    SCHEMA[t].forEach(function (h) { if (have.indexOf(h) < 0) have.push(h); });
    sh.getRange(1, 1, sh.getMaxRows(), have.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, have.length).setValues([have]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  var d = ss.getSheetByName('Sheet1');
  if (d && ss.getSheets().length > 1 && d.getLastRow() === 0) ss.deleteSheet(d);
}
function find_(t, where, limit) {
  var sh = sheet_(t);
  if (!sh) { setupSheets_(); sh = sheet_(t); }
  if (!sh) throw new Error('Run setup first');
  var v = sh.getDataRange().getValues(), h = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    var o = { _row: i + 1 };
    for (var j = 0; j < h.length; j++) o[h[j]] = String(v[i][j]);
    if (!o.id) continue;
    var ok = true;
    for (var k in where) if (o[k] !== String(where[k])) { ok = false; break; }
    if (ok) { out.push(o); if (limit && out.length >= limit) break; }
  }
  return out;
}
function insert_(t, row) {
  var sh = sheet_(t), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], now = new Date().toISOString();
  row.id = row.id || Utilities.getUuid(); row.created_at = now; row.updated_at = now;
  sh.appendRow(h.map(function (c) { return row[c] === undefined ? '' : String(row[c]); }));
  return row;
}
function update_(t, id, patch) {
  var rec = find_(t, { id: id }, 1)[0];
  if (!rec) throw new Error('Not found');
  var sh = sheet_(t), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  patch.updated_at = new Date().toISOString();
  for (var k in patch) { var c = h.indexOf(k); if (c >= 0 && k !== 'id' && k !== 'created_at') sh.getRange(rec._row, c + 1).setValue(String(patch[k])); }
}

/* ================= Phase 2–8: মডিউল ================= */
SCHEMA.shifts = ['id','name','start_time','end_time','break_minutes','grace_minutes','days','created_at','updated_at'];
SCHEMA.holidays = ['id','name','date','type','created_at','updated_at'];
SCHEMA.leave_applications = ['id','employee_id','type','from_date','to_date','reason','status','created_at','updated_at'];
SCHEMA.notifications = ['id','title','message','created_at','updated_at'];
SCHEMA.kiosk_devices = ['id','name','location','status','created_at','updated_at'];
SCHEMA.payroll_records = ['id','employee_id','month','basic','allowances','bonus','overtime','deductions','gross','net','status','created_at','updated_at'];
SCHEMA.face_templates = ['id','employee_id','template','consent','created_at','updated_at'];
SCHEMA.attendance_records = ['id','employee_id','employee_name','date','check_in','check_out','late_minutes','status','method','device_id','created_at','updated_at'];

var HR = ['super_admin', 'hr_admin', 'hr_manager'], ADM = ['super_admin', 'hr_admin'];
var TBL = {
  employees: { w: HR }, departments: { w: HR }, designations: { w: HR }, shifts: { w: HR }, holidays: { w: HR },
  notifications: { w: HR }, kiosk_devices: { w: ADM, r: ADM }, payroll_records: { w: ADM, r: ADM },
  leave_applications: { w: ROLES, own: 1 }, attendance_records: { w: [], own: 1 },
  audit_logs: { w: [], r: ADM }, company_settings: { w: ADM, r: ADM }
};
function tbl_(t) { if (!TBL[t]) throw new Error('unknown table'); return TBL[t]; }
function n_(x) { return parseFloat(x) || 0; }
function emp_(ctx) { return find_('employees', { email: ctx.user.email }, 1)[0] || null; }
function toMin_(s) { var a = String(s).split(':'); return (+a[0]) * 60 + (+a[1]); }
function now_() {
  var d = new Date();
  return { date: Utilities.formatDate(d, 'Asia/Dhaka', 'yyyy-MM-dd'), time: Utilities.formatDate(d, 'Asia/Dhaka', 'HH:mm') };
}
function clean_(r) { delete r._row; return r; }

ACTIONS.list = function (p, ctx) {
  var c = tbl_(p.table);
  if (c.r) needRole_(ctx, c.r);
  var rows = find_(p.table, p.where || {}, 0).map(clean_), me = null;
  if (p.last) rows = rows.slice(-p.last).reverse();
  if (ctx.user.role === 'employee' && (c.own || p.table === 'employees')) {
    me = emp_(ctx);
    rows = rows.filter(function (r) { return me && (p.table === 'employees' ? r.id === me.id : r.employee_id === me.id); });
  }
  return rows;
};

ACTIONS.save = function (p, ctx) {
  var c = tbl_(p.table);
  needRole_(ctx, c.w);
  var r = p.row || {}, isNew = !r.id;
  if (p.table === 'leave_applications' && HR.indexOf(ctx.user.role) < 0) {
    var me = emp_(ctx);
    if (!me) throw new Error('Your login email is not linked to an employee record');
    if (!isNew) throw new Error('Permission denied');
    r = { employee_id: me.id, type: r.type, from_date: r.from_date, to_date: r.to_date, reason: r.reason, status: 'Pending' };
  }
  return withLock_(function () {
    find_(p.table, {}, 1);
    if (p.table === 'employees' && isNew && !r.employee_code) r.employee_code = 'EMP-' + (1001 + find_('employees', {}, 0).length);
    if (p.table === 'payroll_records') {
      var g = n_(r.basic) + n_(r.allowances) + n_(r.bonus);
      r.gross = g; r.net = g + n_(r.overtime) - n_(r.deductions);
    }
    var id = r.id;
    if (id) update_(p.table, id, r); else { r = insert_(p.table, r); id = r.id; }
    insert_('audit_logs', { user_id: p.actor || ctx.user.id, action: isNew ? 'create' : 'update', table_name: p.table, record_id: id });
    return { id: id };
  });
};

ACTIONS.remove = function (p, ctx) {
  var c = tbl_(p.table);
  needRole_(ctx, c.w);
  if (p.table === 'leave_applications') needRole_(ctx, HR);
  return withLock_(function () {
    var rec = find_(p.table, { id: p.id }, 1)[0];
    if (!rec) throw new Error('Not found');
    if (p.table === 'employees') update_('employees', p.id, { employment_status: 'Archived' });
    else sheet_(p.table).deleteRow(rec._row);
    insert_('audit_logs', { user_id: p.actor || ctx.user.id, action: p.table === 'employees' ? 'archive' : 'delete', table_name: p.table, record_id: p.id });
    return 'ok';
  });
};

function mark_(emp, method, ctx) {
  return withLock_(function () {
    var n = now_(), rec = find_('attendance_records', { employee_id: emp.id, date: n.date }, 1)[0];
    var out = { name: emp.full_name, code: emp.employee_code, time: n.time };
    if (!rec) {
      var late = 0, status = 'Present';
      var sh = emp.shift_id ? find_('shifts', { id: emp.shift_id }, 1)[0] : null;
      if (sh && sh.start_time) {
        late = Math.max(0, toMin_(n.time) - toMin_(sh.start_time) - (parseInt(sh.grace_minutes, 10) || 0));
        if (late > 0) status = 'Late';
      }
      insert_('attendance_records', { employee_id: emp.id, employee_name: emp.full_name, date: n.date, check_in: n.time, late_minutes: late, status: status, method: method, device_id: ctx.user.id });
      out.type = 'check_in'; out.status = status; out.late = late; return out;
    }
    if (rec.check_out) throw new Error('Already checked out today');
    if (toMin_(n.time) - toMin_(rec.check_in) < 2) throw new Error('Duplicate scan ignored. Wait 2 minutes.');
    update_('attendance_records', rec.id, { check_out: n.time });
    out.type = 'check_out'; return out;
  });
}

// ফেস না থাকলে বিকল্প পদ্ধতি: লগইন ইমেইল যে কর্মীর ইমেইলের সাথে মেলে তার হাজিরা
ACTIONS.selfAttendance = function (p, ctx) {
  var me = emp_(ctx);
  if (!me || me.employment_status === 'Archived') throw new Error('Your login email is not linked to an active employee record');
  return mark_(me, 'self', ctx);
};

ACTIONS.enrollFace = function (p, ctx) {
  needRole_(ctx, HR);
  if (p.consent !== true) throw new Error('Employee consent is required');
  var ds = p.descriptors;
  if (!ds || ds.length < 3 || ds.some(function (d) { return !d || d.length !== 128; })) throw new Error('Invalid face samples');
  return withLock_(function () {
    var emp = find_('employees', { id: p.employee_id }, 1)[0];
    if (!emp) throw new Error('Employee not found');
    var old = find_('face_templates', { employee_id: emp.id }, 1)[0];
    var row = { employee_id: emp.id, template: JSON.stringify(ds), consent: 'true' };
    if (old) update_('face_templates', old.id, row); else insert_('face_templates', row);
    update_('employees', emp.id, { face_enrolled: 'true' });
    insert_('audit_logs', { user_id: ctx.user.id, action: 'face_enroll', table_name: 'face_templates', record_id: emp.id });
    return 'ok';
  });
};

ACTIONS.faceAttendance = function (p, ctx) {
  needRole_(ctx, HR);
  var d = p.descriptor;
  if (!d || d.length !== 128) throw new Error('Invalid face data');
  var best = null, bd = 9;
  find_('face_templates', {}, 0).forEach(function (t) {
    JSON.parse(t.template).forEach(function (s) {
      var x = 0;
      for (var i = 0; i < 128; i++) x += (s[i] - d[i]) * (s[i] - d[i]);
      x = Math.sqrt(x);
      if (x < bd) { bd = x; best = t.employee_id; }
    });
  });
  if (!best || bd > 0.5) throw new Error('Face not recognised');
  var emp = find_('employees', { id: best }, 1)[0];
  if (!emp || emp.employment_status === 'Archived') throw new Error('Face not recognised');
  return mark_(emp, 'face', ctx);
};

ACTIONS.dashboard = function () {
  var n = now_();
  var emps = find_('employees', {}, 0).filter(function (e) { return e.employment_status !== 'Archived'; });
  var rec = find_('attendance_records', { date: n.date }, 0);
  return { employees: emps.length, present: rec.length, absent: Math.max(0, emps.length - rec.length),
           late: rec.filter(function (r) { return r.status === 'Late'; }).length };
};

ACTIONS.ping = function () { return { time: new Date().toISOString() }; };

// Next.js সার্ভার ফেস/সেলফ যাচাইয়ের পর এটি কল করে; ডুপ্লিকেট ও দেরি এখানে LockService দিয়ে হিসাব হয়
ACTIONS.mark = function (p) {
  var emp = find_('employees', { id: p.employee_id }, 1)[0];
  if (!emp || emp.employment_status === 'Archived') throw new Error('Employee not found or archived');
  return mark_(emp, p.method || 'face', { user: { id: p.actor || 'server' } });
};

/* ---------- Google Drive: ছবি ও ফাইল ---------- */
function folder_() {
  var it = DriveApp.getFoldersByName('SmartFace Files');
  return it.hasNext() ? it.next() : DriveApp.createFolder('SmartFace Files');
}
// একবার এডিটর থেকে এই ফাংশন Run করে Drive-এর অনুমতি দিন
function authorizeDrive() { return folder_().getId(); }

ACTIONS.upload = function (p) {
  var m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(p.dataUrl || ''));
  if (!m) throw new Error('Invalid image');
  if (m[2].length > 400000) throw new Error('Image too large');
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'photo_' + String(p.name || 'file') + '.jpg');
  return { id: folder_().createFile(blob).getId() };
};
ACTIONS.file = function (p) {
  var f = DriveApp.getFileById(String(p.id)), fo = folder_().getId(), ok = false, ps = f.getParents();
  while (ps.hasNext()) { if (ps.next().getId() === fo) ok = true; }
  if (!ok) throw new Error('Not allowed');
  var b = f.getBlob();
  return { mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
};
