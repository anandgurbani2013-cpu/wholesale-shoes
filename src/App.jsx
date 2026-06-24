import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Phone, Mail, MapPin, MessageCircle, Menu, X, ChevronRight, ChevronUp, ChevronDown, Star, Award, Truck, Package, Users, Plus, Minus, Send, Facebook, Instagram, Linkedin, Download, CheckCircle, ArrowRight, Trash2, Edit, Save, Eye, Lock, Inbox, FileText, Home, Grid, Info, HelpCircle, BarChart3, Clock, TrendingUp, LogOut, Settings, Tag, MessageSquare, ListChecks, Sparkles, Printer, Loader2, Sun, Moon } from 'lucide-react';

// ===== CONFIGURATION =====
const SUPABASE_URL = 'https://yfcnkmbfugypratmlahz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY25rbWJmdWd5cHJhdG1sYWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjUxMTEsImV4cCI6MjA5NzcwMTExMX0.phMz2gjcbLY17LfaRfMI0weuYOMKM4hXJVpvATk3Jl4';
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbz79bSOmt6s31Byx8BL7h0qyVOz8Gv8Z8fNlyfFUsdFuvijNM7F7na86wzIdgHi5pvm/exec';
const WEB3FORMS_KEY = '28dbd52f-c661-42f5-b781-34ba0c7d0249';
const ADMIN_EMAIL = 'anandgurbani2013@gmail.com';

// ===== ADMIN LOGIN MODE =====
// true  = use Supabase Auth — password is stored securely on Supabase, not in this code.
//         You change/reset the password from the Supabase dashboard (no redeploy needed).
// false = use the hardcoded password below (works without Supabase Auth; e.g. if Supabase ever charges).
//         To switch, just change this one line to: false
const USE_SUPABASE_AUTH = true;
const ADMIN_PASSWORD_FALLBACK = 'admin123'; // only used when USE_SUPABASE_AUTH = false — change this to your own strong password

// ===== SUPABASE REST API HELPER =====
const sb = {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
  async select(table) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: this.headers });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`${table}: HTTP ${r.status} - ${errText.slice(0, 200)}`);
    }
    const data = await r.json();
    // Sort by position client-side if column exists
    return data.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },
  async upsert(table, rows) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows) });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Upsert ${table}: HTTP ${r.status} - ${errText.slice(0, 200)}`);
    }
    return r.json();
  },
  async delete(table, ids) {
    if (!ids.length) return;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=in.(${ids.map(i => `"${i}"`).join(',')})`, { method: 'DELETE', headers: this.headers });
    if (!r.ok) throw new Error('Failed to delete ' + table);
  },
  async deleteAll(table) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=neq.NONEXISTENT`, { method: 'DELETE', headers: this.headers });
    return r.ok;
  },
  async testConnection() {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/business_info?select=id&limit=1`, { headers: this.headers });
      if (r.status === 404) return { ok: false, msg: 'Tables not found. Did you run the SQL setup?' };
      if (r.status === 401 || r.status === 403) return { ok: false, msg: 'Authentication failed. Check your API key.' };
      if (!r.ok) {
        const text = await r.text();
        return { ok: false, msg: `HTTP ${r.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: `Network error: ${e.message}` };
    }
  }
};

// ===== CUSTOMER AUTH (Supabase Auth, separate from admin) =====
const customerAuth = {
  base: `${SUPABASE_URL}/auth/v1`,
  async signup(email, password, meta) {
    const r = await fetch(`${this.base}/signup`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, data: meta }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.msg || d.error_description || d.message || 'Sign up failed');
    return d; // { access_token, refresh_token, user } when email confirmation is OFF
  },
  async login(email, password) {
    const r = await fetch(`${this.base}/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || 'Incorrect email or password');
    return d;
  },
  async refresh(refresh_token) {
    const r = await fetch(`${this.base}/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token }) });
    const d = await r.json();
    if (!r.ok) throw new Error('Session expired');
    return d;
  },
  async updateProfile(access_token, meta) {
    const r = await fetch(`${this.base}/user`, { method: 'PUT', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ data: meta }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.msg || 'Could not update profile');
    return d;
  },
  async saveCart(access_token, cart) {
    try {
      const r = await fetch(`${this.base}/user`, { method: 'PUT', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ data: { cart } }) });
      return r.ok;
    } catch (e) { return false; }
  },
  async saveInquiry(access_token, inquiry) {
    try {
      const r = await fetch(`${this.base}/user`, { method: 'PUT', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ data: { inquiry } }) });
      return r.ok;
    } catch (e) { return false; }
  },
  async saveInquiryHistory(access_token, inquiryHistory) {
    try {
      const r = await fetch(`${this.base}/user`, { method: 'PUT', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ data: { inquiryHistory } }) });
      return r.ok;
    } catch (e) { return false; }
  },
  async saveOrderHistory(access_token, orderHistory) {
    try {
      const r = await fetch(`${this.base}/user`, { method: 'PUT', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ data: { orderHistory } }) });
      return r.ok;
    } catch (e) { return false; }
  },
};

function mergeCarts(a, b) {
  const map = {};
  [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach(it => {
    if (!it || !it.key) return;
    if (map[it.key]) map[it.key] = { ...map[it.key], qty: Math.max(map[it.key].qty || 1, it.qty || 1) };
    else map[it.key] = { ...it };
  });
  return Object.values(map);
}

function mergeInquiry(a, b) {
  const map = {};
  [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach(it => {
    if (!it || !it.id) return;
    if (map[it.id]) map[it.id] = { ...map[it.id], quantity: Math.max(map[it.id].quantity || 1, it.quantity || 1) };
    else map[it.id] = { ...it };
  });
  return Object.values(map);
}

// Keep only the fields the inquiry drawer + proforma need, so account storage stays small
function slimInquiry(list) {
  return (Array.isArray(list) ? list : []).map(it => ({ id: it.id, code: it.code, name: it.name, image: it.image, quantity: it.quantity, retailPrice: it.retailPrice, qtyBreaks: it.qtyBreaks, priceFrom: it.priceFrom, selSize: it.selSize || '', selColor: it.selColor || '' }));
}

function customerProfile(user) {
  const m = (user && user.user_metadata) || {};
  return { id: user?.id || '', email: user?.email || '', name: m.name || '', phone: m.phone || '', city: m.city || '', address: m.address || '' };
}

function AccountModal({ customer, inquiryHistory, orderHistory, initialTab, onAuthed, onLogout, onProfileUpdated, onClose }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [prof, setProf] = useState(() => (customer ? { ...customer.profile } : { name: '', phone: '', city: '', address: '', email: '' }));
  const [savedMsg, setSavedMsg] = useState('');
  const [acctTab, setAcctTab] = useState(initialTab || 'profile');
  const [openInq, setOpenInq] = useState(null);
  const [openOrd, setOpenOrd] = useState(null);
  useEffect(() => { if (customer) setProf({ ...customer.profile }); }, [customer]);
  useEffect(() => { if (initialTab) setAcctTab(initialTab); }, [initialTab]);

  const doLogin = async () => {
    setErr(''); setBusy(true);
    try { const d = await customerAuth.login(f.email.trim(), f.password); onAuthed(d, 'login'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doRegister = async () => {
    setErr(''); setNotice('');
    if (!f.name.trim() || !f.email.trim() || !f.password) { setErr('Please fill name, email and password'); return; }
    if (f.password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (f.password !== f.confirm) { setErr('Passwords do not match'); return; }
    setBusy(true);
    try {
      const d = await customerAuth.signup(f.email.trim(), f.password, { name: f.name.trim(), phone: f.phone.trim() });
      if (d.access_token) onAuthed(d, 'register');
      else { setNotice('Account created. Please log in.'); setMode('login'); }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveProfile = async () => {
    setErr(''); setSavedMsg(''); setBusy(true);
    try { const u = await customerAuth.updateProfile(customer.access_token, { name: prof.name, phone: prof.phone, city: prof.city, address: prof.address }); onProfileUpdated(u); setSavedMsg('Saved ✓'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const inquiriesView = (
    <div>
      <div className="flex items-center gap-2 mb-4"><ListChecks size={18} className="text-amber-500" /><h3 className="font-bold text-slate-900">My inquiries</h3></div>
      {(!inquiryHistory || inquiryHistory.length === 0) ? (
        <div className="text-center py-10 px-4 bg-slate-50 rounded-xl"><Inbox size={28} className="mx-auto text-slate-300 mb-2" /><div className="text-sm text-slate-500">No inquiries yet</div><div className="text-xs text-slate-400 mt-1">Inquiries you send will appear here.</div></div>
      ) : (
        <div className="space-y-3">
          {inquiryHistory.map(h => {
            const isOpen = openInq === h.id;
            return (
            <div key={h.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => setOpenInq(isOpen ? null : h.id)} className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.inqNo ? <span className="text-sm font-mono font-bold text-amber-600">{h.inqNo}</span> : <span className="text-sm font-semibold text-slate-700">Inquiry</span>}
                    <span className="text-[11px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Submitted</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1"><Clock size={12} /> {new Date(h.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <ChevronRight size={18} className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 -mt-1">
                  {h.products && h.products.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">{h.products.map((p, idx) => <span key={idx} className="text-xs bg-amber-50 text-amber-800 border border-amber-100 px-2 py-1 rounded-md">{p.name || p.code}{p.quantity ? ` × ${p.quantity}` : ''}{(p.selSize||p.selColor) ? ` (${[p.selSize,p.selColor].filter(Boolean).join('/')})` : ''}</span>)}</div>
                  ) : <div className="text-xs text-slate-400 italic mb-2">General inquiry (no products selected)</div>}
                  {h.message && <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border-l-2 border-amber-300">{h.message}</div>}
                  {(h.shop || h.city) && <div className="text-xs text-slate-400 mt-2">{[h.shop, h.city].filter(Boolean).join(' · ')}</div>}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const ordersView = (
    <div>
      <div className="flex items-center gap-2 mb-4"><ShoppingBag size={18} className="text-amber-500" /><h3 className="font-bold text-slate-900">My orders</h3></div>
      {(!orderHistory || orderHistory.length === 0) ? (
        <div className="text-center py-10 px-4 bg-slate-50 rounded-xl"><ShoppingBag size={28} className="mx-auto text-slate-300 mb-2" /><div className="text-sm text-slate-500">No orders yet</div><div className="text-xs text-slate-400 mt-1">Your orders and their status will appear here once you place one.</div></div>
      ) : (
        <div className="space-y-3">
          {orderHistory.map(o => {
            const isOpen = openOrd === o.id;
            return (
            <div key={o.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => setOpenOrd(isOpen ? null : o.id)} className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-bold text-amber-600">{o.orderNo}</span>
                    <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{o.status || 'New'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1"><Clock size={12} /> {new Date(o.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-slate-900 text-sm">₹{Number(o.total).toLocaleString('en-IN')}</span>
                  <ChevronRight size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 -mt-1">
                  {o.items && o.items.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">{o.items.map((it, idx) => <span key={idx} className="text-xs bg-amber-50 text-amber-800 border border-amber-100 px-2 py-1 rounded-md">{it.name}{(it.size || it.color) ? ` (${[it.size, it.color].filter(Boolean).join('/')})` : ''} ×{it.qty}</span>)}</div>}
                  <div className="flex justify-between items-center text-sm border-t pt-2 mt-1"><span className="text-slate-500">{o.payment}</span><span className="font-bold text-slate-900">₹{Number(o.total).toLocaleString('en-IN')}</span></div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const profileView = (
    <div>
      <div className="flex items-center gap-2 mb-4"><Users size={18} className="text-amber-500" /><h3 className="font-bold text-slate-900">Account info</h3></div>
      <div className="text-sm text-slate-500 mb-3">Signed in as <span className="font-medium text-slate-700">{customer && customer.profile.email}</span></div>
      <div className="space-y-3">
        <div><label className="text-sm font-medium text-slate-700 block mb-1">Name</label><input value={prof.name} onChange={e => setProf({...prof, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-sm font-medium text-slate-700 block mb-1">Phone</label><input value={prof.phone} onChange={e => setProf({...prof, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-sm font-medium text-slate-700 block mb-1">City</label><input value={prof.city} onChange={e => setProf({...prof, city: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-sm font-medium text-slate-700 block mb-1">Address</label><input value={prof.address} onChange={e => setProf({...prof, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
        {savedMsg && <div className="text-sm text-green-600">{savedMsg}</div>}
        <button onClick={saveProfile} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold">{busy ? 'Saving…' : 'Save profile'}</button>
      </div>
    </div>
  );

  const sectionTitle = acctTab === 'inquiries' ? 'My inquiries' : acctTab === 'orders' ? 'My orders' : 'Account info';
  const NavBtn = ({ id, icon, label }) => (
    <button onClick={() => setAcctTab(id)} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${acctTab === id ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'}`}>{icon} {label}</button>
  );

  if (customer) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-stretch md:items-start justify-center md:p-4 overflow-auto">
        <div className="bg-white w-full max-w-3xl md:my-8 md:rounded-2xl shadow-2xl flex flex-col min-h-full md:min-h-0">
          <div className="p-4 md:p-5 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900"><span className="md:hidden">{sectionTitle}</span><span className="hidden md:inline">My account</span></h2>
            <button onClick={onClose} aria-label="Close"><X size={22} /></button>
          </div>
          <div className="flex flex-1">
            <aside className="hidden md:flex md:flex-col w-52 border-r border-slate-100 p-3 gap-1">
              <NavBtn id="profile" icon={<Users size={18} />} label="Account info" />
              <NavBtn id="inquiries" icon={<ListChecks size={18} />} label="My inquiries" />
              <NavBtn id="orders" icon={<ShoppingBag size={18} />} label="My orders" />
              <div className="border-t border-slate-100 my-2"></div>
              <button onClick={onLogout} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={18} /> Log out</button>
            </aside>
            <div className="flex-1 p-5 min-w-0">
              {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-3">{err}</div>}
              {acctTab === 'inquiries' ? inquiriesView : acctTab === 'orders' ? ordersView : profileView}
              <button onClick={onLogout} className="md:hidden w-full mt-6 border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"><LogOut size={16} /> Log out</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">{mode === 'login' ? 'Log in' : 'Create account'}</h2>
          <button onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        <div className="p-6 space-y-3">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{err}</div>}
          {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">{notice}</div>}
          {mode === 'login' ? (
            <>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Email</label><input type="email" value={f.email} onChange={e => setF({...f, email: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doLogin(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Password</label><input type="password" value={f.password} onChange={e => setF({...f, password: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doLogin(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <button onClick={doLogin} disabled={busy} className="w-full bg-slate-900 hover:bg-amber-500 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold transition-colors">{busy ? 'Logging in…' : 'Log In'}</button>
              <div className="text-sm text-center text-slate-500">No account? <button onClick={() => { setErr(''); setMode('register'); }} className="text-amber-600 font-medium">Create one</button></div>
            </>
          ) : (
            <>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Name *</label><input value={f.name} onChange={e => setF({...f, name: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Email *</label><input type="email" value={f.email} onChange={e => setF({...f, email: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Phone</label><input value={f.phone} onChange={e => setF({...f, phone: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Password *</label><input type="password" value={f.password} onChange={e => setF({...f, password: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Confirm Password *</label><input type="password" value={f.confirm} onChange={e => setF({...f, confirm: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <button onClick={doRegister} disabled={busy} className="w-full bg-slate-900 hover:bg-amber-500 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold transition-colors">{busy ? 'Creating…' : 'Create Account'}</button>
              <div className="text-sm text-center text-slate-500">Have an account? <button onClick={() => { setErr(''); setMode('login'); }} className="text-amber-600 font-medium">Log in</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== EXTERNAL SERVICES =====
async function pushToGoogleSheets(inquiry) {
  try {
    const productsStr = inquiry.products?.map(p => `${p.code}-${p.name}${(p.selSize||p.selColor)?` [${[p.selSize,p.selColor].filter(Boolean).join('/')}]`:''} (${p.quantity} pairs)`).join('; ') || '';
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: inquiry.type || 'inquiry', inqNo: inquiry.inqNo || '', name: inquiry.name, shop: inquiry.shop, city: inquiry.city, phone: inquiry.phone, whatsapp: inquiry.whatsapp, email: inquiry.email, message: inquiry.message, products: productsStr, apptDate: inquiry.apptDate || '', apptTime: inquiry.apptTime || '', source: inquiry.source || 'Inquiry Form' }) });
    return true;
  } catch (e) { 
    console.warn('Google Sheets not available in this environment (will work after deployment):', e.message); 
    return null; // null = not attempted/available, vs false = attempted but failed
  }
}

// Allocate the next sequential inquiry reference like INQ-00001 (counts existing inquiry records)
async function nextInquiryNumber() {
  try {
    const rows = await sb.select('inquiries');
    const n = (Array.isArray(rows) ? rows : []).filter(x => x && x.data && x.data.type === 'inquiry').length;
    return `INQ-${String(n + 1).padStart(5, '0')}`;
  } catch (e) {
    return `INQ-${String(Date.now()).slice(-5)}`;
  }
}

// Order reference, e.g. ORD-240626-165830 (date + time, unique per second)
function makeOrderNo() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return `ORD-${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
async function pushOrderToSheets(order) {
  try {
    const productsStr = (order.items || []).map(it => `${it.code}-${it.name} [${it.size}/${it.color}] x${it.qty} @ ₹${it.unit}`).join('; ');
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      type: 'order', orderId: order.orderNo, name: order.name, phone: order.phone, whatsapp: order.whatsapp, email: order.email,
      address: order.address, city: order.city, pincode: order.pincode, products: productsStr, total: order.total, payment: order.paymentLabel, message: order.note || ''
    }) });
    return true;
  } catch (e) { return null; }
}
async function sendOrderEmail(order) {
  try {
    const itemsStr = (order.items || []).map(it => `• ${it.code} ${it.name} (${it.size}/${it.color}) x${it.qty} = ₹${it.lineTotal}`).join('\n');
    const message = [
      `New order ${order.orderNo}`,
      ``,
      `Customer: ${order.name}`,
      `Phone: ${order.phone}`,
      `WhatsApp: ${order.whatsapp || order.phone}`,
      `Email: ${order.email || 'N/A'}`,
      `Address: ${[order.address, order.city, order.pincode].filter(Boolean).join(', ')}`,
      ``,
      `Items:`,
      itemsStr,
      ``,
      `Subtotal: ₹${order.subtotal}`,
      `GST (${order.gstRate}%): ₹${order.gst}`,
      `Delivery: ${order.delivery ? '₹' + order.delivery : 'Free'}`,
      `Total: ₹${order.total}`,
      `Payment: ${order.paymentLabel}`,
      `Note: ${order.note || 'None'}`,
      `Placed: ${new Date(order.date).toLocaleString('en-IN')}`,
    ].join('\n');
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `New Order ${order.orderNo} from ${order.name}`,
        from_name: 'Anand Footwear Website',
        order_no: order.orderNo,
        name: order.name,
        phone: order.phone,
        email: order.email || 'N/A',
        total: `₹${order.total}`,
        payment: order.paymentLabel,
        message,
      }),
    });
    const data = await r.json();
    if (data.success) return true;
    console.error('Web3Forms order error:', data);
    return false;
  } catch (e) { console.error('Order email failed:', e.message); return false; }
}
async function saveOrderToSupabase(order, accessToken) {
  try {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken || SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, { method: 'POST', headers, body: JSON.stringify([{ id: order.id, data: order, status: 'new', user_id: order.userId || null }]) });
    return r.ok;
  } catch (e) { return null; }
}

// Sync a customer's profile (never the password) to the Customers sheet; Apps Script upserts by email
async function syncCustomerToSheet(profile, event) {
  try {
    if (!profile || !profile.email) return null;
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      type: 'customer',
      event: event || 'login',
      email: profile.email,
      name: profile.name || '',
      phone: profile.phone || '',
      city: profile.city || '',
      address: profile.address || '',
      userId: profile.id || '',
      date: new Date().toISOString()
    }) });
    return true;
  } catch (e) { return null; }
}

async function sendInquiryEmail(inquiry) {
  try {
    const productsStr = inquiry.products?.map(p => `${p.code}-${p.name}${(p.selSize||p.selColor)?` [${[p.selSize,p.selColor].filter(Boolean).join('/')}]`:''} (${p.quantity} pairs)`).join('; ') || 'None';
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `${inquiry.inqNo ? `[${inquiry.inqNo}] ` : ''}${inquiry.source === 'Proforma Download' ? '📄 Proforma Estimate Lead' : 'New Inquiry'} from ${inquiry.name}${inquiry.shop ? ' - ' + inquiry.shop : ''}`,
        from_name: 'Shoes Website',
        inquiry_no: inquiry.inqNo || 'N/A',
        source: inquiry.source || 'Inquiry Form',
        name: inquiry.name,
        shop: inquiry.shop || 'N/A',
        city: inquiry.city || 'N/A',
        phone: inquiry.phone,
        whatsapp: inquiry.whatsapp || inquiry.phone,
        email: inquiry.email || 'N/A',
        message: inquiry.message || 'No message',
        products: productsStr,
        date: new Date(inquiry.date).toLocaleString('en-IN'),
      }),
    });
    const data = await r.json();
    if (data.success) return true;
    console.error('Web3Forms error:', data);
    return false;
  } catch (e) {
    console.error('Email send failed:', e.message);
    return false;
  }
}


// ===== DEFAULT DATA =====
const DEFAULT_CATEGORIES = [
  { id: 'formal', name: 'Formal Shoes', icon: '👞' }, { id: 'casual', name: 'Casual Shoes', icon: '👟' },
  { id: 'sports', name: 'Sports Shoes', icon: '🏃' }, { id: 'sandals', name: 'Sandals', icon: '🩴' },
  { id: 'boots', name: 'Boots', icon: '🥾' }, { id: 'loafers', name: 'Loafers', icon: '🥿' },
];

const DEFAULT_FAQS = [
  { id: 'faq_2', q: 'Do you offer customization or private labeling?', a: 'Yes, we offer customization for bulk orders.' },
  { id: 'faq_3', q: 'What are your payment terms?', a: 'Advance payment / Net 30 for approved retailers' },
  { id: 'faq_4', q: 'How long does delivery take?', a: '7-15 business days from order confirmation.' },
  { id: 'faq_5', q: 'Do you ship across India?', a: 'Yes, pan India delivery available.' },
  { id: 'faq_6', q: 'Do you offer GST invoicing?', a: 'Yes, we provide proper GST invoices for all orders.' },
];

const DEFAULT_TESTIMONIALS = [
  { id: 't_1', name: '[Customer Name 1]', shop: '[Shop Name]', city: '[City]', content: '[Replace with actual customer review]', rating: 5 },
  { id: 't_2', name: '[Customer Name 2]', shop: '[Shop Name]', city: '[City]', content: '[Replace with actual customer review]', rating: 5 },
  { id: 't_3', name: '[Customer Name 3]', shop: '[Shop Name]', city: '[City]', content: '[Replace with actual customer review]', rating: 5 },
];

const DEFAULT_FEATURES = [
  { id: 'feat_1', icon: '🏆', title: 'Premium Quality', desc: 'Hand-picked materials and expert craftsmanship in every pair' },
  { id: 'feat_3', icon: '🚚', title: 'Fast Delivery', desc: 'Pan India delivery with 7-15 business days lead time' },
  { id: 'feat_4', icon: '⭐', title: 'Best Pricing', desc: 'Direct from manufacturer with bulk discounts' },
];

const DEFAULT_STEPS = [
  { id: 'step_1', title: 'Browse Catalog', desc: "Explore our range and shortlist products" },
  { id: 'step_2', title: 'Add to Inquiry', desc: "Add products with quantities to your inquiry" },
  { id: 'step_3', title: 'Submit Inquiry', desc: "We'll respond within 24 hours" },
  { id: 'step_4', title: 'Get Quotation', desc: 'Receive detailed pricing and confirm order' },
  { id: 'step_5', title: 'Make Payment', desc: 'Advance payment or approved terms' },
  { id: 'step_6', title: 'Receive Delivery', desc: 'Pan India delivery in 7-15 days' },
];

const DEFAULT_BUSINESS = {
  name: '[Your Business Name]', tagline: 'Premium Wholesale Men\'s Footwear', logoText: '[L]', logoImage: '',
  phone: '+91 XXXXX XXXXX', whatsapp: '91XXXXXXXXXX', email: 'contact@yourbusiness.com',
  address: '[Your Business Address, City, State, PIN]', hours: 'Mon - Sat: 9:00 AM - 7:00 PM',
  years: 'XX', retailers: 'XXX+', cities: 'XX+', skus: 'XXX+', foundedYear: 2013,
  about: '[Your business story]', mission: '[Your mission statement]',
  paymentTerms: 'Advance / Net 30', leadTime: '7-15 business days', shippingCoverage: 'Pan India',
  paymentNote: 'Payment via UPI / bank transfer on order confirmation. GST invoice provided.',
  mapQuery: '', mapEmbedUrl: '',
  appointmentsEnabled: true, appointmentNote: "Visits by appointment, Mon–Sat. We'll confirm your slot by phone/WhatsApp.",
  apptDays: [1, 2, 3, 4, 5, 6], apptSlots: ['11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'], apptDaysAhead: 30,
  heroTitle: "Premium Men's Footwear at Wholesale Prices",
  heroSubtitle: 'Your trusted partner for bulk men\'s shoe supply.',
  heroBadge: '{years} Years of Excellence',
  facebook: '#', instagram: '#', linkedin: '#',
  gstin: '[YOUR GSTIN]', legalName: '[Legal Business Name]', hsnCode: '6403', gstRate: 18,
  bankName: '[Bank Name]', accountNo: '[Account Number]', ifsc: '[IFSC Code]', invoicePrefix: 'INV-',
  deliveryFee: 0, freeDeliveryAbove: 0, upiId: '', upiName: '',
};

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'catalog', label: 'Catalog', icon: Grid },
  { id: 'about', label: 'About', icon: Info },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'contact', label: 'Contact', icon: MessageCircle },
];

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect fill="%23e2e8f0" width="400" height="400"/><text x="50%25" y="50%25" font-size="60" text-anchor="middle" dy=".3em" fill="%2394a3b8">👞</text></svg>';

const IMG_URLS = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=600&h=600&fit=crop',
];

function getDefaultProducts() {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `prod_${i + 1}`, code: `SH-${String(i + 1).padStart(4, '0')}`, name: `[Product Name ${i + 1}]`,
    category: DEFAULT_CATEGORIES[i % DEFAULT_CATEGORIES.length].id, image: IMG_URLS[i % IMG_URLS.length],
    sizes: ['6', '7', '8', '9', '10', '11'], colors: ['Black', 'Brown', 'Tan'],
    material: '[Material details]', priceFrom: 'XXX',
    isNew: i < 3, isBestseller: i >= 3 && i < 6, description: '[Product description]',
  }));
}

// ===== UTILS =====
function SafeImage({ src, alt, className }) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [src]);
  return <img src={error || !src ? PLACEHOLDER_IMG : src} alt={alt} className={className} onError={() => setError(true)} />;
}

function WhatsAppIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-slate-50">
        <span className="font-medium text-slate-900">{q}</span>
        <Plus className={`text-amber-500 transition-transform flex-shrink-0 ${open ? 'rotate-45' : ''}`} size={20} />
      </button>
      {open && <div className="px-6 pb-4 text-slate-700 text-sm border-t pt-4">{a}</div>}
    </div>
  );
}

function productImages(p) {
  if (p && Array.isArray(p.images) && p.images.filter(Boolean).length) return p.images.filter(Boolean);
  return p && p.image ? [p.image] : [];
}

function ProductGallery({ images, alt }) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);
  const imgs = images && images.length ? images : [''];
  const go = (n) => setIdx((n + imgs.length) % imgs.length);
  const onTouchStart = (e) => { touchX.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };
  return (
    <div>
      <div className="relative bg-slate-100 rounded-2xl overflow-hidden aspect-square" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <SafeImage src={imgs[idx]} alt={alt} className="w-full h-full object-cover" />
        {imgs.length > 1 && (
          <>
            <button onClick={() => go(idx - 1)} aria-label="Previous image" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-md"><ChevronRight className="rotate-180" size={20} /></button>
            <button onClick={() => go(idx + 1)} aria-label="Next image" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-md"><ChevronRight size={20} /></button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
              {imgs.map((_, i) => <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-amber-500' : 'bg-white/70'}`} />)}
            </div>
          </>
        )}
      </div>
      {imgs.length > 1 && (
        <div className="hidden md:flex gap-2 mt-3 flex-wrap">
          {imgs.map((src, i) => (
            <button key={i} onClick={() => setIdx(i)} style={i === idx ? { borderColor: '#C6A15B' } : {}} className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${i === idx ? '' : 'border-transparent'}`}>
              <SafeImage src={src} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, categories, onView, onAddToInquiry }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all hover:-translate-y-1 group">
      <div className="relative aspect-square overflow-hidden bg-slate-100 cursor-pointer" onClick={() => onView(product)}>
        <SafeImage src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        {product.isNew && <span className="absolute top-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">NEW</span>}
        {product.isBestseller && <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">★ BEST</span>}
        {product.outOfStock && <span className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">Out of Stock</span>}
      </div>
      <div className="p-4">
        <div className="text-xs text-slate-500 font-mono mb-1">{product.code}</div>
        <h3 className="font-semibold text-slate-900 mb-1 truncate">{product.name}</h3>
        <div className="text-xs text-slate-600 mb-3">{categories.find(c => c.id === product.category)?.name || 'Uncategorized'}</div>
        <div className="flex justify-between items-center mb-3">
          <div><div className="text-lg font-bold text-slate-900">₹{(parseFloat(product.retailPrice) || product.priceFrom || 0).toLocaleString('en-IN')}</div><div className="text-xs text-slate-500">per pair</div></div>
          {productTotalStock(product) === 0 && !product.outOfStock && (parseFloat(product.retailPrice) > 0) && <div className="text-right"><div className="text-xs text-red-500 font-semibold">Sold out</div></div>}
        </div>
        {product.outOfStock
          ? <button disabled className="w-full bg-slate-200 text-slate-500 py-2 rounded-lg text-sm font-semibold cursor-not-allowed">Out of Stock</button>
          : <button onClick={(e) => { e.stopPropagation(); onView(product); }} className="w-full bg-slate-900 hover:bg-amber-500 text-white py-2 rounded-lg text-sm font-semibold transition-colors">View &amp; Buy</button>}
      </div>
    </div>
  );
}

// ===== AI CHATBOT =====

// ===== GST INVOICE GENERATOR =====
function GSTInvoiceGenerator({ inquiry, business, onClose }) {
  const invoiceNumber = `${business.invoicePrefix || 'INV-'}${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const date = new Date().toLocaleDateString('en-IN');
  const items = inquiry.products || [];
  const gstRate = parseFloat(business.gstRate) || 18;
  
  const calcRow = (item) => {
    const price = parseFloat(item.priceFrom) || 0;
    const subtotal = price * (item.quantity || 1);
    const cgst = (subtotal * gstRate) / 200;
    const sgst = (subtotal * gstRate) / 200;
    const total = subtotal + cgst + sgst;
    return { subtotal, cgst, sgst, total };
  };

  const totals = items.reduce((acc, item) => {
    const r = calcRow(item);
    return { subtotal: acc.subtotal + r.subtotal, cgst: acc.cgst + r.cgst, sgst: acc.sgst + r.sgst, total: acc.total + r.total };
  }, { subtotal: 0, cgst: 0, sgst: 0, total: 0 });

  const numToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (num === 0) return 'Zero';
    const convert = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let result = convert(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
    return result + ' Only';
  };

  const printInvoice = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-auto p-4 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-2xl print:shadow-none print:rounded-none">
        <div className="p-6 border-b flex justify-between items-center print:hidden">
          <h2 className="text-xl font-bold">GST Invoice Preview</h2>
          <div className="flex gap-2">
            <button onClick={printInvoice} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Printer size={18} /> Print / Save PDF</button>
            <button onClick={onClose} className="border px-4 py-2 rounded-lg">Close</button>
          </div>
        </div>
        <div className="p-8 print:p-6">
          <div className="text-center mb-6 pb-4 border-b-2 border-slate-900">
            <h1 className="text-2xl font-bold text-slate-900">TAX INVOICE</h1>
            <div className="text-sm text-slate-600 mt-1">Original for Recipient</div>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="font-bold text-slate-900 mb-2">{business.legalName || business.name}</div>
              <div className="text-sm text-slate-700 whitespace-pre-line">{business.address}</div>
              <div className="text-sm text-slate-700 mt-2">📞 {business.phone}</div>
              <div className="text-sm text-slate-700">✉️ {business.email}</div>
              <div className="text-sm mt-2"><span className="font-semibold">GSTIN:</span> {business.gstin}</div>
            </div>
            <div className="text-right">
              <div className="text-sm"><span className="font-semibold">Invoice No:</span> {invoiceNumber}</div>
              <div className="text-sm mt-1"><span className="font-semibold">Date:</span> {date}</div>
              <div className="text-sm mt-1"><span className="font-semibold">Place of Supply:</span> [State]</div>
            </div>
          </div>
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="font-bold text-slate-900 mb-1">Bill To:</div>
            <div className="text-sm">{inquiry.name}</div>
            {inquiry.shop && <div className="text-sm">{inquiry.shop}</div>}
            {inquiry.city && <div className="text-sm">{inquiry.city}</div>}
            <div className="text-sm">📞 {inquiry.phone}</div>
            {inquiry.email && <div className="text-sm">✉️ {inquiry.email}</div>}
          </div>
          <table className="w-full mb-6 text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-center">HSN</th>
                <th className="p-2 text-center">Qty</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">CGST</th>
                <th className="p-2 text-right">SGST</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const r = calcRow(item);
                return (
                  <tr key={i} className="border-b">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.code}</div></td>
                    <td className="p-2 text-center">{business.hsnCode || '6403'}</td>
                    <td className="p-2 text-center">{item.quantity || 1}</td>
                    <td className="p-2 text-right">₹{parseFloat(item.priceFrom || 0).toFixed(2)}</td>
                    <td className="p-2 text-right">₹{r.subtotal.toFixed(2)}</td>
                    <td className="p-2 text-right">₹{r.cgst.toFixed(2)}</td>
                    <td className="p-2 text-right">₹{r.sgst.toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">₹{r.total.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <td colSpan="5" className="p-2 text-right">Total:</td>
                <td className="p-2 text-right">₹{totals.subtotal.toFixed(2)}</td>
                <td className="p-2 text-right">₹{totals.cgst.toFixed(2)}</td>
                <td className="p-2 text-right">₹{totals.sgst.toFixed(2)}</td>
                <td className="p-2 text-right">₹{totals.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-50 p-4 rounded">
              <div className="font-bold text-slate-900 mb-2">Bank Details</div>
              <div className="text-sm">Bank: {business.bankName}</div>
              <div className="text-sm">A/C: {business.accountNo}</div>
              <div className="text-sm">IFSC: {business.ifsc}</div>
            </div>
            <div className="bg-amber-50 p-4 rounded">
              <div className="text-sm">Subtotal: ₹{totals.subtotal.toFixed(2)}</div>
              <div className="text-sm">CGST ({gstRate/2}%): ₹{totals.cgst.toFixed(2)}</div>
              <div className="text-sm">SGST ({gstRate/2}%): ₹{totals.sgst.toFixed(2)}</div>
              <div className="text-lg font-bold mt-2 pt-2 border-t border-amber-300">Grand Total: ₹{totals.total.toFixed(2)}</div>
            </div>
          </div>
          <div className="mb-6 p-3 bg-slate-50 rounded text-sm"><span className="font-bold">Amount in Words:</span> {numToWords(totals.total)}</div>
          <div className="text-xs text-slate-600 mb-6">
            <div className="font-bold mb-1">Terms & Conditions:</div>
            <div>• Payment Terms: {business.paymentTerms}</div>
            <div>• Lead Time: {business.leadTime}</div>
            <div>• Shipping: {business.shippingCoverage}</div>
            <div>• Goods once sold will not be taken back unless defective</div>
            <div>• Subject to {business.city || '[City]'} jurisdiction</div>
          </div>
          <div className="flex justify-between items-end pt-6 border-t">
            <div className="text-xs text-slate-500">This is a computer-generated invoice and does not require a physical signature.</div>
            <div className="text-center"><div className="border-t-2 border-slate-900 pt-2 px-8"><div className="text-sm font-semibold">Authorized Signatory</div><div className="text-xs text-slate-600">{business.legalName || business.name}</div></div></div>
          </div>
        </div>
      </div>
      <style>{`@media print { body { background: white !important; } .print\\:hidden { display: none !important; } .print\\:p-0 { padding: 0 !important; } .print\\:p-6 { padding: 1.5rem !important; } .print\\:shadow-none { box-shadow: none !important; } .print\\:rounded-none { border-radius: 0 !important; } .print\\:bg-white { background: white !important; } }`}</style>
    </div>
  );
}

// ===== RETAIL (B2C) PRICING & STOCK HELPERS =====
function retailUnitPrice(p, qty) {
  const base = parseFloat(p.retailPrice) || 0;
  const breaks = Array.isArray(p.qtyBreaks) ? p.qtyBreaks : [];
  let price = base, bestMin = 0;
  for (const b of breaks) {
    const mn = parseInt(b.minQty) || 0;
    const pr = parseFloat(b.price) || 0;
    if (pr > 0 && qty >= mn && mn >= bestMin) { price = pr; bestMin = mn; }
  }
  return price;
}
function sortedBreaks(p) {
  return (Array.isArray(p.qtyBreaks) ? p.qtyBreaks : [])
    .filter(b => b && parseInt(b.minQty) > 0 && parseFloat(b.price) > 0)
    .map(b => ({ minQty: parseInt(b.minQty), price: parseFloat(b.price) }))
    .sort((a, b) => a.minQty - b.minQty);
}
function stockFor(p, size, color) {
  const g = (p && p.stockGrid) || {};
  const v = g[`${size}|${color}`];
  return typeof v === 'number' ? v : (parseInt(v) || 0);
}
function productTotalStock(p) {
  const g = (p && p.stockGrid) || {};
  return Object.values(g).reduce((a, n) => a + (parseInt(n) || 0), 0);
}

// ===== PROFORMA ESTIMATE (client-facing, NOT a tax invoice) =====
function ProformaModal({ items, business, customer, onLog, onClose }) {
  const [step, setStep] = useState('select');
  const [buyer, setBuyer] = useState(() => (customer ? { name: customer.profile.name || '', shop: '', city: customer.profile.city || '', phone: customer.profile.phone || '' } : { name: '', shop: '', city: '', phone: '' }));
  const [useMine, setUseMine] = useState(!!customer);
  const toggleUseMine = (checked) => {
    setUseMine(checked);
    if (checked && customer) setBuyer(b => ({ ...b, name: customer.profile.name || '', city: customer.profile.city || '', phone: customer.profile.phone || '' }));
    else setBuyer(b => ({ ...b, name: '', city: '', phone: '' }));
  };
  const [selected, setSelected] = useState(() => items.map(it => it.id));
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const loggedRef = useRef(false);

  const gstRate = parseFloat(business.gstRate) || 18;
  const chosen = items.filter(it => selected.includes(it.id));
  const calcRow = (item) => {
    const qty = item.quantity || 1 || 0;
    const base = parseFloat(item.retailPrice) || parseFloat(item.priceFrom) || 0;
    const price = retailUnitPrice(item, qty) || base;
    const subtotal = price * qty;
    const cgst = subtotal * gstRate / 200;
    const sgst = subtotal * gstRate / 200;
    return { price, qty, subtotal, cgst, sgst, total: subtotal + cgst + sgst, tierLabel: (price > 0 && price < base) ? 'bulk price' : null };
  };
  const totals = chosen.reduce((a, it) => { const r = calcRow(it); return { subtotal: a.subtotal + r.subtotal, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, total: a.total + r.total }; }, { subtotal: 0, cgst: 0, sgst: 0, total: 0 });
  const number = `PI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const date = new Date().toLocaleDateString('en-IN');

  const generate = () => {
    if (!loggedRef.current) {
      loggedRef.current = true;
      try {
        onLog && onLog({ name: buyer.name.trim(), shop: buyer.shop.trim(), city: buyer.city.trim(), phone: buyer.phone.trim(), products: chosen.map(it => ({ code: it.code, name: it.name, quantity: it.quantity || 1 })) });
      } catch (e) { console.warn('Proforma lead log failed:', e); }
    }
    setStep('view');
  };

  if (step === 'select') {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 overflow-auto p-4 flex items-start justify-center">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl my-8">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Proforma Estimate</h2>
            <button onClick={onClose}><X size={22} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-slate-600">This is a proforma estimate for your planning — not a GST tax invoice. Prices are indicative; final pricing is confirmed when you place an order.</div>
            {customer && (
              <label className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5 cursor-pointer text-sm text-slate-700">
                <input type="checkbox" checked={useMine} onChange={e => toggleUseMine(e.target.checked)} />
                <span>This is for me — use my account details{customer.profile.name ? ` (${customer.profile.name})` : ''}</span>
              </label>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Name *</label>
              <input value={buyer.name} onChange={e => setBuyer({...buyer, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Shop</label><input value={buyer.shop} onChange={e => setBuyer({...buyer, shop: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">City</label><input value={buyer.city} onChange={e => setBuyer({...buyer, city: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label><input value={buyer.phone} onChange={e => setBuyer({...buyer, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Include these products:</div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {items.map(it => (
                  <label key={it.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={selected.includes(it.id)} onChange={() => toggle(it.id)} />
                    <span className="flex-1 text-sm"><span className="font-medium">{it.name}</span> <span className="text-slate-500">({it.code})</span></span>
                    <span className="text-xs text-slate-500">{it.quantity || 1} pairs</span>
                  </label>
                ))}
              </div>
            </div>
            <button onClick={generate} disabled={!buyer.name.trim() || !buyer.phone.trim() || chosen.length === 0} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"><FileText size={18} /> Generate Proforma</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-auto p-4 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-2xl print:shadow-none print:rounded-none">
        <div className="p-6 border-b flex justify-between items-center print:hidden">
          <h2 className="text-xl font-bold">Proforma Preview</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Printer size={18} /> Print / Save PDF</button>
            <button onClick={() => setStep('select')} className="border px-4 py-2 rounded-lg">Back</button>
            <button onClick={onClose} className="border px-4 py-2 rounded-lg">Close</button>
          </div>
        </div>
        <div className="p-8 print:p-6">
          <div className="text-center mb-4 pb-4 border-b-2 border-slate-900">
            <h1 className="text-2xl font-bold text-slate-900">PROFORMA INVOICE</h1>
            <div className="text-sm text-slate-600 mt-1">Estimate only — not a GST tax invoice</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-6 text-xs text-slate-700">This proforma is an indicative estimate for planning purposes. It is not a tax invoice and is not valid for GST/input-credit. Final pricing, taxes, and availability are confirmed by {business.legalName || business.name} when an order is placed.</div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="font-bold text-slate-900 mb-2">{business.legalName || business.name}</div>
              <div className="text-sm text-slate-700 whitespace-pre-line">{business.address}</div>
              <div className="text-sm text-slate-700 mt-2">📞 {business.phone}</div>
              <div className="text-sm text-slate-700">✉️ {business.email}</div>
            </div>
            <div className="text-right">
              <div className="text-sm"><span className="font-semibold">Proforma No:</span> {number}</div>
              <div className="text-sm mt-1"><span className="font-semibold">Date:</span> {date}</div>
            </div>
          </div>
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="font-bold text-slate-900 mb-1">Prepared For:</div>
            <div className="text-sm">{buyer.name}</div>
            {buyer.shop && <div className="text-sm">{buyer.shop}</div>}
            {buyer.city && <div className="text-sm">{buyer.city}</div>}
            {buyer.phone && <div className="text-sm">📞 {buyer.phone}</div>}
          </div>
          <table className="w-full mb-6 text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-center">Qty</th>
                <th className="p-2 text-right">Est. Rate</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">Est. GST</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {chosen.map((item, i) => {
                const r = calcRow(item);
                return (
                  <tr key={i} className="border-b">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.code}{r.tierLabel ? ` · ${r.tierLabel}` : ''}</div></td>
                    <td className="p-2 text-center">{r.qty}</td>
                    <td className="p-2 text-right">₹{r.price.toFixed(2)}</td>
                    <td className="p-2 text-right">₹{r.subtotal.toFixed(2)}</td>
                    <td className="p-2 text-right">₹{(r.cgst + r.sgst).toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">₹{r.total.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <td colSpan="4" className="p-2 text-right">Total (estimated):</td>
                <td className="p-2 text-right">₹{totals.subtotal.toFixed(2)}</td>
                <td className="p-2 text-right">₹{(totals.cgst + totals.sgst).toFixed(2)}</td>
                <td className="p-2 text-right">₹{totals.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="text-xs text-slate-600">
            <div>• Estimated GST shown at {gstRate}% for reference only.</div>
            <div>• Prices are indicative and subject to confirmation.</div>
            <div>• This document does not constitute a tax invoice or a binding quotation.</div>
          </div>
        </div>
      </div>
      <style>{`@media print { body { background: white !important; } .print\\:hidden { display: none !important; } .print\\:p-0 { padding: 0 !important; } .print\\:p-6 { padding: 1.5rem !important; } .print\\:shadow-none { box-shadow: none !important; } .print\\:rounded-none { border-radius: 0 !important; } .print\\:bg-white { background: white !important; } }`}</style>
    </div>
  );
}

// ===== CHECKOUT (B2C order placement) =====
function CheckoutModal({ business, shopCart, products, customer, onPlaceOrder, onClose }) {
  const prof = (customer && customer.profile) || {};
  const [form, setForm] = useState({ name: prof.name || '', phone: prof.phone || '', whatsapp: '', email: prof.email || '', address: prof.address || '', city: prof.city || '', pincode: '', note: '' });
  const codAllowed = shopCart.length > 0 && shopCart.every(it => { const pr = products.find(p => p.id === it.id); return pr ? pr.codAvailable !== false : true; });
  const [pay, setPay] = useState(codAllowed ? 'cod' : 'upi');
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');

  const gstRate = parseFloat(business.gstRate) || 0;
  const subtotal = shopCart.reduce((a, it) => a + retailUnitPrice(it, it.qty) * it.qty, 0);
  const gst = Math.round(subtotal * gstRate / 100);
  const fee = parseFloat(business.deliveryFee) || 0;
  const freeAbove = parseFloat(business.freeDeliveryAbove) || 0;
  const delivery = (freeAbove > 0 && subtotal >= freeAbove) ? 0 : fee;
  const total = subtotal + gst + delivery;
  const upiId = (business.upiId || '').trim();

  const place = async () => {
    setErr('');
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.pincode.trim()) { setErr('Please fill name, phone, address, city and pincode.'); return; }
    if (pay === 'cod' && !codAllowed) { setErr('Cash on Delivery is not available for some items. Please choose UPI.'); return; }
    setPlacing(true);
    const items = shopCart.map(it => { const unit = retailUnitPrice(it, it.qty); return { code: it.code, name: it.name, size: it.size, color: it.color, qty: it.qty, unit, lineTotal: unit * it.qty }; });
    const order = {
      id: `ord_${Date.now()}`, orderNo: makeOrderNo(), type: 'order', date: new Date().toISOString(),
      name: form.name.trim(), phone: form.phone.trim(), whatsapp: (form.whatsapp || form.phone).trim(), email: form.email.trim(),
      address: form.address.trim(), city: form.city.trim(), pincode: form.pincode.trim(), note: form.note.trim(),
      items, subtotal, gst, gstRate, delivery, total,
      payment: pay, paymentLabel: pay === 'cod' ? 'Cash on Delivery' : 'UPI (to be confirmed)', status: 'new'
    };
    try { await onPlaceOrder(order); setDone(order); } catch (e) { setErr('Could not place the order. Please try again or contact us on WhatsApp.'); }
    setPlacing(false);
  };

  if (done) {
    const upiLink = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(business.upiName || business.name || '')}&am=${done.total}&cu=INR` : '';
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle className="text-green-600" size={34} /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Order placed! 🎉</h2>
          <div className="inline-block bg-amber-50 border border-amber-200 text-amber-700 font-mono font-bold px-4 py-1.5 rounded-full mb-3">{done.orderNo}</div>
          <p className="text-slate-600 text-sm mb-4">Total <span className="font-bold">₹{done.total.toLocaleString('en-IN')}</span> · {done.paymentLabel}</p>
          {done.payment === 'upi' && (
            <div className="bg-slate-50 border rounded-xl p-4 text-left text-sm mb-4">
              <div className="font-semibold text-slate-900 mb-1">Pay ₹{done.total.toLocaleString('en-IN')} via UPI</div>
              {upiId ? (<>
                <div className="text-slate-600">UPI ID: <span className="font-mono font-semibold">{upiId}</span></div>
                <div className="my-3 flex flex-col items-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`} alt="Scan to pay via UPI" width="180" height="180" className="rounded-lg border bg-white p-1" />
                  <div className="text-xs text-slate-500 mt-1">Scan with any UPI app to pay (amount pre-filled)</div>
                </div>
                {upiLink && <a href={upiLink} className="inline-block bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold">Open UPI app to pay (on phone)</a>}
                <div className="text-xs text-slate-500 mt-2">On a computer, scan the QR with your phone. After paying, we'll confirm your payment and dispatch your order.</div>
              </>) : <div className="text-slate-600">We'll share UPI payment details on WhatsApp shortly.</div>}
            </div>
          )}
          <p className="text-xs text-slate-500 mb-4">We've received your order and will contact you to confirm.{customer ? ' You can see it under My orders.' : ''}</p>
          <div className="flex gap-3 justify-center">
            <a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hi, I just placed order ${done.orderNo}.`)}`} target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2"><WhatsAppIcon size={16} /> WhatsApp</a>
            <button onClick={onClose} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-semibold">Done</button>
          </div>
        </div>
      </div>
    );
  }

  const Field = (label, key, opts = {}) => (
    <div className={opts.full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{opts.req ? ' *' : ''}</label>
      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={opts.ph || ''} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center"><h2 className="font-bold text-slate-900">Checkout</h2><button onClick={onClose} aria-label="Close"><X size={22} /></button></div>
        <div className="p-5">
          <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm">
            {shopCart.map(it => { const u = retailUnitPrice(it, it.qty); return <div key={it.key} className="flex justify-between py-0.5 gap-2"><span className="text-slate-600">{it.name} <span className="text-xs text-slate-400">({it.size}/{it.color}) ×{it.qty}</span></span><span className="font-medium whitespace-nowrap">₹{(u * it.qty).toLocaleString('en-IN')}</span></div>; })}
            <div className="border-t mt-2 pt-2 space-y-0.5">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-slate-600"><span>GST ({gstRate}%)</span><span>₹{gst.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-slate-600"><span>Delivery</span><span>{delivery ? `₹${delivery.toLocaleString('en-IN')}` : 'Free'}</span></div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-1"><span>Total</span><span>₹{total.toLocaleString('en-IN')}</span></div>
            </div>
          </div>

          <div className="text-sm font-semibold text-slate-900 mb-2">Delivery details</div>
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {Field('Full name', 'name', { req: true })}
            {Field('Phone', 'phone', { req: true })}
            {Field('WhatsApp (optional)', 'whatsapp')}
            {Field('Email (optional)', 'email')}
            {Field('Full address', 'address', { req: true, full: true })}
            {Field('City', 'city', { req: true })}
            {Field('Pincode', 'pincode', { req: true })}
            {Field('Note (optional)', 'note', { full: true })}
          </div>

          <div className="text-sm font-semibold text-slate-900 mb-2">Payment</div>
          <div className="space-y-2 mb-4">
            <label className={`flex items-center gap-3 border rounded-lg p-3 ${!codAllowed ? 'opacity-60' : 'cursor-pointer'} ${pay === 'cod' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
              <input type="radio" name="pay" disabled={!codAllowed} checked={pay === 'cod'} onChange={() => setPay('cod')} />
              <div><div className="text-sm font-medium text-slate-900">Cash on Delivery</div>{!codAllowed && <div className="text-xs text-red-500">Not available for some items in your cart</div>}</div>
            </label>
            <label className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer ${pay === 'upi' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
              <input type="radio" name="pay" checked={pay === 'upi'} onChange={() => setPay('upi')} />
              <div><div className="text-sm font-medium text-slate-900">UPI</div><div className="text-xs text-slate-500">{upiId ? `Pay to ${upiId} after placing the order` : 'We share UPI details after you place the order'}</div></div>
            </label>
          </div>

          {err && <div className="text-sm text-red-600 mb-3">{err}</div>}
          <button onClick={place} disabled={placing} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-semibold">{placing ? 'Placing order…' : `Place order · ₹${total.toLocaleString('en-IN')}`}</button>
          <div className="text-xs text-slate-400 text-center mt-2">We'll contact you to confirm your order.</div>
        </div>
      </div>
    </div>
  );
}

// ===== CONTACT PAGE =====
function ContactPage({ business, inquiryList, setInquiryList, saveInquiry, navigate, showToast, customer, onInquirySubmitted }) {
  const [form, setForm] = useState(() => {
    try { const s = localStorage.getItem('wsContactForm'); if (s) return { name: '', shop: '', city: '', phone: '', email: '', message: '', sameWhatsapp: true, whatsapp: '', ...JSON.parse(s) }; } catch (e) {}
    return { name: '', shop: '', city: '', phone: '', email: '', message: '', sameWhatsapp: true, whatsapp: '' };
  });
  const [submitted, setSubmitted] = useState(false);
  const [submittedNo, setSubmittedNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState({ db: null, sheets: null, email: null });

  // Remember what's typed so a refresh doesn't lose it
  useEffect(() => {
    try { localStorage.setItem('wsContactForm', JSON.stringify(form)); } catch (e) {}
  }, [form]);

  const submit = async () => {
    if (!form.name || !form.phone) { showToast('Please fill name and phone'); return; }
    setSubmitting(true);
    const whatsappNumber = form.sameWhatsapp ? form.phone : (form.whatsapp || form.phone);
    const inqNo = await nextInquiryNumber();
    setSubmittedNo(inqNo);
    const inq = { id: `inq_${Date.now()}`, inqNo, ...form, whatsapp: whatsappNumber, products: [...inquiryList], date: new Date().toISOString(), status: 'new', type: 'inquiry', source: 'Inquiry Form' };
    
    const dbOk = await saveInquiry(inq);
    setSubmissionStatus(s => ({ ...s, db: dbOk }));
    
    const sheetsOk = await pushToGoogleSheets(inq);
    setSubmissionStatus(s => ({ ...s, sheets: sheetsOk }));
    
    const emailOk = await sendInquiryEmail(inq);
    setSubmissionStatus(s => ({ ...s, email: emailOk }));
    
    setSubmitting(false);
    setSubmitted(true);
    if (dbOk || emailOk || sheetsOk) { try { onInquirySubmitted && onInquirySubmitted(inq); } catch (e) {} }
    setInquiryList([]);
    setForm({ name: '', shop: '', city: '', phone: '', email: '', message: '', sameWhatsapp: true, whatsapp: '' });
    try { localStorage.removeItem('wsContactForm'); } catch (e) {}
  };

  const [appt, setAppt] = useState({ name: '', phone: '', date: '', time: '', note: '' });
  const [apptSubmitting, setApptSubmitting] = useState(false);
  const [apptSubmitted, setApptSubmitted] = useState(false);
  const submitAppointment = async () => {
    if (!appt.name.trim() || !appt.phone.trim() || !appt.date || !appt.time) { showToast('Please fill name, phone, date and time'); return; }
    setApptSubmitting(true);
    const rec = {
      id: `apt_${Date.now()}`,
      name: appt.name.trim(), shop: '', city: '', phone: appt.phone.trim(), whatsapp: appt.phone.trim(), email: '',
      message: `Appointment request for ${appt.date}${appt.time ? ' at ' + appt.time : ''}.${appt.note ? ' Note: ' + appt.note.trim() : ''}`,
      products: [], apptDate: appt.date, apptTime: appt.time,
      date: new Date().toISOString(), status: 'new', type: 'appointment', source: 'Appointment',
    };
    await saveInquiry(rec);
    pushToGoogleSheets(rec);
    sendInquiryEmail(rec);
    setApptSubmitting(false);
    setApptSubmitted(true);
    setAppt({ name: '', phone: '', date: '', time: '', note: '' });
  };
  const rawEmbed = (business.mapEmbedUrl || '').trim();
  let mapSrc = '';
  if (rawEmbed) {
    const m = rawEmbed.match(/src\s*=\s*"([^"]+)"/i);
    mapSrc = m ? m[1] : rawEmbed;
  } else if ((business.mapQuery || '').trim()) {
    mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(business.mapQuery.trim())}&output=embed`;
  }
  const validMap = /^https?:\/\//i.test(mapSrc);

  const apptDays = Array.isArray(business.apptDays) ? business.apptDays : [1, 2, 3, 4, 5, 6];
  const apptSlots = Array.isArray(business.apptSlots) ? business.apptSlots.filter(Boolean) : [];
  const daysAhead = parseInt(business.apptDaysAhead) || 30;
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const availableDates = [];
  {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= daysAhead; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      if (apptDays.includes(d.getDay())) {
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        availableDates.push({ value: val, label: `${weekdayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}` });
      }
    }
  }
  const apptReady = availableDates.length > 0 && apptSlots.length > 0;

  useEffect(() => {
    if (customer && customer.profile) {
      const p = customer.profile;
      setForm(prev => ({ ...prev, name: prev.name || p.name || '', phone: prev.phone || p.phone || '', email: prev.email || p.email || '', city: prev.city || p.city || '' }));
      setAppt(prev => ({ ...prev, name: prev.name || p.name || '', phone: prev.phone || p.phone || '' }));
    }
  }, [customer]);

  if (submitted) {
    const StatusItem = ({ status, label }) => {
      if (status === true) return <div className="flex items-center gap-2"><CheckCircle className="text-green-500 flex-shrink-0" size={16} /><span>{label}</span></div>;
      return <div className="flex items-center gap-2"><X className="text-red-500 flex-shrink-0" size={16} /><span>{label}</span></div>;
    };
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="text-green-600" size={40} /></div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Inquiry Submitted! 🎉</h1>
        {submittedNo && <div className="inline-block bg-amber-50 border border-amber-200 text-amber-700 font-mono font-bold px-4 py-1.5 rounded-full mb-4">{submittedNo}</div>}
        <p className="text-slate-600 mb-6">Thank you! Our team will get back to you within 24 hours.</p>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
          <div className="text-sm font-medium text-slate-700 mb-2">✅ Your Inquiry Has Been:</div>
          <div className="space-y-1 text-sm">
            <StatusItem status={submissionStatus.db} label="Saved to our database" />
            <StatusItem status={submissionStatus.sheets} label="Logged in our system" />
          </div>
          <div className="text-xs text-slate-600 mt-3 pt-2 border-t border-green-200">💬 For faster response, message us on WhatsApp directly!</div>
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hi, I just submitted an inquiry. My name is ${form.name || 'Customer'}.`)}`} target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"><WhatsAppIcon size={18} /> Message on WhatsApp</a>
          <button onClick={() => { setSubmitted(false); navigate('home'); }} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold">Back to Home</button>
          <button onClick={() => { setSubmitted(false); navigate('catalog'); }} className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-lg font-semibold">Continue Browsing</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">Get in Touch</h1>
      <p className="text-slate-600 mb-12">Send us your inquiry and we'll get back to you within 24 hours</p>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white rounded-2xl p-6 md:p-8 shadow-sm border">
          <h2 className="text-xl font-bold mb-6">Send Inquiry</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Your Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Shop Name</label><input value={form.shop} onChange={e => setForm({...form, shop: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">City</label><input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Phone *</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.sameWhatsapp} onChange={e => setForm({...form, sameWhatsapp: e.target.checked})} />
                My phone number is also my WhatsApp
              </label>
              {!form.sameWhatsapp && (
                <div className="mt-3">
                  <label className="text-sm font-medium text-slate-700 block mb-1">WhatsApp Number</label>
                  <input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} placeholder="e.g., +91 98765 43210" className="w-full px-3 py-2 border rounded-lg" />
                  <div className="text-xs text-slate-500 mt-1">Include country code so we can reach you on WhatsApp.</div>
                </div>
              )}
            </div>
            <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700 block mb-1">Email</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700 block mb-1">Message</label><textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows="4" placeholder="Tell us what you're looking for..." className="w-full px-3 py-2 border rounded-lg"></textarea></div>
          </div>
          {inquiryList.length > 0 && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="font-semibold text-slate-900 mb-2">📦 Products in Your Inquiry ({inquiryList.length})</div>
              <div className="text-sm text-slate-600">{inquiryList.map(p => `${p.code}${(p.selSize||p.selColor)?` (${[p.selSize,p.selColor].filter(Boolean).join('/')})`:''} ×${p.quantity}`).join(', ')}</div>
            </div>
          )}
          <button onClick={submit} disabled={submitting} className="mt-6 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="animate-spin" size={18} /> Submitting...</> : <><Send size={18} /> Submit Inquiry</>}
          </button>
          <div className="text-xs text-slate-500 mt-2 text-center">We'll review your inquiry and get back to you within 24 hours.</div>
          {business.paymentNote && <div className="text-xs text-slate-500 mt-3 flex items-start gap-2 bg-slate-50 rounded-lg p-3"><Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" /><span>{business.paymentNote}</span></div>}
        </div>
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-2xl p-6">
            <h3 className="font-bold mb-4">Contact Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3"><Phone className="text-amber-400 flex-shrink-0" size={18} /><div>{business.phone}</div></div>
              <div className="flex gap-3"><Mail className="text-amber-400 flex-shrink-0" size={18} /><div>{business.email}</div></div>
              <div className="flex gap-3"><MapPin className="text-amber-400 flex-shrink-0" size={18} /><div>{business.address}</div></div>
              <div className="flex gap-3"><Clock className="text-amber-400 flex-shrink-0" size={18} /><div>{business.hours}</div></div>
            </div>
          </div>
          <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" className="block bg-green-500 hover:bg-green-600 text-white rounded-2xl p-6 text-center transition-colors">
            <span className="mx-auto mb-2 block w-8"><WhatsAppIcon size={32} /></span>
            <div className="font-bold">Chat on WhatsApp</div>
            <div className="text-sm opacity-90 mt-1">Quick responses to your queries</div>
          </a>
          {validMap && (
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-200">
              <iframe title="Our location" src={mapSrc} className="w-full" style={{ height: 220, border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.mapQuery || business.address || '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm text-amber-600 hover:bg-amber-50 py-3 font-medium"><MapPin size={16} /> Get Directions</a>
            </div>
          )}
        </div>
      </div>

      {business.appointmentsEnabled && (
        <div className="max-w-2xl mx-auto mt-10 rounded-2xl overflow-hidden shadow-lg border border-slate-200">
          <div className="bg-slate-900 px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#C6A15B' }}><Clock size={20} className="text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Book an Appointment to Visit</h2>
              {business.appointmentNote && <p className="text-xs text-slate-300 mt-0.5">{business.appointmentNote}</p>}
            </div>
          </div>
          <div className="bg-white p-6">
            {apptSubmitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 flex items-start gap-2"><CheckCircle size={18} className="flex-shrink-0 mt-0.5" /><span>Thanks! Your appointment request has been sent. We'll confirm your slot by phone or WhatsApp.</span></div>
            ) : !apptReady ? (
              <div className="text-sm text-slate-600">To arrange a visit, please <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-medium underline">message us on WhatsApp</a> or call {business.phone}.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Your Name *</label><input value={appt.name} onChange={e => setAppt({...appt, name: e.target.value})} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" /></div>
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Phone *</label><input value={appt.phone} onChange={e => setAppt({...appt, phone: e.target.value})} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" /></div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Pick a Date *</label>
                  <select value={appt.date} onChange={e => setAppt({...appt, date: e.target.value})} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-400 outline-none">
                    <option value="">Select a date…</option>
                    {availableDates.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Pick a Time *</label>
                  <select value={appt.time} onChange={e => setAppt({...appt, time: e.target.value})} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-400 outline-none">
                    <option value="">Select a time…</option>
                    {apptSlots.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700 block mb-1">Note (optional)</label><input value={appt.note} onChange={e => setAppt({...appt, note: e.target.value})} placeholder="Anything we should know?" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" /></div>
                <button onClick={submitAppointment} disabled={apptSubmitting} className="md:col-span-2 bg-slate-900 hover:bg-amber-500 disabled:bg-slate-300 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">{apptSubmitting ? <><Loader2 className="animate-spin" size={18} /> Sending…</> : <><Clock size={18} /> Request Appointment</>}</button>
                <div className="md:col-span-2 text-xs text-slate-500 text-center">This is a request — we'll confirm the exact slot with you.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== GENERIC CRUD EDITOR =====
function CrudListEditor({ title, icon: Icon, items, onSave, fields, itemLabel = 'Item', renderItem, idPrefix = 'item' }) {
  const [editing, setEditing] = useState(null);
  const blank = fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default ?? '' }), {});
  const [form, setForm] = useState(blank);

  const startEdit = (item) => { setEditing(item); setForm({ ...item }); };
  const startNew = () => { setEditing({}); setForm({ ...blank, id: `${idPrefix}_${Date.now()}` }); };
  const cancel = () => { setEditing(null); setForm(blank); };

  const save = async () => {
    const required = fields.filter(f => f.required).map(f => f.key);
    for (const r of required) {
      if (!form[r] || (typeof form[r] === 'string' && !form[r].trim())) { alert(`${fields.find(f => f.key === r).label} is required`); return; }
    }
    const updated = editing && editing.id && items.find(i => i.id === editing.id) ? items.map(i => i.id === editing.id ? form : i) : [...items, form];
    await onSave(updated);
    cancel();
  };

  const del = async (id) => { if (confirm(`Delete this ${itemLabel}?`)) await onSave(items.filter(i => i.id !== id)); };
  const move = async (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newList = [...items];
    [newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]];
    await onSave(newList);
  };

  if (editing !== null) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2"><Icon className="text-amber-500" /> {editing.id && items.find(i => i.id === editing.id) ? `Edit ${itemLabel}` : `New ${itemLabel}`}</h1>
          <button onClick={cancel} className="text-slate-600 hover:text-slate-900">← Back</button>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl">
          <div className="space-y-4">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}{f.required && ' *'}</label>
                {f.type === 'textarea' ? <textarea value={form[f.key] || ''} onChange={e => setForm({...form, [f.key]: e.target.value})} rows="3" className="w-full px-3 py-2 border rounded-lg" placeholder={f.placeholder} /> : f.type === 'number' ? <input type="number" min={f.min} max={f.max} value={form[f.key] ?? ''} onChange={e => setForm({...form, [f.key]: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" placeholder={f.placeholder} /> : <input value={form[f.key] || ''} onChange={e => setForm({...form, [f.key]: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder={f.placeholder} />}
                {f.hint && <div className="text-xs text-slate-500 mt-1">{f.hint}</div>}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t">
            <button onClick={save} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg flex items-center gap-2"><Save size={18} /> Save</button>
            <button onClick={cancel} className="border px-6 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2"><Icon className="text-amber-500" /> {title} ({items.length})</h1>
        <button onClick={startNew} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={18} /> Add {itemLabel}</button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start gap-3">
            <div className="flex flex-col gap-1">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">▲</button>
              <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">▼</button>
            </div>
            <div className="flex-1">{renderItem(item)}</div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(item)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={16} /></button>
              <button onClick={() => del(item.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="bg-white rounded-xl p-12 text-center text-slate-500">No {itemLabel.toLowerCase()}s yet</div>}
      </div>
    </div>
  );
}

// ===== ADMIN PANEL =====
function AdminPanel({ business, saveBusiness, products, saveProducts, categories, saveCategories, faqs, saveFaqs, testimonials, saveTestimonials, features, saveFeatures, steps, saveSteps, inquiries, saveInquiries, adminToken, navigate, showToast, setAdminAuth, logout }) {
  const [tab, setTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  useEffect(() => {
    if (tab !== 'orders') return;
    if (!adminToken) { setOrdersError('Your admin session needs a fresh login to load orders. Please log out and log in again.'); setOrders([]); return; }
    let cancel = false;
    (async () => {
      setOrdersLoading(true); setOrdersError('');
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const rows = await r.json();
        if (!cancel) setOrders(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancel) setOrdersError('Could not load orders. Check that the admin read policy is set in Supabase (see note below).');
      } finally { if (!cancel) setOrdersLoading(false); }
    })();
    return () => { cancel = true; };
  }, [tab, adminToken]);
  const ORDER_STATUSES = ['new', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
  const updateOrderStatus = async (rowId, status) => {
    setOrders(prev => prev.map(r => r.id === rowId ? { ...r, status } : r));
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(rowId)}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showToast('Order status updated ✓');
    } catch (e) { showToast('Could not update status — check the Supabase update policy'); }
  };
  const [invoiceFor, setInvoiceFor] = useState(null);
  const blankProduct = { id: '', code: '', name: '', category: categories[0]?.id || '', image: '', images: [''], sizes: ['6','7','8','9','10','11'], colors: ['Black'], material: '', priceFrom: '', isNew: false, isBestseller: false, active: true, outOfStock: false, codAvailable: true, description: '', availabilityNote: '', retailPrice: '', qtyBreaks: [{ minQty: 11, price: '' }], stockGrid: {} };
  const [pForm, setPForm] = useState(blankProduct);

  useEffect(() => { setEditBiz(business); }, [business]);

  const editProduct = (p) => { setEditingProduct(p); setPForm({ ...p, images: (Array.isArray(p.images) && p.images.filter(Boolean).length) ? p.images.filter(Boolean) : (p.image ? [p.image] : ['']) }); setTab('product-edit'); };
  const newProduct = () => { setEditingProduct(null); setPForm({ ...blankProduct, id: `prod_${Date.now()}`, code: `SH-${String(products.length + 1).padStart(4, '0')}`, category: categories[0]?.id || '' }); setTab('product-edit'); };

  const saveProduct = async () => {
    if (!pForm.name || !pForm.code) { showToast('Name and code required'); return; }
    const imgs = (pForm.images || []).map(s => (s || '').trim()).filter(Boolean);
    const breaks = (pForm.qtyBreaks || []).filter(b => b && String(b.minQty).trim() !== '' && String(b.price).trim() !== '').map(b => ({ minQty: parseInt(b.minQty) || 0, price: parseFloat(b.price) || 0 })).filter(b => b.minQty > 0 && b.price > 0);
    const cleaned = { ...pForm, images: imgs, image: imgs[0] || '', qtyBreaks: breaks };
    const updated = editingProduct ? products.map(p => p.id === editingProduct.id ? cleaned : p) : [...products, cleaned];
    await saveProducts(updated);
    showToast(editingProduct ? 'Product updated ✓' : 'Product added ✓');
    setTab('products'); setEditingProduct(null);
  };

  const deleteProduct = async (id) => { if (confirm('Delete this product?')) { await saveProducts(products.filter(p => p.id !== id)); showToast('Product deleted'); } };

  const saveCategoriesWithCheck = async (newCats) => {
    const removed = categories.filter(c => !newCats.find(n => n.id === c.id)).map(c => c.id);
    for (const id of removed) {
      const count = products.filter(p => p.category === id).length;
      if (count > 0) { alert(`Cannot delete category — ${count} product(s) still use it.`); return; }
    }
    await saveCategories(newCats);
    showToast('Categories updated ✓');
  };

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'inquiries', label: 'Inquiries', icon: Inbox },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
    { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
    { id: 'features', label: 'Why Choose Us', icon: Sparkles },
    { id: 'steps', label: 'How to Order', icon: ListChecks },
    { id: 'business', label: 'Business Info', icon: Settings },
    { id: 'integrations', label: 'Integrations', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-900 text-white min-h-screen p-4 hidden md:block flex-shrink-0">
        <div className="mb-6 pb-4 border-b border-slate-700">
          <div className="text-amber-400 text-xs uppercase tracking-wider">Admin Panel</div>
          <div className="text-lg font-bold mt-1 truncate">{business.name}</div>
        </div>
        <nav className="space-y-1">
          {sidebarItems.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${tab === t.id || (t.id === 'products' && tab === 'product-edit') ? 'bg-amber-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><t.icon size={16} /> {t.label}</button>
          ))}
        </nav>
        <div className="mt-6 pt-4 border-t border-slate-700 space-y-1">
          <button onClick={() => navigate('home')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800"><Eye size={16} /> View Website</button>
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800"><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="md:hidden mb-6 flex gap-2 overflow-x-auto pb-2">
          {sidebarItems.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${tab === t.id ? 'bg-amber-500 text-white' : 'bg-white text-slate-700'}`}>{t.label}</button>)}
          <button onClick={() => navigate('home')} className="px-4 py-2 rounded-lg text-sm whitespace-nowrap bg-white text-slate-700">View Site</button>
          <button onClick={logout} className="px-4 py-2 rounded-lg text-sm whitespace-nowrap bg-white text-red-600">Logout</button>
        </div>

        {tab === 'dashboard' && (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Dashboard</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[{ label: 'Products', value: products.length, icon: Package }, { label: 'Categories', value: categories.length, icon: Tag }, { label: 'New Inquiries', value: inquiries.filter(i => i.status === 'new').length, icon: Inbox }, { label: 'Total Inquiries', value: inquiries.length, icon: MessageCircle }].map((s, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm"><s.icon className="text-amber-500 mb-3" size={24} /><div className="text-3xl font-bold text-slate-900">{s.value}</div><div className="text-sm text-slate-600 mt-1">{s.label}</div></div>
              ))}
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Inquiries</h2>
              {inquiries.slice(0, 5).map(i => (
                <div key={i.id} className="py-3 border-b last:border-b-0 flex justify-between items-center">
                  <div><div className="font-medium text-slate-900">{i.name} • {i.shop || 'N/A'}</div><div className="text-sm text-slate-500">{i.products?.length || 0} products • {new Date(i.date).toLocaleDateString()}</div></div>
                  <span className={`text-xs px-3 py-1 rounded-full ${i.status === 'new' ? 'bg-blue-100 text-blue-700' : i.status === 'contacted' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{i.status}</span>
                </div>
              ))}
              {inquiries.length === 0 && <div className="text-center py-8 text-slate-500">No inquiries yet</div>}
            </div>
          </div>
        )}

        {tab === 'integrations' && (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Integrations</h1>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 max-w-2xl">
              <h3 className="font-bold text-blue-900 mb-3">🚀 Integrations Status</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ <strong>Supabase Database</strong> — All data persisted in cloud</li>
                <li>✅ <strong>Google Sheets Push</strong> — Inquiries auto-saved to your sheet</li>
                <li>✅ <strong>Email Notifications</strong> — Sent to {ADMIN_EMAIL}</li>
                <li>✅ <strong>AI Support Agent</strong> — 24/7 customer chatbot</li>
                <li>✅ <strong>GST Invoice Generator</strong> — Click any inquiry to generate</li>
              </ul>
              <div className="mt-4 pt-4 border-t border-blue-200">
                <button onClick={async () => {
                  const tests = [];
                  tests.push('🔍 Running connection tests...\n');
                  
                  // Test Supabase
                  try {
                    const r = await fetch(`${SUPABASE_URL}/rest/v1/business_info?select=id&limit=1`, { headers: sb.headers });
                    if (r.ok) tests.push('✅ Supabase: Connected');
                    else tests.push(`❌ Supabase: HTTP ${r.status} - ${(await r.text()).slice(0,100)}`);
                  } catch (e) { tests.push(`❌ Supabase: ${e.message}`); }
                  
                  // Test Supabase write
                  try {
                    const testId = `test_${Date.now()}`;
                    const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, { method: 'POST', headers: { ...sb.headers, 'Prefer': 'return=representation' }, body: JSON.stringify([{ id: testId, data: { test: true }, status: 'test' }]) });
                    if (r.ok) {
                      tests.push('✅ Supabase Write: Working');
                      await fetch(`${SUPABASE_URL}/rest/v1/inquiries?id=eq.${testId}`, { method: 'DELETE', headers: sb.headers });
                    } else tests.push(`❌ Supabase Write: HTTP ${r.status} - ${(await r.text()).slice(0,150)}`);
                  } catch (e) { tests.push(`❌ Supabase Write: ${e.message}`); }
                  
                  // Test Google Sheets
                  try {
                    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ test: true }) });
                    tests.push('🟡 Google Sheets: Request sent (cannot verify - works on real deployment)');
                  } catch (e) { tests.push(`❌ Google Sheets: ${e.message} (blocked in artifact)`); }
                  
                  // Test Web3Forms
                  try {
                    const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: 'Connection Test', from_name: 'Website Test', name: 'Connection Test', message: 'Automated connection test from admin panel.' }) });
                    const d = await r.json();
                    if (d.success) tests.push('✅ Web3Forms Email: Connected (check inbox for test email)');
                    else tests.push(`❌ Web3Forms: ${d.message}`);
                  } catch (e) { tests.push(`❌ Web3Forms: ${e.message}`); }
                  
                  alert(tests.join('\n'));
                }} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">🧪 Test All Connections</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-6"><h1 className="text-3xl font-bold text-slate-900">Products ({products.length})</h1><button onClick={newProduct} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={18} /> Add Product</button></div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b"><tr><th className="text-left p-4 text-sm font-semibold">Image</th><th className="text-left p-4 text-sm font-semibold">Code</th><th className="text-left p-4 text-sm font-semibold">Name</th><th className="text-left p-4 text-sm font-semibold">Category</th><th className="text-left p-4 text-sm font-semibold">Tags</th><th className="text-left p-4 text-sm font-semibold">Actions</th></tr></thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} className="border-b hover:bg-slate-50">
                        <td className="p-4"><SafeImage src={p.image} alt={p.name} className="w-12 h-12 rounded object-cover" /></td>
                        <td className="p-4 text-sm font-mono">{p.code}</td><td className="p-4 text-sm font-medium">{p.name}</td>
                        <td className="p-4 text-sm">{categories.find(c => c.id === p.category)?.name || 'None'}</td>
                        <td className="p-4"><div className="flex gap-1 flex-wrap">{p.isNew && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">New</span>}{p.isBestseller && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Best</span>}{p.active === false && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">Hidden</span>}{p.outOfStock && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Out of stock</span>}</div></td>
                        <td className="p-4"><div className="flex gap-2"><button onClick={() => editProduct(p)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={16} /></button><button onClick={() => deleteProduct(p.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {products.length === 0 && <div className="text-center py-12 text-slate-500">No products yet</div>}
            </div>
          </div>
        )}

        {tab === 'product-edit' && (
          <div>
            <div className="flex justify-between items-center mb-6"><h1 className="text-3xl font-bold text-slate-900">{editingProduct ? 'Edit Product' : 'New Product'}</h1><button onClick={() => setTab('products')} className="text-slate-600 hover:text-slate-900">← Back</button></div>
            <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl">
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Product Code *</label><input value={pForm.code} onChange={e => setPForm({...pForm, code: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label><input value={pForm.name} onChange={e => setPForm({...pForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><select value={pForm.category} onChange={e => setPForm({...pForm, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg">{categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Price From (₹)</label><input value={pForm.priceFrom} onChange={e => setPForm({...pForm, priceFrom: e.target.value})} placeholder="e.g., 500" className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Images</label>
                  <div className="text-xs text-slate-500 mb-2">The first image is the main one shown on cards. You can paste several URLs at once (one per line) and they'll split automatically.</div>
                  {(pForm.images && pForm.images.length ? pForm.images : ['']).map((url, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <input value={url} onChange={e => { const val = e.target.value; const base = [...(pForm.images && pForm.images.length ? pForm.images : [''])]; const parts = val.split(/[\s,]+/).map(s => s.trim()).filter(Boolean); if (parts.length > 1) base.splice(i, 1, ...parts); else base[i] = val; setPForm({...pForm, images: base}); }} onPaste={e => { const text = (e.clipboardData || window.clipboardData).getData('text'); const parts = text.split(/[\s,\n\r]+/).map(s => s.trim()).filter(Boolean); if (parts.length > 1) { e.preventDefault(); const base = [...(pForm.images && pForm.images.length ? pForm.images : [''])]; base.splice(i, 1, ...parts); setPForm({...pForm, images: base}); } }} placeholder={i === 0 ? 'https://... (main image)' : 'https://...'} className="flex-1 px-3 py-2 border rounded-lg" />
                      {url && <SafeImage src={url} alt="preview" className="w-12 h-12 rounded object-cover border flex-shrink-0" />}
                      <button onClick={() => { const base = (pForm.images && pForm.images.length ? pForm.images : ['']); const arr = base.filter((_, j) => j !== i); setPForm({...pForm, images: arr.length ? arr : ['']}); }} className="text-red-600 hover:bg-red-50 p-2 rounded flex-shrink-0"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button onClick={() => setPForm({...pForm, images: [...(pForm.images && pForm.images.length ? pForm.images : ['']), '']})} className="text-sm text-amber-600 hover:underline flex items-center gap-1"><Plus size={14} /> Add image</button>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Sizes (comma separated)</label><input value={pForm.sizes.join(', ')} onChange={e => setPForm({...pForm, sizes: e.target.value.split(',').map(s => s.trim())})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Colors (comma separated)</label><input value={pForm.colors.join(', ')} onChange={e => setPForm({...pForm, colors: e.target.value.split(',').map(s => s.trim())})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Material</label><input value={pForm.material} onChange={e => setPForm({...pForm, material: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea value={pForm.description} onChange={e => setPForm({...pForm, description: e.target.value})} rows="3" className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Availability Note (optional)</label><input value={pForm.availabilityNote || ''} onChange={e => setPForm({...pForm, availabilityNote: e.target.value})} placeholder="e.g., Size 6 available in Red only" className="w-full px-3 py-2 border rounded-lg" /><div className="text-xs text-slate-500 mt-1">Shown on the product page under sizes &amp; colours — use it to note any size/colour limits.</div></div>
                <div className="flex gap-4 flex-wrap md:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={pForm.isNew} onChange={e => setPForm({...pForm, isNew: e.target.checked})} /> New Arrival</label><label className="flex items-center gap-2"><input type="checkbox" checked={pForm.isBestseller} onChange={e => setPForm({...pForm, isBestseller: e.target.checked})} /> Bestseller</label><label className="flex items-center gap-2"><input type="checkbox" checked={pForm.active !== false} onChange={e => setPForm({...pForm, active: e.target.checked})} /> Active (show on site)</label><label className="flex items-center gap-2"><input type="checkbox" checked={!!pForm.outOfStock} onChange={e => setPForm({...pForm, outOfStock: e.target.checked})} /> Out of stock</label><label className="flex items-center gap-2"><input type="checkbox" checked={pForm.codAvailable !== false} onChange={e => setPForm({...pForm, codAvailable: e.target.checked})} /> Cash on Delivery available</label></div>

                <div className="md:col-span-2 mt-2 pt-4 border-t border-slate-200">
                  <div className="font-semibold text-slate-900 mb-1">Retail Buy Pricing &amp; Stock (B2C)</div>
                  <div className="text-xs text-slate-500 mb-3">For the direct-buy flow. Not shown to customers yet — we switch the storefront over when the buy flow goes live.</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Retail Price (₹ per pair)</label><input type="number" value={pForm.retailPrice || ''} onChange={e => setPForm({...pForm, retailPrice: e.target.value})} placeholder="e.g., 599" className="w-full px-3 py-2 border rounded-lg" /></div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantity-break discounts (optional)</label>
                    <div className="text-xs text-slate-500 mb-2">Buy this many or more → this price per pair. The best matching break applies automatically.</div>
                    {(pForm.qtyBreaks && pForm.qtyBreaks.length ? pForm.qtyBreaks : [{ minQty: '', price: '' }]).map((b, i) => (
                      <div key={i} className="flex gap-2 mb-2 items-center">
                        <span className="text-sm text-slate-500">Buy</span>
                        <input type="number" value={b.minQty} onChange={e => { const arr = [...(pForm.qtyBreaks || [])]; arr[i] = { ...arr[i], minQty: e.target.value }; setPForm({...pForm, qtyBreaks: arr}); }} placeholder="11" className="w-20 px-3 py-2 border rounded-lg" />
                        <span className="text-sm text-slate-500">+ → ₹</span>
                        <input type="number" value={b.price} onChange={e => { const arr = [...(pForm.qtyBreaks || [])]; arr[i] = { ...arr[i], price: e.target.value }; setPForm({...pForm, qtyBreaks: arr}); }} placeholder="549" className="w-28 px-3 py-2 border rounded-lg" />
                        <span className="text-sm text-slate-500">/ pair</span>
                        <button onClick={() => { const arr = (pForm.qtyBreaks || []).filter((_, j) => j !== i); setPForm({...pForm, qtyBreaks: arr}); }} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <button onClick={() => setPForm({...pForm, qtyBreaks: [...(pForm.qtyBreaks || []), { minQty: '', price: '' }]})} className="text-sm text-amber-600 hover:underline flex items-center gap-1"><Plus size={14} /> Add break</button>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stock by size &amp; colour</label>
                    <div className="text-xs text-slate-500 mb-2">Pairs available for each size/colour. Define Sizes and Colors above first; leave 0 for combinations you don't stock.</div>
                    {(pForm.sizes || []).filter(Boolean).length === 0 || (pForm.colors || []).filter(Boolean).length === 0 ? (
                      <div className="text-sm text-slate-400">Add sizes and colours above to build the stock grid.</div>
                    ) : (
                      <div className="overflow-auto">
                        <table className="text-sm border-collapse">
                          <thead><tr><th className="p-2 text-left text-slate-500 font-medium">Size \ Colour</th>{(pForm.colors || []).filter(Boolean).map(c => <th key={c} className="p-2 text-slate-500 font-medium">{c}</th>)}</tr></thead>
                          <tbody>
                            {(pForm.sizes || []).filter(Boolean).map(sz => (
                              <tr key={sz}>
                                <td className="p-2 font-medium text-slate-700">{sz}</td>
                                {(pForm.colors || []).filter(Boolean).map(c => {
                                  const key = `${sz}|${c}`;
                                  return <td key={c} className="p-1"><input type="number" min="0" value={(pForm.stockGrid && pForm.stockGrid[key] != null) ? pForm.stockGrid[key] : ''} onChange={e => { const g = { ...(pForm.stockGrid || {}) }; const v = e.target.value; if (v === '') delete g[key]; else g[key] = parseInt(v) || 0; setPForm({...pForm, stockGrid: g}); }} placeholder="0" className="w-16 px-2 py-1.5 border rounded-lg text-center" /></td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-6 border-t"><button onClick={saveProduct} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg flex items-center gap-2"><Save size={18} /> Save Product</button><button onClick={() => setTab('products')} className="border px-6 py-2 rounded-lg">Cancel</button></div>
            </div>
          </div>
        )}

        {tab === 'categories' && <CrudListEditor title="Categories" icon={Tag} items={categories} onSave={saveCategoriesWithCheck} itemLabel="Category" idPrefix="cat" fields={[{ key: 'id', label: 'ID (no spaces, lowercase)', required: true, hint: 'Used internally. Example: formal' }, { key: 'name', label: 'Category Name', required: true }, { key: 'icon', label: 'Icon (emoji)', required: true, placeholder: 'e.g., 👞' }]} renderItem={(item) => (<div className="flex items-center gap-3"><div className="text-3xl">{item.icon}</div><div><div className="font-semibold text-slate-900">{item.name}</div><div className="text-xs text-slate-500 font-mono">ID: {item.id} • {products.filter(p => p.category === item.id).length} products</div></div></div>)} />}

        {tab === 'inquiries' && (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Inquiries ({inquiries.length})</h1>
            <div className="space-y-4">
              {inquiries.map(i => (
                <div key={i.id} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                    <div>
                      {i.inqNo && <div className="text-xs font-mono font-bold text-amber-600 mb-0.5">{i.inqNo}</div>}
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">{i.name}{i.source === 'Proforma Download' && <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><FileText size={11} /> Proforma Lead</span>}{i.type === 'appointment' && <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={11} /> Appointment</span>}</h3>
                      {i.type === 'appointment' && (i.apptDate || i.apptTime) && <div className="text-sm text-purple-700 font-medium mt-1">📅 {i.apptDate}{i.apptTime ? ` at ${i.apptTime}` : ''}</div>}
                      <div className="text-sm text-slate-600">{i.shop || 'No shop'} • {i.city || 'No city'}</div>
                      <div className="text-sm text-slate-500 mt-1">📞 {i.phone} {i.whatsapp && i.whatsapp !== i.phone && `• 💬 ${i.whatsapp}`} {i.email && `• ✉️ ${i.email}`}</div>
                    </div>
                    <div className="text-right">
                      <select value={i.status} onChange={e => saveInquiries(inquiries.map(x => x.id === i.id ? { ...x, status: e.target.value } : x))} className="text-sm border rounded-lg px-3 py-1 mb-2">
                        <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
                      </select>
                      <div className="text-xs text-slate-500">{new Date(i.date).toLocaleString()}</div>
                    </div>
                  </div>
                  {i.message && <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded mb-3">{i.message}</p>}
                  {i.products && i.products.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-2">Products of Interest:</div>
                      <div className="space-y-1">{i.products.map((p, idx) => (<div key={idx} className="text-sm text-slate-600 flex justify-between bg-slate-50 px-3 py-2 rounded"><span>{p.code} - {p.name}{(p.selSize||p.selColor) ? ` — ${[p.selSize,p.selColor].filter(Boolean).join('/')}` : ''}</span><span className="font-medium">{p.quantity} pairs</span></div>))}</div>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <a href={`tel:${i.phone}`} className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">📞 Call</a>
                    {(i.whatsapp || i.phone) && <a href={`https://wa.me/${(i.whatsapp || i.phone + '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">💬 WhatsApp</a>}
                    {i.email && <a href={`mailto:${i.email}`} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded hover:bg-blue-100">✉️ Email</a>}
                    {i.products && i.products.length > 0 && <button onClick={() => setInvoiceFor(i)} className="text-sm bg-amber-50 text-amber-700 px-3 py-1 rounded hover:bg-amber-100 flex items-center gap-1"><FileText size={14} /> Generate GST Invoice</button>}
                    <button onClick={() => { if (confirm('Delete?')) saveInquiries(inquiries.filter(x => x.id !== i.id)); }} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded hover:bg-red-100 ml-auto">Delete</button>
                  </div>
                </div>
              ))}
              {inquiries.length === 0 && <div className="bg-white rounded-xl p-12 text-center text-slate-500"><Inbox size={48} className="mx-auto mb-3 opacity-50" />No inquiries yet</div>}
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Orders ({orders.length})</h1>
            {ordersError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">{ordersError}</div>}
            {ordersLoading && <div className="bg-white rounded-xl p-12 text-center text-slate-500">Loading orders…</div>}
            {!ordersLoading && !ordersError && orders.length === 0 && <div className="bg-white rounded-xl p-12 text-center text-slate-500"><ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />No orders yet</div>}
            <div className="space-y-4">
              {orders.map(row => { const o = row.data || {}; return (
                <div key={row.id} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                    <div>
                      <div className="font-mono font-bold text-amber-600">{o.orderNo}</div>
                      <h3 className="font-bold text-slate-900">{o.name}</h3>
                      <div className="text-sm text-slate-500 mt-0.5">📞 {o.phone}{o.whatsapp && o.whatsapp !== o.phone && ` • 💬 ${o.whatsapp}`}{o.email && ` • ✉️ ${o.email}`}</div>
                      <div className="text-sm text-slate-500">{[o.address, o.city, o.pincode].filter(Boolean).join(', ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900">₹{Number(o.total || 0).toLocaleString('en-IN')}</div>
                      <div className="text-xs font-semibold text-slate-600">{o.paymentLabel || o.payment}</div>
                      <div className="text-xs text-slate-400">{o.date ? new Date(o.date).toLocaleString('en-IN') : ''}</div>
                    </div>
                  </div>
                  <div className="space-y-1">{(o.items || []).map((it, idx) => <div key={idx} className="text-sm text-slate-600 flex justify-between bg-slate-50 px-3 py-2 rounded"><span>{it.code} - {it.name} ({it.size}/{it.color})</span><span className="font-medium">×{it.qty} · ₹{Number(it.lineTotal || 0).toLocaleString('en-IN')}</span></div>)}</div>
                  <div className="text-xs text-slate-500 mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Subtotal ₹{Number(o.subtotal || 0).toLocaleString('en-IN')}</span>
                    <span>GST ({o.gstRate}%) ₹{Number(o.gst || 0).toLocaleString('en-IN')}</span>
                    <span>Delivery {o.delivery ? `₹${Number(o.delivery).toLocaleString('en-IN')}` : 'Free'}</span>
                    {o.note && <span>Note: {o.note}</span>}
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap items-center">
                    <a href={`tel:${o.phone}`} className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">📞 Call</a>
                    {(o.whatsapp || o.phone) && <a href={`https://wa.me/${(o.whatsapp || o.phone + '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">💬 WhatsApp</a>}
                    <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">Status:
                      <select value={row.status || 'new'} onChange={e => updateOrderStatus(row.id, e.target.value)} className="border rounded-lg px-2 py-1 text-sm font-medium capitalize">
                        {ORDER_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              ); })}
            </div>
          </div>
        )}

        {tab === 'faqs' && <CrudListEditor title="FAQs" icon={HelpCircle} items={faqs} onSave={async (l) => { await saveFaqs(l); showToast('FAQs updated ✓'); }} itemLabel="FAQ" idPrefix="faq" fields={[{ key: 'q', label: 'Question', required: true }, { key: 'a', label: 'Answer', required: true, type: 'textarea' }]} renderItem={(item) => (<div><div className="font-semibold text-slate-900 mb-1">{item.q}</div><div className="text-sm text-slate-600 line-clamp-2">{item.a}</div></div>)} />}

        {tab === 'testimonials' && <CrudListEditor title="Testimonials" icon={MessageSquare} items={testimonials} onSave={async (l) => { await saveTestimonials(l); showToast('Testimonials updated ✓'); }} itemLabel="Testimonial" idPrefix="test" fields={[{ key: 'name', label: 'Customer Name', required: true }, { key: 'shop', label: 'Shop Name' }, { key: 'city', label: 'City' }, { key: 'content', label: 'Testimonial Content', required: true, type: 'textarea' }, { key: 'rating', label: 'Rating (1-5)', type: 'number', required: true, min: 1, max: 5, default: 5 }]} renderItem={(item) => (<div><div className="flex items-center gap-2 mb-1"><div className="font-semibold text-slate-900">{item.name}</div><div className="text-amber-400 text-sm">{'★'.repeat(item.rating || 5)}</div></div><div className="text-xs text-slate-500 mb-1">{item.shop}{item.shop && item.city && ' • '}{item.city}</div><div className="text-sm text-slate-600 line-clamp-2 italic">"{item.content}"</div></div>)} />}

        {tab === 'features' && <CrudListEditor title="Why Choose Us" icon={Sparkles} items={features} onSave={async (l) => { await saveFeatures(l); showToast('Features updated ✓'); }} itemLabel="Feature" idPrefix="feat" fields={[{ key: 'icon', label: 'Icon (emoji)', required: true }, { key: 'title', label: 'Title', required: true }, { key: 'desc', label: 'Description', required: true, type: 'textarea' }]} renderItem={(item) => (<div className="flex items-start gap-3"><div className="text-3xl">{item.icon}</div><div><div className="font-semibold text-slate-900">{item.title}</div><div className="text-sm text-slate-600 line-clamp-2">{item.desc}</div></div></div>)} />}

        {tab === 'steps' && <CrudListEditor title="How to Order Steps" icon={ListChecks} items={steps} onSave={async (l) => { await saveSteps(l); showToast('Steps updated ✓'); }} itemLabel="Step" idPrefix="step" fields={[{ key: 'title', label: 'Step Title', required: true }, { key: 'desc', label: 'Step Description', required: true, type: 'textarea' }]} renderItem={(item) => (<div className="flex items-start gap-3"><div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{steps.findIndex(s => s.id === item.id) + 1}</div><div><div className="font-semibold text-slate-900">{item.title}</div><div className="text-sm text-slate-600 line-clamp-2">{item.desc}</div></div></div>)} />}

        {tab === 'business' && (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Business Information</h1>
            <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Info size={18} /> Basic Info</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label><input value={editBiz.name || ''} onChange={e => setEditBiz({...editBiz, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Tagline</label><input value={editBiz.tagline || ''} onChange={e => setEditBiz({...editBiz, tagline: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Logo Text</label><input value={editBiz.logoText || ''} onChange={e => setEditBiz({...editBiz, logoText: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Logo Image URL (optional)</label><input value={editBiz.logoImage || ''} onChange={e => setEditBiz({...editBiz, logoImage: e.target.value})} placeholder="https://... (leave blank to use logo text)" className="w-full px-3 py-2 border rounded-lg" />{editBiz.logoImage && <img src={editBiz.logoImage} alt="logo preview" className="mt-2 w-16 h-16 rounded-lg object-cover border" />}<div className="text-xs text-slate-500 mt-1">If set, this image replaces the text logo in the header & footer.</div></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Sparkles size={18} /> Hero Section</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Hero Title</label><input value={editBiz.heroTitle || ''} onChange={e => setEditBiz({...editBiz, heroTitle: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Hero Subtitle</label><textarea value={editBiz.heroSubtitle || ''} onChange={e => setEditBiz({...editBiz, heroSubtitle: e.target.value})} rows="2" className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Hero Badge Text</label><input value={editBiz.heroBadge || ''} onChange={e => setEditBiz({...editBiz, heroBadge: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /><div className="text-xs text-slate-500 mt-1">Tip: type {'{years}'} anywhere and it auto-fills the calculated number (e.g. "{'{years}'} Years of Excellence").</div></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Phone size={18} /> Contact Info</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input value={editBiz.phone || ''} onChange={e => setEditBiz({...editBiz, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp (no +)</label><input value={editBiz.whatsapp || ''} onChange={e => setEditBiz({...editBiz, whatsapp: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input value={editBiz.email || ''} onChange={e => setEditBiz({...editBiz, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Business Hours</label><input value={editBiz.hours || ''} onChange={e => setEditBiz({...editBiz, hours: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Address</label><input value={editBiz.address || ''} onChange={e => setEditBiz({...editBiz, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><FileText size={18} /> GST & Invoice Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label><input value={editBiz.gstin || ''} onChange={e => setEditBiz({...editBiz, gstin: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="15-character GSTIN" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Legal Business Name</label><input value={editBiz.legalName || ''} onChange={e => setEditBiz({...editBiz, legalName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">HSN Code</label><input value={editBiz.hsnCode || ''} onChange={e => setEditBiz({...editBiz, hsnCode: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 6403" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">GST Rate (%)</label><input type="number" value={editBiz.gstRate || ''} onChange={e => setEditBiz({...editBiz, gstRate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 18" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Fee (₹)</label><input type="number" value={editBiz.deliveryFee || ''} onChange={e => setEditBiz({...editBiz, deliveryFee: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 60" /><div className="text-xs text-slate-500 mt-1">Flat delivery charge added at checkout.</div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Free Delivery Above (₹)</label><input type="number" value={editBiz.freeDeliveryAbove || ''} onChange={e => setEditBiz({...editBiz, freeDeliveryAbove: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 999" /><div className="text-xs text-slate-500 mt-1">Order subtotal at/above this = free delivery. 0 = always charge the fee.</div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">UPI ID (for online payment)</label><input value={editBiz.upiId || ''} onChange={e => setEditBiz({...editBiz, upiId: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., yourname@okhdfc" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">UPI Payee Name</label><input value={editBiz.upiName || ''} onChange={e => setEditBiz({...editBiz, upiName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Name shown in customer's UPI app" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Payment Note (shown to buyers)</label><input value={editBiz.paymentNote || ''} onChange={e => setEditBiz({...editBiz, paymentNote: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Payment via UPI / bank transfer on order confirmation. GST invoice provided." /><div className="text-xs text-slate-500 mt-1">A short line shown on the inquiry cart and contact page. You can include your UPI ID here if you like.</div></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Google Maps — Address or Coordinates</label><input value={editBiz.mapQuery || ''} onChange={e => setEditBiz({...editBiz, mapQuery: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 12 MG Road, Agra, UP 282001  (or  27.1767,78.0081)" /><div className="text-xs text-slate-500 mt-1">Shows a map on the contact page. For a precise pin, use the embed link field below instead.</div></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Google Maps Embed Link (optional, more precise)</label><input value={editBiz.mapEmbedUrl || ''} onChange={e => setEditBiz({...editBiz, mapEmbedUrl: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder='Paste the src link from Google Maps → Share → Embed a map' /><div className="text-xs text-slate-500 mt-1">In Google Maps: find your shop → Share → "Embed a map" → copy the link inside src="...". Overrides the address above.</div></div>
                  <div className="md:col-span-2 flex items-center gap-2"><input type="checkbox" id="apptToggle" checked={editBiz.appointmentsEnabled !== false} onChange={e => setEditBiz({...editBiz, appointmentsEnabled: e.target.checked})} /><label htmlFor="apptToggle" className="text-sm font-medium text-slate-700">Enable "Book an Appointment" on the contact page</label></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Appointment Note (shown to visitors)</label><input value={editBiz.appointmentNote || ''} onChange={e => setEditBiz({...editBiz, appointmentNote: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Visits Mon–Sat, 11am–7pm. We'll confirm your slot." /></div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Available Days</label>
                    <div className="flex flex-wrap gap-2">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => {
                        const days = Array.isArray(editBiz.apptDays) ? editBiz.apptDays : [1,2,3,4,5,6];
                        const on = days.includes(idx);
                        return <button key={idx} type="button" onClick={() => { const next = on ? days.filter(x => x !== idx) : [...days, idx].sort(); setEditBiz({...editBiz, apptDays: next}); }} className={`px-3 py-1.5 rounded-lg text-sm border ${on ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300'}`}>{d}</button>;
                      })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Visitors can only pick these weekdays.</div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Bookable up to (days ahead)</label><input type="number" value={editBiz.apptDaysAhead || ''} onChange={e => setEditBiz({...editBiz, apptDaysAhead: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 30" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Time Slots (comma separated)</label><input value={(Array.isArray(editBiz.apptSlots) ? editBiz.apptSlots : []).join(', ')} onChange={e => setEditBiz({...editBiz, apptSlots: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 11:00 AM, 12:00 PM, 1:00 PM, 4:00 PM" /><div className="text-xs text-slate-500 mt-1">These are the only times a visitor can choose.</div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Invoice Prefix</label><input value={editBiz.invoicePrefix || ''} onChange={e => setEditBiz({...editBiz, invoicePrefix: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., INV-" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label><input value={editBiz.bankName || ''} onChange={e => setEditBiz({...editBiz, bankName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label><input value={editBiz.accountNo || ''} onChange={e => setEditBiz({...editBiz, accountNo: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label><input value={editBiz.ifsc || ''} onChange={e => setEditBiz({...editBiz, ifsc: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><BarChart3 size={18} /> Stats</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Founded Year</label><input type="number" value={editBiz.foundedYear || ''} onChange={e => setEditBiz({...editBiz, foundedYear: parseInt(e.target.value) || 0})} placeholder="e.g., 2013" className="w-full px-3 py-2 border rounded-lg" /><div className="text-xs text-slate-500 mt-1">"Years in Business" auto-calculates from this.</div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Retailers</label><input value={editBiz.retailers || ''} onChange={e => setEditBiz({...editBiz, retailers: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Cities</label><input value={editBiz.cities || ''} onChange={e => setEditBiz({...editBiz, cities: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">SKUs</label><input value={editBiz.skus || ''} onChange={e => setEditBiz({...editBiz, skus: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Truck size={18} /> Order Terms</h3>
                <div className="grid md:grid-cols-1 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label><input value={editBiz.paymentTerms || ''} onChange={e => setEditBiz({...editBiz, paymentTerms: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Lead Time</label><input value={editBiz.leadTime || ''} onChange={e => setEditBiz({...editBiz, leadTime: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Shipping Coverage</label><input value={editBiz.shippingCoverage || ''} onChange={e => setEditBiz({...editBiz, shippingCoverage: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Facebook size={18} /> Social Media</h3>
                <div className="grid md:grid-cols-1 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Facebook URL</label><input value={editBiz.facebook || ''} onChange={e => setEditBiz({...editBiz, facebook: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Instagram URL</label><input value={editBiz.instagram || ''} onChange={e => setEditBiz({...editBiz, instagram: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label><input value={editBiz.linkedin || ''} onChange={e => setEditBiz({...editBiz, linkedin: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><FileText size={18} /> About & Mission</h3>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">About Us</label><textarea value={editBiz.about || ''} onChange={e => setEditBiz({...editBiz, about: e.target.value})} rows="4" className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Mission Statement</label><textarea value={editBiz.mission || ''} onChange={e => setEditBiz({...editBiz, mission: e.target.value})} rows="2" className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <button onClick={async () => { await saveBusiness(editBiz); showToast('Business info saved ✓'); }} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg flex items-center gap-2"><Save size={18} /> Save All Changes</button>
            </div>
          </div>
        )}
      </main>
      {invoiceFor && <GSTInvoiceGenerator inquiry={invoiceFor} business={business} onClose={() => setInvoiceFor(null)} />}
    </div>
  );
}

// ===== MAIN APP =====
export default function App() {
  const [page, setPage] = useState('home');
  const [history, setHistory] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inquiryList, setInquiryList] = useState([]);
  const [shopCart, setShopCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [cartTab, setCartTab] = useState('cart');
  const [buySel, setBuySel] = useState({ size: '', color: '', qty: 1 });
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [dark, setDark] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  const [customer, setCustomer] = useState(null); // { access_token, refresh_token, profile }
  const [showAccount, setShowAccount] = useState(false);
  const [accountTab, setAccountTab] = useState('profile');
  const [showIdleWarn, setShowIdleWarn] = useState(false);
  const [inquiryHistory, setInquiryHistory] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const persistCustomer = (session) => {
    try {
      if (session) localStorage.setItem('wsCustomerSession', JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
      else localStorage.removeItem('wsCustomerSession');
    } catch (e) {}
  };
  const applyCustomerSession = (data) => {
    if (!data || !data.access_token) return false;
    const c = { access_token: data.access_token, refresh_token: data.refresh_token, profile: customerProfile(data.user) };
    setCustomer(c);
    persistCustomer(c);
    const m = (data.user && data.user.user_metadata) || {};
    const accountCart = Array.isArray(m.cart) ? m.cart : [];
    const accountInquiry = Array.isArray(m.inquiry) ? m.inquiry : [];
    setShopCart(local => mergeCarts(local, accountCart));
    setInquiryList(local => mergeInquiry(local, accountInquiry));
    setInquiryHistory(Array.isArray(m.inquiryHistory) ? m.inquiryHistory : []);
    setOrderHistory(Array.isArray(m.orderHistory) ? m.orderHistory : []);
    return true;
  };
  // Record a submitted inquiry to the logged-in customer's private account history
  const recordInquiryHistory = (inq) => {
    if (!customer || !customer.access_token) return;
    const rec = { id: inq.id, inqNo: inq.inqNo || '', date: inq.date, message: (inq.message || '').trim(), shop: inq.shop || '', city: inq.city || '', products: (inq.products || []).map(p => ({ code: p.code, name: p.name, quantity: p.quantity, selSize: p.selSize || '', selColor: p.selColor || '' })) };
    setInquiryHistory(prev => {
      const next = [rec, ...(Array.isArray(prev) ? prev : [])].slice(0, 30);
      customerAuth.saveInquiryHistory(customer.access_token, next);
      return next;
    });
  };
  const recordOrderHistory = (order) => {
    if (!customer || !customer.access_token) return;
    const rec = { id: order.id, orderNo: order.orderNo, date: order.date, total: order.total, payment: order.paymentLabel, status: 'New', items: (order.items || []).map(it => ({ code: it.code, name: it.name, size: it.size, color: it.color, qty: it.qty })) };
    setOrderHistory(prev => { const next = [rec, ...(Array.isArray(prev) ? prev : [])].slice(0, 30); customerAuth.saveOrderHistory(customer.access_token, next); return next; });
  };
  const placeOrder = async (order) => {
    const token = customer && customer.access_token;
    const o = { ...order, userId: (customer && customer.profile && customer.profile.id) || '' };
    await saveOrderToSupabase(o, token);
    await pushOrderToSheets(o);
    await sendOrderEmail(o);
    recordOrderHistory(o);
    setShopCart([]);
    try { localStorage.removeItem('wsShopCart'); } catch (e) {}
    return true;
  };
  const logoutCustomer = async () => {
    setShowIdleWarn(false);
    try {
      if (customer && customer.access_token) {
        await Promise.allSettled([
          customerAuth.saveCart(customer.access_token, shopCart),
          customerAuth.saveInquiry(customer.access_token, slimInquiry(inquiryList)),
        ]);
      }
    } catch (e) {}
    try { localStorage.removeItem('wsShopCart'); localStorage.removeItem('wsCart'); localStorage.removeItem('wsCustomerSession'); localStorage.removeItem('wsContactForm'); } catch (e) {}
    window.location.reload();
  };
  const onCustomerProfileUpdated = (user) => { setCustomer(c => (c ? { ...c, profile: customerProfile(user) } : c)); };

  useEffect(() => {
    let stored;
    try { stored = JSON.parse(localStorage.getItem('wsCustomerSession') || 'null'); } catch (e) { stored = null; }
    if (stored && stored.refresh_token) {
      customerAuth.refresh(stored.refresh_token)
        .then(d => applyCustomerSession(d))
        .catch(() => { try { localStorage.removeItem('wsCustomerSession'); } catch (e) {} });
    }
  }, []);

  // After inactivity, show a "stay or log out" prompt instead of logging out silently. Paused while the prompt is open.
  useEffect(() => {
    if (!customer || showIdleWarn) return;
    const IDLE_MS = 20 * 60 * 1000; // 20 minutes
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { setShowIdleWarn(true); }, IDLE_MS); };
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [customer, showIdleWarn]);

  // While logged in, save cart + inquiry changes to the account (debounced) so they follow the customer across devices
  const cartSyncTimer = useRef(null);
  const cartSyncReady = useRef(false);
  useEffect(() => {
    if (!cartSyncReady.current) { cartSyncReady.current = true; return; }
    if (!customer || !customer.access_token) return;
    clearTimeout(cartSyncTimer.current);
    cartSyncTimer.current = setTimeout(() => { customerAuth.saveCart(customer.access_token, shopCart); }, 1500);
    return () => clearTimeout(cartSyncTimer.current);
  }, [shopCart, customer]);

  const inqSyncTimer = useRef(null);
  const inqSyncReady = useRef(false);
  useEffect(() => {
    if (!inqSyncReady.current) { inqSyncReady.current = true; return; }
    if (!customer || !customer.access_token) return;
    clearTimeout(inqSyncTimer.current);
    inqSyncTimer.current = setTimeout(() => { customerAuth.saveInquiry(customer.access_token, slimInquiry(inquiryList)); }, 1500);
    return () => clearTimeout(inqSyncTimer.current);
  }, [inquiryList, customer]);


  const [business, setBusiness] = useState(DEFAULT_BUSINESS);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [faqs, setFaqs] = useState(DEFAULT_FAQS);
  const [testimonials, setTestimonials] = useState(DEFAULT_TESTIMONIALS);
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [inquiries, setInquiries] = useState([]);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const adminTokenRef = useRef('');
  const [adminPwd, setAdminPwd] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Load from Supabase, fall back to defaults
  useEffect(() => {
    (async () => {
      // First test connection
      const test = await sb.testConnection();
      if (!test.ok) {
        setLoadError(test.msg);
        setProducts(getDefaultProducts());
        setLoading(false);
        return;
      }

      try {
        const [bizRows, prodRows, catRows, faqRows, testRows, featRows, stepRows, inqRows] = await Promise.all([
          sb.select('business_info').catch(e => { console.error('business_info:', e); return []; }),
          sb.select('products').catch(e => { console.error('products:', e); return []; }),
          sb.select('categories').catch(e => { console.error('categories:', e); return []; }),
          sb.select('faqs').catch(e => { console.error('faqs:', e); return []; }),
          sb.select('testimonials').catch(e => { console.error('testimonials:', e); return []; }),
          sb.select('features').catch(e => { console.error('features:', e); return []; }),
          sb.select('steps').catch(e => { console.error('steps:', e); return []; }),
          sb.select('inquiries').catch(e => { console.error('inquiries:', e); return []; }),
        ]);

        if (bizRows.length > 0) setBusiness({ ...DEFAULT_BUSINESS, ...bizRows[0].data });
        else { try { await sb.upsert('business_info', [{ id: 'main', data: DEFAULT_BUSINESS }]); } catch (e) { console.error(e); } }

        if (prodRows.length > 0) setProducts(prodRows.map(r => r.data));
        else {
          const defaults = getDefaultProducts();
          setProducts(defaults);
          try { await sb.upsert('products', defaults.map((p) => ({ id: p.id, data: p }))); } catch (e) { console.error(e); }
        }

        if (catRows.length > 0) setCategories(catRows.map(r => r.data));
        else { setCategories(DEFAULT_CATEGORIES); try { await sb.upsert('categories', DEFAULT_CATEGORIES.map((c, i) => ({ id: c.id, data: c, position: i }))); } catch (e) { console.error(e); } }

        if (faqRows.length > 0) setFaqs(faqRows.map(r => r.data));
        else { setFaqs(DEFAULT_FAQS); try { await sb.upsert('faqs', DEFAULT_FAQS.map((f, i) => ({ id: f.id, data: f, position: i }))); } catch (e) { console.error(e); } }

        if (testRows.length > 0) setTestimonials(testRows.map(r => r.data));
        else { setTestimonials(DEFAULT_TESTIMONIALS); try { await sb.upsert('testimonials', DEFAULT_TESTIMONIALS.map((t, i) => ({ id: t.id, data: t, position: i }))); } catch (e) { console.error(e); } }

        if (featRows.length > 0) setFeatures(featRows.map(r => r.data));
        else { setFeatures(DEFAULT_FEATURES); try { await sb.upsert('features', DEFAULT_FEATURES.map((f, i) => ({ id: f.id, data: f, position: i }))); } catch (e) { console.error(e); } }

        if (stepRows.length > 0) setSteps(stepRows.map(r => r.data));
        else { setSteps(DEFAULT_STEPS); try { await sb.upsert('steps', DEFAULT_STEPS.map((s, i) => ({ id: s.id, data: s, position: i }))); } catch (e) { console.error(e); } }

        setInquiries(inqRows.map(r => ({ ...r.data, status: r.status })));
      } catch (e) {
        console.error('Load error:', e);
        setLoadError(`Database error: ${e.message}`);
        setProducts(getDefaultProducts());
      }
      setLoading(false);
    })();
  }, []);

  const showToast = (msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const saveBusiness = async (data) => {
    setBusiness(data);
    try { await sb.upsert('business_info', [{ id: 'main', data }]); } catch (e) { console.error(e); }
  };

  const saveListTable = (tableName, setter) => async (list) => {
    setter(list);
    try {
      await sb.deleteAll(tableName);
      if (list.length > 0) await sb.upsert(tableName, list.map((item, i) => ({ id: item.id, data: item, position: i })));
    } catch (e) { console.error('Save error:', e); }
  };

  const saveProducts = saveListTable('products', setProducts);
  const saveCategories = saveListTable('categories', setCategories);
  const saveFaqs = saveListTable('faqs', setFaqs);
  const saveTestimonials = saveListTable('testimonials', setTestimonials);
  const saveFeatures = saveListTable('features', setFeatures);
  const saveSteps = saveListTable('steps', setSteps);

  const saveInquiry = async (inq) => {
    setInquiries(prev => [inq, ...prev]);
    try { 
      await sb.upsert('inquiries', [{ id: inq.id, data: inq, status: inq.status }]); 
      return true; 
    } catch (e) { 
      console.error('Save inquiry error:', e.message);
      alert(`Database error: ${e.message}\n\nCheck console (F12) for details. Inquiry saved locally only.`);
      return false; 
    }
  };

  const logProforma = async (lead) => {
    const inq = {
      id: `pf_${Date.now()}`,
      name: lead.name,
      shop: lead.shop || '',
      city: lead.city || '',
      phone: lead.phone || '',
      whatsapp: lead.phone || '',
      email: '',
      message: `Downloaded a proforma estimate (${lead.products.length} product${lead.products.length === 1 ? '' : 's'}).`,
      products: lead.products,
      date: new Date().toISOString(),
      status: 'new',
      type: 'proforma',
      source: 'Proforma Download',
    };
    await saveInquiry(inq);
    pushToGoogleSheets(inq);
    sendInquiryEmail(inq);
  };

  const saveInquiries = async (list) => {
    setInquiries(list);
    try {
      await sb.deleteAll('inquiries');
      if (list.length > 0) await sb.upsert('inquiries', list.map(i => ({ id: i.id, data: i, status: i.status })));
    } catch (e) { console.error(e); }
  };

  const yearsInBusiness = Math.max(0, new Date().getFullYear() - (parseInt(business.foundedYear) || 2013));

  const visibleProducts = products.filter(p => p.active !== false);

  const filtered = visibleProducts
    .filter(p => catFilter === 'all' || p.category === catFilter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => { if (sort === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0); if (sort === 'bestsellers') return (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0); return 0; });

  const addToInquiry = (p, size = '', color = '', qty = 1) => {
    if (inquiryList.find(x => x.id === p.id)) { showToast('Already in inquiry list'); return; }
    setInquiryList([...inquiryList, { ...p, quantity: Math.max(1, qty || 1), selSize: size || '', selColor: color || '' }]);
    showToast('Added to inquiry list ✓');
  };

  const navigate = (p) => {
    if (p === 'home') setHistory([]);
    else if (p !== page) setHistory(prev => [...prev, page]);
    setPage(p); setMenuOpen(false);
    if (p !== 'product') setSelectedProduct(null);
    window.scrollTo(0, 0);
  };

  const logout = () => {
    setAdminAuth(false);
    setAdminToken(''); adminTokenRef.current = '';
    setHistory([]);
    setSelectedProduct(null);
    setMenuOpen(false);
    setPage('home');
    try { sessionStorage.removeItem('wsAdminSession'); } catch (e) {}
    window.scrollTo(0, 0);
  };

  // On load: restore the cart, then the admin session (priority), else the last public page
  useEffect(() => {
    // Restore inquiry cart
    try {
      const cart = localStorage.getItem('wsCart');
      if (cart) { const c = JSON.parse(cart); if (Array.isArray(c)) setInquiryList(c); }
    } catch (e) {}

    // Admin session takes precedence (expires after 2 min inactivity)
    let adminRestored = false;
    try {
      const raw = sessionStorage.getItem('wsAdminSession');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.auth && (Date.now() - s.ts) < 120000) { setAdminAuth(true); setAdminToken(s.token || ''); adminTokenRef.current = s.token || ''; setPage('admin'); adminRestored = true; }
        else sessionStorage.removeItem('wsAdminSession');
      }
    } catch (e) {}

    // Otherwise return the visitor to the page they were on
    if (!adminRestored) {
      try {
        const nav = localStorage.getItem('wsNav');
        if (nav) {
          const n = JSON.parse(nav);
          if (n && n.page && n.page !== 'admin' && n.page !== 'home') {
            if (n.page === 'product' && n.product) { setSelectedProduct(n.product); setPage('product'); }
            else if (n.page !== 'product') setPage(n.page);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Persist the cart whenever it changes (skip the initial mount so it doesn't overwrite the restored cart)
  const cartHydrated = useRef(false);
  useEffect(() => {
    if (!cartHydrated.current) { cartHydrated.current = true; return; }
    try { localStorage.setItem('wsCart', JSON.stringify(inquiryList)); } catch (e) {}
  }, [inquiryList]);

  useEffect(() => {
    try { const raw = localStorage.getItem('wsShopCart'); if (raw) { const c = JSON.parse(raw); if (Array.isArray(c)) setShopCart(c); } } catch (e) {}
  }, []);
  const shopHydrated = useRef(false);
  useEffect(() => {
    if (!shopHydrated.current) { shopHydrated.current = true; return; }
    try { localStorage.setItem('wsShopCart', JSON.stringify(shopCart)); } catch (e) {}
  }, [shopCart]);

  const addToShopCart = (p, size, color, qty) => {
    const q = Math.max(1, parseInt(qty) || 1);
    setShopCart(prev => {
      const key = `${p.id}|${size}|${color}`;
      const existing = prev.find(it => it.key === key);
      if (existing) return prev.map(it => it.key === key ? { ...it, qty: it.qty + q } : it);
      return [...prev, { key, id: p.id, code: p.code, name: p.name, image: (productImages(p)[0] || ''), size, color, qty: q, retailPrice: p.retailPrice, qtyBreaks: p.qtyBreaks }];
    });
    setCartTab('cart');
    setShowCart(true);
  };
  const setShopQty = (key, q) => setShopCart(prev => prev.map(it => it.key === key ? { ...it, qty: Math.max(1, q) } : it));
  const removeShopItem = (key) => setShopCart(prev => prev.filter(it => it.key !== key));
  const openCart = () => { setCartTab(shopCart.length > 0 ? 'cart' : (inquiryList.length > 0 ? 'inquiry' : 'cart')); setShowCart(true); };

  // Persist the current public page so a refresh keeps the visitor in place
  const navHydrated = useRef(false);
  useEffect(() => {
    if (!navHydrated.current) { navHydrated.current = true; return; }
    try { if (page !== 'admin') localStorage.setItem('wsNav', JSON.stringify({ page, product: page === 'product' ? selectedProduct : null })); } catch (e) {}
  }, [page, selectedProduct]);

  // Auto-logout after 2 minutes of inactivity (only while logged in)
  useEffect(() => {
    if (!adminAuth) return;
    let timer;
    let lastWrite = 0;
    const reset = () => {
      clearTimeout(timer);
      const now = Date.now();
      if (now - lastWrite > 5000) {
        try { sessionStorage.setItem('wsAdminSession', JSON.stringify({ auth: true, ts: now, token: adminTokenRef.current })); } catch (e) {}
        lastWrite = now;
      }
      timer = setTimeout(() => { logout(); }, 120000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach(ev => window.removeEventListener(ev, reset)); };
  }, [adminAuth]);

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(prev2 => prev2.slice(0, -1));
    setPage(prev); setMenuOpen(false);
    if (prev !== 'product') setSelectedProduct(null);
    window.scrollTo(0, 0);
  };

  const viewProduct = (p) => {
    if (page !== 'product') setHistory(prev => [...prev, page]);
    setSelectedProduct(p); setPage('product'); setMenuOpen(false);
    setBuySel({ size: '', color: '', qty: 1 });
    window.scrollTo(0, 0);
  };

  const goToSection = (id) => {
    setMenuOpen(false);
    const doScroll = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    if (page !== 'home') { navigate('home'); setTimeout(doScroll, 350); }
    else { setTimeout(doScroll, 50); }
  };

  const tryAdminLogin = async () => {
    if (USE_SUPABASE_AUTH) {
      // Secure login: Supabase verifies the password on its server — it is NOT stored in this code.
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ADMIN_EMAIL, password: adminPwd }),
        });
        const data = await r.json();
        if (r.ok && data.access_token) {
          setAdminToken(data.access_token); adminTokenRef.current = data.access_token;
          setAdminAuth(true); setShowAdminLogin(false); setPage('admin'); setPwdError(''); setAdminPwd('');
        } else {
          setPwdError('Incorrect password');
        }
      } catch (e) {
        setPwdError('Login failed — check your connection and try again.');
      }
    } else {
      // ===== HARDCODED FALLBACK (active only when USE_SUPABASE_AUTH = false) =====
      if (adminPwd === ADMIN_PASSWORD_FALLBACK) {
        setAdminAuth(true); setShowAdminLogin(false); setPage('admin'); setPwdError(''); setAdminPwd('');
      } else {
        setPwdError('Incorrect password');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <style>{`@keyframes wsDot{0%,100%{transform:scale(.55);opacity:.35}50%{transform:scale(1);opacity:1}}`}</style>
        <div className="flex flex-col items-center">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 12px)', gap: 6 }}>
            {[0,1,2,3,4,5,6,7,8].map(i => (
              <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', animation: `wsDot 1.3s ease-in-out ${i * 0.1}s infinite` }}></span>
            ))}
          </div>
          <p className="mt-5 text-slate-500 font-medium tracking-wide">Loading…</p>
        </div>
      </div>
    );
  }

  if (page === 'admin' && adminAuth) {
    return (
      <>
        <AdminPanel business={business} saveBusiness={saveBusiness} products={products} saveProducts={saveProducts} categories={categories} saveCategories={saveCategories} faqs={faqs} saveFaqs={saveFaqs} testimonials={testimonials} saveTestimonials={saveTestimonials} features={features} saveFeatures={saveFeatures} steps={steps} saveSteps={saveSteps} inquiries={inquiries} saveInquiries={saveInquiries} adminToken={adminToken} navigate={navigate} showToast={showToast} setAdminAuth={setAdminAuth} logout={logout} />
        {toast && <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl z-50">{toast}</div>}
      </>
    );
  }

  return (
    <div className={`min-h-screen bg-white app-root pb-16 lg:pb-0${dark ? ' theme-dark' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Nunito:wght@600;700;800;900&display=swap');

        /* ---- Typography: friendly rounded headings, crisp body ---- */
        .app-root, .app-root input, .app-root textarea, .app-root select, .app-root button, .app-root a { font-family:'Inter', system-ui, sans-serif; }
        .app-root h1, .app-root h2, .app-root h3, .app-root h4 { font-family:'Nunito', system-ui, sans-serif; font-weight:800; letter-spacing:-0.01em; }

        /* ===== NAVY & GOLD PALETTE (light / base) ===== */
        /* gold accent */
        .app-root .bg-amber-500 { background-color:#C6A15B !important; }
        .app-root .bg-amber-600 { background-color:#A8843E !important; }
        .app-root .hover\\:bg-amber-600:hover { background-color:#A8843E !important; }
        .app-root .hover\\:bg-amber-500:hover { background-color:#C6A15B !important; }
        .app-root .text-amber-600, .app-root .text-amber-700 { color:#9A7833 !important; }
        .app-root .text-amber-500 { color:#C6A15B !important; }
        .app-root .text-amber-400 { color:#D8BE82 !important; }
        .app-root .hover\\:text-amber-600:hover, .app-root .hover\\:text-amber-400:hover { color:#A8843E !important; }
        .app-root .bg-amber-50 { background-color:#FAF5E9 !important; }
        .app-root .bg-amber-100 { background-color:#F1E6CB !important; }
        .app-root .border-amber-200 { border-color:#E6D6AC !important; }
        .app-root .border-amber-300 { border-color:#DCC78C !important; }
        .app-root .bg-amber-500\\/20 { background-color:rgba(198,161,91,0.18) !important; }
        .app-root .border-amber-500\\/30 { border-color:rgba(198,161,91,0.4) !important; }
        /* navy for the deep surfaces + headings */
        .app-root .bg-slate-900 { background-color:#102443 !important; }
        .app-root .hover\\:bg-slate-800:hover { background-color:#1a335c !important; }
        .app-root .text-slate-900 { color:#13294B !important; }
        /* gradients (direct background-image override for reliability) */
        .app-root .bg-gradient-to-br.from-slate-900 { background-image:linear-gradient(to bottom right,#102443,#0b1830,#102443) !important; }
        .app-root .bg-gradient-to-br.from-amber-500 { background-image:linear-gradient(to bottom right,#D2B069,#A8843E) !important; }
        .app-root .bg-gradient-to-br.from-amber-400 { background-image:linear-gradient(to bottom right,#E0C98C,#A8843E) !important; }
        .app-root .bg-gradient-to-r.from-amber-500 { background-image:linear-gradient(to right,#C6A15B,#A8843E) !important; }

        /* ===== DARK MODE (navy tones) — placed after base so it wins ties ===== */
        .theme-dark { background:#0a1a33; }
        .theme-dark .bg-white { background-color:#102443 !important; }
        .theme-dark .bg-slate-50 { background-color:#102443 !important; }
        .theme-dark .bg-slate-100 { background-color:#1c3a63 !important; }
        .theme-dark .bg-amber-50 { background-color:rgba(198,161,91,0.14) !important; }
        .theme-dark .bg-amber-100 { background-color:rgba(198,161,91,0.2) !important; }
        .theme-dark .bg-green-50 { background-color:rgba(34,197,94,0.14) !important; }
        .theme-dark .bg-blue-50 { background-color:rgba(59,130,246,0.14) !important; }
        .theme-dark .bg-red-50 { background-color:rgba(239,68,68,0.14) !important; }
        .theme-dark .text-slate-900 { color:#f1f5f9 !important; }
        .theme-dark .text-slate-800 { color:#e2e8f0 !important; }
        .theme-dark .text-slate-700 { color:#cbd5e1 !important; }
        .theme-dark .text-slate-600 { color:#9fb0c9 !important; }
        .theme-dark .text-slate-500 { color:#8195b0 !important; }
        .theme-dark .border, .theme-dark .border-b, .theme-dark .border-t, .theme-dark .border-gray-100, .theme-dark .border-slate-200, .theme-dark .border-slate-300 { border-color:#24406b !important; }
        .theme-dark input, .theme-dark textarea, .theme-dark select { background-color:#0a1a33 !important; color:#f1f5f9 !important; border-color:#24406b !important; }
        .theme-dark input::placeholder, .theme-dark textarea::placeholder { color:#6b7f9c !important; }
        .theme-dark .shadow-sm, .theme-dark .shadow-xl, .theme-dark .shadow-2xl, .theme-dark .shadow-md { box-shadow:0 2px 8px rgba(0,0,0,0.55) !important; }
      `}</style>
      {loadError && <div className="bg-amber-100 border-b border-amber-300 text-amber-800 text-xs px-4 py-2 text-center">⚠️ {loadError}</div>}
      <div className="bg-slate-900 text-white text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1"><Phone size={12} /> {business.phone}</span>
            <span className="hidden md:flex items-center gap-1"><Mail size={12} /> {business.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-amber-400">Trusted by {business.retailers} Retailers</span>
            <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400"><Facebook size={14} /></a>
            <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400"><Instagram size={14} /></a>
            <a href={business.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400"><Linkedin size={14} /></a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {history.length > 0 && <button onClick={goBack} className="px-2 sm:px-3 py-2 hover:bg-amber-50 rounded-lg flex items-center gap-1 text-slate-700 hover:text-amber-600" title="Go back"><ChevronRight className="rotate-180" size={18} /><span className="text-sm font-medium hidden sm:inline">Back</span></button>}
            <div onClick={() => navigate('home')} className="cursor-pointer flex items-center gap-3">
              {business.logoImage ? <img src={business.logoImage} alt={business.name} className="w-12 h-12 rounded-lg object-cover shadow-md" /> : <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md">{business.logoText}</div>}
              <div><div className="text-lg font-bold text-slate-900 leading-tight">{business.name}</div><div className="text-xs text-slate-500 hidden sm:block">{business.tagline}</div></div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-6">
            <button onClick={() => navigate('home')} className={`text-sm font-medium transition-colors ${page === 'home' ? 'text-amber-600' : 'text-slate-700 hover:text-amber-600'}`}>Home</button>

            <div className="relative group">
              <button className={`text-sm font-medium transition-colors flex items-center gap-1 ${page === 'catalog' || page === 'product' ? 'text-amber-600' : 'text-slate-700 hover:text-amber-600'}`}>Shop <ChevronDown size={14} /></button>
              <div className="absolute left-0 top-full pt-3 hidden group-hover:block z-50">
                <div className="bg-white border border-slate-100 rounded-xl shadow-xl py-2 w-56">
                  <button onClick={() => { setCatFilter('all'); navigate('catalog'); }} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><Grid size={16} /> All products</button>
                  <div className="border-t border-slate-100 my-1"></div>
                  {categories.map(c => <button key={c.id} onClick={() => { setCatFilter(c.id); navigate('catalog'); }} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><span className="text-base leading-none">{c.icon}</span> {c.name}</button>)}
                  <div className="border-t border-slate-100 my-1"></div>
                  <button onClick={() => goToSection('sec-featured')} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><Star size={16} /> Featured products</button>
                </div>
              </div>
            </div>

            <div className="relative group">
              <button className={`text-sm font-medium transition-colors flex items-center gap-1 ${page === 'about' || page === 'faq' ? 'text-amber-600' : 'text-slate-700 hover:text-amber-600'}`}>Company <ChevronDown size={14} /></button>
              <div className="absolute left-0 top-full pt-3 hidden group-hover:block z-50">
                <div className="bg-white border border-slate-100 rounded-xl shadow-xl py-2 w-56">
                  <button onClick={() => navigate('about')} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><Info size={16} /> About us</button>
                  <button onClick={() => goToSection('sec-why')} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><CheckCircle size={16} /> Why choose us</button>
                  <button onClick={() => goToSection('sec-reviews')} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><MessageSquare size={16} /> What retailers say</button>
                  <button onClick={() => navigate('faq')} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><HelpCircle size={16} /> FAQ</button>
                </div>
              </div>
            </div>

            <button onClick={() => navigate('contact')} className={`text-sm font-medium transition-colors ${page === 'contact' ? 'text-amber-600' : 'text-slate-700 hover:text-amber-600'}`}>Contact</button>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(d => !d)} className="p-2 hover:bg-amber-50 rounded-lg text-slate-700" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle dark mode">{dark ? <Sun size={22} /> : <Moon size={22} />}</button>
            <button onClick={() => { setAccountTab('profile'); setShowAccount(true); }} className="p-2 hover:bg-amber-50 rounded-lg text-slate-700 flex items-center gap-1.5 text-sm font-medium" title={customer ? 'My Account' : 'Login'}><Users size={20} />{customer && <span className="hidden sm:inline max-w-[90px] truncate">{customer.profile.name || 'Account'}</span>}</button>
            <button onClick={openCart} className="relative p-2 hover:bg-amber-50 rounded-lg" title="Cart & Inquiry"><ShoppingBag size={22} className="text-slate-700" />{(shopCart.reduce((a, it) => a + it.qty, 0) + inquiryList.length) > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{shopCart.reduce((a, it) => a + it.qty, 0) + inquiryList.length}</span>}</button>
            <button onClick={() => navigate('contact')} className="hidden md:block bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-semibold">Get Quote</button>
            <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={24} /> : <Menu size={24} />}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setMenuOpen(false)}>
            <div className="bg-white w-72 max-w-[85%] h-full overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center"><span className="font-bold text-slate-900">Menu</span><button onClick={() => setMenuOpen(false)} aria-label="Close"><X size={22} /></button></div>
              <div className="p-2">
                {NAV_ITEMS.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${page === item.id ? 'bg-amber-50 text-amber-600' : 'text-slate-700 hover:bg-slate-50'}`}><item.icon size={18} /> {item.label}</button>)}

                <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Browse</div>
                <button onClick={() => navigate('catalog')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Grid size={18} /> Shop by category</button>
                <button onClick={() => goToSection('sec-featured')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Star size={18} /> Featured products</button>

                <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Company</div>
                <button onClick={() => goToSection('sec-why')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><CheckCircle size={18} /> Why choose us</button>
                <button onClick={() => goToSection('sec-reviews')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><MessageSquare size={18} /> What retailers say</button>

                <div className="border-t border-slate-100 my-2"></div>
                {customer ? (
                  <>
                    <div className="px-3 pt-1 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">My account</div>
                    <button onClick={() => { setAccountTab('profile'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Users size={18} /> Account info</button>
                    <button onClick={() => { setAccountTab('inquiries'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><ListChecks size={18} /> My inquiries</button>
                    <button onClick={() => { setAccountTab('orders'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><ShoppingBag size={18} /> My orders</button>
                    <button onClick={() => { setMenuOpen(false); logoutCustomer(); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"><LogOut size={18} /> Log out</button>
                  </>
                ) : (
                  <button onClick={() => { setAccountTab('profile'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Users size={18} /> Login / Register</button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {page === 'home' && (
          <>
            <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 75% 75%, #f59e0b 0%, transparent 50%)' }}></div>
              <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-block px-4 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-6">⭐ {(business.heroBadge || '{years} Years of Excellence').replace('{years}', yearsInBusiness)}</div>
                  <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">{business.heroTitle}</h1>
                  <p className="text-lg text-slate-300 mb-8">{business.heroSubtitle}</p>
                  <div className="flex flex-wrap gap-4">
                    <button onClick={() => navigate('catalog')} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2">Browse Catalog <ArrowRight size={18} /></button>
                    <button onClick={() => navigate('contact')} className="border-2 border-white/30 hover:bg-white/10 px-8 py-3 rounded-lg font-semibold">Request Quote</button>
                  </div>
                </div>
                <div className="relative hidden md:block">
                  <div className="aspect-square bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl shadow-2xl overflow-hidden"><SafeImage src={IMG_URLS[0]} alt="Premium shoes" className="w-full h-full object-cover mix-blend-overlay opacity-90" /></div>
                  <div className="absolute -bottom-6 -left-6 bg-white text-slate-900 p-6 rounded-xl shadow-2xl"><div className="text-3xl font-bold text-amber-600">{business.skus}</div><div className="text-sm text-slate-600">Active SKUs</div></div>
                </div>
              </div>
            </section>

            <section className="bg-amber-500 text-white py-3">
              <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center items-center gap-x-8 gap-y-2 text-sm font-medium">
                <span className="flex items-center gap-1.5"><CheckCircle size={16} /> GST Registered</span>
                <span className="flex items-center gap-1.5"><Truck size={16} /> {business.shippingCoverage} Delivery</span>
                <span className="flex items-center gap-1.5"><Award size={16} /> Quality Assured</span>
              </div>
            </section>

            <section className="bg-white py-12 border-b">
              <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
                {[{ icon: Award, value: yearsInBusiness, label: 'Years in Business' }, { icon: Users, value: business.retailers, label: 'Retailers Served' }, { icon: MapPin, value: business.cities, label: 'Cities Covered' }, { icon: Package, value: business.skus, label: 'Products in Stock' }].map((s, i) => (
                  <div key={i} className="text-center"><s.icon className="text-amber-500 mx-auto mb-3" size={32} /><div className="text-3xl md:text-4xl font-bold text-slate-900">{s.value}</div><div className="text-sm text-slate-600 mt-1">{s.label}</div></div>
                ))}
              </div>
            </section>

            {categories.length > 0 && (
              <section className="py-16 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Shop by Category</h2></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {categories.map(c => <button key={c.id} onClick={() => { setCatFilter(c.id); navigate('catalog'); }} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg border transition-all hover:-translate-y-1 group"><div className="text-4xl mb-3">{c.icon}</div><div className="font-semibold text-slate-900 group-hover:text-amber-600">{c.name}</div><div className="text-xs text-slate-500 mt-1">{visibleProducts.filter(p => p.category === c.id).length} products</div></button>)}
                  </div>
                </div>
              </section>
            )}

            {visibleProducts.filter(p => p.isNew).length > 0 && (
              <section id="sec-featured" className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex justify-between items-end mb-8"><div><span className="text-amber-600 font-semibold text-sm uppercase">Just In</span><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">New Arrivals</h2></div><button onClick={() => navigate('catalog')} className="text-amber-600 font-medium flex items-center gap-1 hover:underline">View All <ChevronRight size={18} /></button></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{visibleProducts.filter(p => p.isNew).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
                </div>
              </section>
            )}

            {visibleProducts.filter(p => p.isBestseller).length > 0 && (
              <section className="py-16 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex justify-between items-end mb-8"><div><span className="text-amber-600 font-semibold text-sm uppercase">Customer Favorites</span><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">Bestsellers</h2></div><button onClick={() => navigate('catalog')} className="text-amber-600 font-medium flex items-center gap-1 hover:underline">View All <ChevronRight size={18} /></button></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{visibleProducts.filter(p => p.isBestseller).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
                </div>
              </section>
            )}

            {features.length > 0 && (
              <section id="sec-why" className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Why Choose Us</h2></div>
                  <div className={`grid gap-6 ${features.length >= 4 ? 'md:grid-cols-4' : features.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    {features.map((f) => <div key={f.id} className="text-center p-6 rounded-xl hover:bg-slate-50 transition-colors"><div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">{f.icon}</div><h3 className="font-bold text-slate-900 mb-2">{f.title}</h3><p className="text-sm text-slate-600">{f.desc}</p></div>)}
                  </div>
                </div>
              </section>
            )}

            {testimonials.length > 0 && (
              <section id="sec-reviews" className="py-16 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">What Retailers Say</h2></div>
                  <div className={`grid gap-6 ${testimonials.length >= 3 ? 'md:grid-cols-3' : testimonials.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-2xl mx-auto'}`}>
                    {testimonials.slice(0, 6).map(t => (
                      <div key={t.id} className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex text-amber-400 mb-3">{[1,2,3,4,5].map(s => <Star key={s} size={18} fill={s <= (t.rating || 5) ? 'currentColor' : 'none'} className={s <= (t.rating || 5) ? '' : 'text-slate-300'} />)}</div>
                        <p className="text-slate-700 mb-4 italic">"{t.content}"</p>
                        <div className="border-t pt-3"><div className="font-semibold text-slate-900">{t.name}</div><div className="text-sm text-slate-500">{t.shop}{t.shop && t.city && ', '}{t.city}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section className="py-16 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
              <div className="max-w-4xl mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Stock Up?</h2>
                <p className="text-lg mb-8 opacity-90">Get our latest catalog and competitive pricing</p>
                <div className="flex flex-wrap gap-4 justify-center"><button onClick={() => navigate('catalog')} className="bg-white text-amber-600 hover:bg-slate-50 px-8 py-3 rounded-lg font-semibold">Browse Catalog</button><button onClick={() => navigate('contact')} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-semibold">Request Quote</button></div>
              </div>
            </section>
          </>
        )}

        {page === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="mb-8"><h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Product Catalog</h1><p className="text-slate-600">Browse our complete range of men's footwear</p></div>
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 sticky top-20 z-30 border">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code..." className="w-full pl-10 pr-4 py-2 border rounded-lg" /></div>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="all">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>
                <select value={sort} onChange={e => setSort(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="newest">Newest</option><option value="bestsellers">Bestsellers</option></select>
              </div>
            </div>
            <div className="text-sm text-slate-600 mb-4">Showing {filtered.length} of {visibleProducts.length} products</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{filtered.map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
            {filtered.length === 0 && <div className="text-center py-16 text-slate-500"><Package size={48} className="mx-auto mb-3 opacity-50" />No products match your search<div className="mt-2"><button onClick={() => { setSearch(''); setCatFilter('all'); }} className="text-amber-600 hover:underline">Clear filters</button></div></div>}
          </div>
        )}

        {page === 'product' && selectedProduct && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <button onClick={() => navigate('catalog')} className="text-slate-600 hover:text-amber-600 mb-6 flex items-center gap-1"><ChevronRight className="rotate-180" size={18} /> Back to Catalog</button>
            <div className="grid md:grid-cols-2 gap-12">
              <ProductGallery key={selectedProduct.id} images={productImages(selectedProduct)} alt={selectedProduct.name} />
              <div>
                <div className="flex gap-2 mb-3">{selectedProduct.isNew && <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-semibold">NEW</span>}{selectedProduct.isBestseller && <span className="bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-semibold">★ BESTSELLER</span>}{selectedProduct.outOfStock && <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold">OUT OF STOCK</span>}</div>
                <div className="text-sm text-slate-500 font-mono mb-2">{selectedProduct.code}</div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{selectedProduct.name}</h1>
                <div className="text-amber-600 font-medium mb-4">{categories.find(c => c.id === selectedProduct.category)?.name}</div>
                <p className="text-slate-700 mb-6">{selectedProduct.description}</p>
                <div className="border-t border-b py-4 mb-6 grid grid-cols-2 gap-4">
                  <div><div className="text-xs text-slate-500 mb-1">Material</div><div className="font-medium">{selectedProduct.material}</div></div>
                  <div><div className="text-xs text-slate-500 mb-1">Category</div><div className="font-medium">{categories.find(c => c.id === selectedProduct.category)?.name}</div></div>
                </div>
                {selectedProduct.availabilityNote && <div className="text-sm text-slate-700 mb-6 flex items-start gap-2 bg-slate-50 rounded-lg p-3"><Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" /><span>{selectedProduct.availabilityNote}</span></div>}
                {(() => {
                  const p = selectedProduct;
                  const base = parseFloat(p.retailPrice) || 0;
                  const brks = sortedBreaks(p);
                  const sel = buySel;
                  const sizeStock = (s) => (p.colors || []).reduce((a, c) => a + stockFor(p, s, c), 0);
                  const colorStock = (c) => sel.size ? stockFor(p, sel.size, c) : (p.sizes || []).reduce((a, s) => a + stockFor(p, s, c), 0);
                  const comboStock = (sel.size && sel.color) ? stockFor(p, sel.size, sel.color) : 0;
                  const unit = retailUnitPrice(p, sel.qty || 1);
                  const canBuy = !p.outOfStock && sel.size && sel.color && comboStock > 0;
                  return (
                    <div className="mb-6">
                      {base > 0 && (
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-slate-900">₹{(canBuy ? unit : base).toLocaleString('en-IN')}</span><span className="text-slate-500 text-sm">/ pair</span>{canBuy && unit < base && <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">bulk price applied</span>}</div>
                          {brks.length > 0 && <div className="text-sm text-amber-700 bg-amber-50 inline-block px-3 py-1 rounded-lg mt-2">{brks.map(b => `Buy ${b.minQty}+ at ₹${b.price.toLocaleString('en-IN')}`).join('  ·  ')} — applied automatically</div>}
                        </div>
                      )}
                      {!p.outOfStock && base > 0 && (
                        <>
                          <div className="mb-3">
                            <div className="text-xs text-slate-500 mb-1">Size</div>
                            <div className="flex gap-2 flex-wrap">{(p.sizes || []).filter(Boolean).map(s => { const st = sizeStock(s); const active = sel.size === s; return <button key={s} disabled={st === 0} onClick={() => setBuySel({ ...sel, size: s, qty: 1 })} className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${active ? 'bg-slate-900 text-white border-slate-900' : st === 0 ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed line-through' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-500'}`}>{s}</button>; })}</div>
                          </div>
                          <div className="mb-3">
                            <div className="text-xs text-slate-500 mb-1">Colour</div>
                            <div className="flex gap-2 flex-wrap">{(p.colors || []).filter(Boolean).map(c => { const st = colorStock(c); const active = sel.color === c; return <button key={c} disabled={st === 0} onClick={() => setBuySel({ ...sel, color: c, qty: 1 })} className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${active ? 'bg-slate-900 text-white border-slate-900' : st === 0 ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed line-through' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-500'}`}>{c}</button>; })}</div>
                          </div>
                          <div className="text-sm mb-3 min-h-[20px]">{(sel.size && sel.color) ? (comboStock > 0 ? <span className="text-green-600 font-medium">{comboStock <= 4 ? `Only ${comboStock} left` : 'In stock'}</span> : <span className="text-red-500 font-medium">Out of stock in this size/colour</span>) : <span className="text-slate-400">Select size and colour</span>}</div>
                          {canBuy && (
                            <div className="flex items-center gap-3 mb-4">
                              <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden"><button onClick={() => setBuySel({ ...sel, qty: Math.max(1, (sel.qty || 1) - 1) })} className="px-3 py-2 hover:bg-slate-100">−</button><span className="px-4 font-semibold">{sel.qty || 1}</span><button onClick={() => setBuySel({ ...sel, qty: Math.min(comboStock, (sel.qty || 1) + 1) })} disabled={(sel.qty || 1) >= comboStock} className="px-3 py-2 hover:bg-slate-100 disabled:text-slate-300">+</button></div>
                              <div className="text-sm text-slate-600">Total: <span className="font-bold text-slate-900">₹{(unit * (sel.qty || 1)).toLocaleString('en-IN')}</span></div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex flex-wrap gap-3">
                        {p.outOfStock || base <= 0
                          ? null
                          : <button disabled={!canBuy} onClick={() => addToShopCart(p, sel.size, sel.color, sel.qty || 1)} className={`flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${canBuy ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}><ShoppingBag size={18} /> Add to Cart</button>}
                        {p.outOfStock
                          ? <button disabled className="flex-1 bg-slate-200 text-slate-500 py-3 rounded-lg font-semibold cursor-not-allowed">Out of Stock</button>
                          : <button onClick={() => { const hasOpts = ((p.sizes || []).filter(Boolean).length > 0 || (p.colors || []).filter(Boolean).length > 0); if (base > 0 && hasOpts && (!sel.size || !sel.color)) { showToast('Please select size and colour first'); return; } addToInquiry(p, sel.size, sel.color, (sel.size && sel.color) ? (sel.qty || 1) : 1); }} className="flex-1 bg-slate-900 hover:bg-slate-700 text-white py-3 rounded-lg font-semibold transition-colors">Add to Inquiry</button>}
                        <a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hi, I'm interested in ${p.code} - ${p.name}`)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold text-center flex items-center justify-center gap-2"><WhatsAppIcon size={18} /> WhatsApp</a>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Products</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{visibleProducts.filter(p => p.category === selectedProduct.category && p.id !== selectedProduct.id).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
            </div>
          </div>
        )}

        {page === 'about' && (
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">About Us</h1>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Story</h2>
            <p className="text-slate-700 leading-relaxed mb-8">{business.about}</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h2>
            <p className="text-slate-700 leading-relaxed mb-8">{business.mission}</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Visit Our Facility</h2>
            <p className="text-slate-700 leading-relaxed">📍 {business.address}</p>
            <p className="text-slate-700 leading-relaxed">⏰ {business.hours}</p>
          </div>
        )}

        {page === 'faq' && <div className="max-w-3xl mx-auto px-4 py-12"><h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">FAQ</h1><p className="text-slate-600 mb-12">Common questions from our retailers</p><div className="space-y-3">{faqs.map(f => <FAQItem key={f.id} q={f.q} a={f.a} />)}{faqs.length === 0 && <div className="text-center text-slate-500 py-12">No FAQs yet</div>}</div></div>}

        {page === 'contact' && <ContactPage business={business} inquiryList={inquiryList} setInquiryList={setInquiryList} saveInquiry={saveInquiry} navigate={navigate} showToast={showToast} customer={customer} onInquirySubmitted={recordInquiryHistory} />}
      </main>

      <footer className="bg-slate-900 text-white pt-12 pb-40 mt-16">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">{business.logoImage ? <img src={business.logoImage} alt={business.name} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center text-white font-bold">{business.logoText}</div>}<div className="font-bold">{business.name}</div></div>
            <p className="text-sm text-slate-400 mb-4">{business.tagline}</p>
            <div className="flex gap-3"><a href={business.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-slate-800 hover:bg-amber-500 rounded-full flex items-center justify-center transition-colors"><Facebook size={16} /></a><a href={business.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-slate-800 hover:bg-amber-500 rounded-full flex items-center justify-center transition-colors"><Instagram size={16} /></a><a href={business.linkedin} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-slate-800 hover:bg-amber-500 rounded-full flex items-center justify-center transition-colors"><Linkedin size={16} /></a></div>
          </div>
          <div><h4 className="font-bold mb-3">Quick Links</h4><ul className="space-y-2 text-sm text-slate-400">{NAV_ITEMS.map(i => <li key={i.id}><button onClick={() => navigate(i.id)} className="hover:text-amber-400">{i.label}</button></li>)}</ul></div>
          <div><h4 className="font-bold mb-3">Categories</h4><ul className="space-y-2 text-sm text-slate-400">{categories.map(c => <li key={c.id}><button onClick={() => { setCatFilter(c.id); navigate('catalog'); }} className="hover:text-amber-400">{c.name}</button></li>)}</ul></div>
          <div><h4 className="font-bold mb-3">Contact</h4><ul className="space-y-2 text-sm text-slate-400"><li className="flex gap-2"><Phone size={14} className="mt-0.5 flex-shrink-0" />{business.phone}</li><li className="flex gap-2"><Mail size={14} className="mt-0.5 flex-shrink-0" />{business.email}</li><li className="flex gap-2"><MapPin size={14} className="mt-0.5 flex-shrink-0" />{business.address}</li><li className="flex gap-2"><Clock size={14} className="mt-0.5 flex-shrink-0" />{business.hours}</li></ul></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t border-slate-800 flex flex-col items-center gap-2 text-sm text-slate-400">
          <div>© {new Date().getFullYear()} {business.name}. All rights reserved.</div>
          {adminAuth ? <button onClick={() => setPage('admin')} className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1"><Lock size={11} /> Admin Panel</button> : <button onClick={() => setShowAdminLogin(true)} className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1"><Lock size={11} /> Admin Login</button>}
        </div>
      </footer>

      {/* Back to top button - classic navy/gold, bottom center */}
      {page !== 'admin' && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex justify-around items-stretch" aria-label="Primary">
          {(() => {
            const cartCount = shopCart.reduce((a, it) => a + it.qty, 0) + inquiryList.length;
            const items = [
              { id: 'home', Icon: Home, label: 'Home', on: page === 'home', act: () => navigate('home') },
              { id: 'shop', Icon: Grid, label: 'Shop', on: page === 'catalog' || page === 'product', act: () => navigate('catalog') },
              { id: 'cart', Icon: ShoppingBag, label: 'Cart', on: false, act: openCart, badge: cartCount },
              { id: 'account', Icon: Users, label: 'Account', on: showAccount, act: () => { setAccountTab('profile'); setShowAccount(true); } },
            ];
            return items.map(t => (
              <button key={t.id} onClick={t.act} className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${t.on ? 'text-amber-600' : 'text-slate-500'}`}>
                <t.Icon size={21} />
                {t.badge > 0 && <span className="absolute top-1 left-1/2 ml-2 bg-amber-500 text-white text-[9px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-bold">{t.badge}</span>}
                {t.label}
              </button>
            ));
          })()}
        </nav>
      )}

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        style={{ borderColor: '#C6A15B', color: '#C6A15B' }}
        className={`fixed bottom-[88px] lg:bottom-6 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-slate-900 border-2 flex flex-col items-center justify-center shadow-2xl transition-all duration-300 hover:bg-slate-800 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <ChevronUp size={18} />
        <span className="font-serif" style={{ fontSize: '10px', letterSpacing: '1.5px', lineHeight: 1 }}>TOP</span>
      </button>

      {/* Enhanced WhatsApp button - more prominent, with tooltip */}
      <div className="fixed bottom-[88px] lg:bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Call button */}
        <a 
          href={`tel:${business.phone}`}
          className="group flex items-center"
        >
          <div className="hidden md:block bg-slate-900 text-white text-sm px-3 py-2 rounded-l-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
            Call us now
          </div>
          <div className="w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110">
            <Phone size={24} />
          </div>
        </a>
        
        {/* WhatsApp button - primary */}
        <a 
          href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent("Hi, I'd like to know more about your products.")}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="group flex items-center"
        >
          <div className="hidden md:block bg-slate-900 text-white text-sm px-3 py-2 rounded-l-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Chat on WhatsApp
          </div>
          <div className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110 relative">
            <WhatsAppIcon size={32} />
          </div>
        </a>
      </div>

      {/* AI Chatbot removed - WhatsApp + Call buttons are more effective for Indian B2B */}

      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full max-w-md h-full overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b z-10">
              <div className="flex justify-between items-center p-4 pb-2"><h2 className="font-bold text-lg">Your Bag</h2><button onClick={() => setShowCart(false)}><X size={24} /></button></div>
              <div className="flex px-4">
                <button onClick={() => setCartTab('cart')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${cartTab === 'cart' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Cart ({shopCart.reduce((a, it) => a + it.qty, 0)})</button>
                <button onClick={() => setCartTab('inquiry')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${cartTab === 'inquiry' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Inquiry ({inquiryList.length})</button>
              </div>
            </div>
            <div className="p-4">
              {cartTab === 'cart' ? (
                shopCart.length === 0 ? <div className="text-center py-12 text-slate-500"><ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />Your cart is empty<button onClick={() => { setShowCart(false); navigate('catalog'); }} className="block mx-auto mt-4 text-amber-600 font-medium hover:underline">Browse Catalog →</button></div> : (
                  <>
                    {shopCart.map(it => {
                      const unit = retailUnitPrice(it, it.qty);
                      return (
                        <div key={it.key} className="flex gap-3 py-3 border-b">
                          <SafeImage src={it.image} alt={it.name} className="w-16 h-16 rounded object-cover" />
                          <div className="flex-1">
                            <div className="text-xs font-mono text-slate-500">{it.code}</div>
                            <div className="font-medium text-sm">{it.name}</div>
                            <div className="text-xs text-slate-600 mt-0.5">Size {it.size} · {it.color}</div>
                            <div className="flex items-center gap-2 mt-2">
                              <button onClick={() => setShopQty(it.key, it.qty - 1)} className="w-7 h-7 border rounded hover:bg-slate-50"><Minus size={12} className="mx-auto" /></button>
                              <span className="w-10 text-center text-sm font-semibold">{it.qty}</span>
                              <button onClick={() => setShopQty(it.key, it.qty + 1)} className="w-7 h-7 border rounded hover:bg-slate-50"><Plus size={12} className="mx-auto" /></button>
                              <button onClick={() => removeShopItem(it.key)} className="ml-auto text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                            </div>
                            <div className="text-sm mt-1">₹{unit.toLocaleString('en-IN')} × {it.qty} = <span className="font-semibold">₹{(unit * it.qty).toLocaleString('en-IN')}</span>{unit < (parseFloat(it.retailPrice) || unit) && <span className="text-xs text-green-600 ml-1">(bulk price)</span>}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center mt-4 py-3 border-t text-lg"><span className="font-semibold">Subtotal</span><span className="font-bold">₹{shopCart.reduce((a, it) => a + retailUnitPrice(it, it.qty) * it.qty, 0).toLocaleString('en-IN')}</span></div>
                    <div className="text-xs text-slate-500 mb-3">Taxes and delivery are confirmed at checkout.</div>
                    <button onClick={() => { setShowCart(false); setShowCheckout(true); }} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold">Checkout →</button>
                    <button onClick={() => setShopCart([])} className="w-full text-slate-500 hover:text-red-500 text-sm mt-3 py-2">Clear cart</button>
                    {business.paymentNote && <div className="mt-3 text-xs text-slate-500 flex items-start gap-2"><Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" /><span>{business.paymentNote}</span></div>}
                  </>
                )
              ) : (
                inquiryList.length === 0 ? <div className="text-center py-12 text-slate-500"><ListChecks size={48} className="mx-auto mb-3 opacity-50" />Your inquiry list is empty<button onClick={() => { setShowCart(false); navigate('catalog'); }} className="block mx-auto mt-4 text-amber-600 font-medium hover:underline">Browse Catalog →</button></div> : (
                  <>
                    {inquiryList.map(p => (
                      <div key={p.id} className="flex gap-3 py-3 border-b">
                        <SafeImage src={p.image} alt={p.name} className="w-16 h-16 rounded object-cover" />
                        <div className="flex-1">
                          <div className="text-xs font-mono text-slate-500">{p.code}</div>
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => setInquiryList(inquiryList.map(x => x.id === p.id ? {...x, quantity: Math.max(1, (x.quantity || 1) - 1)} : x))} className="w-7 h-7 border rounded hover:bg-slate-50"><Minus size={12} className="mx-auto" /></button>
                            <input type="number" value={p.quantity} onChange={e => { const v = parseInt(e.target.value) || 1; setInquiryList(inquiryList.map(x => x.id === p.id ? {...x, quantity: Math.max(1, v)} : x)); }} className="w-16 text-center border rounded py-1 text-sm" />
                            <button onClick={() => setInquiryList(inquiryList.map(x => x.id === p.id ? {...x, quantity: (x.quantity || 1) + 1} : x))} className="w-7 h-7 border rounded hover:bg-slate-50"><Plus size={12} className="mx-auto" /></button>
                            <span className="text-xs text-slate-500">pairs</span>
                            <button onClick={() => setInquiryList(inquiryList.filter(x => x.id !== p.id))} className="ml-auto text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                          </div>
                          {(p.selSize || p.selColor) && <div className="text-xs text-slate-500 mt-1">{[p.selSize, p.selColor].filter(Boolean).join(' · ')}</div>}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => { setShowCart(false); navigate('contact'); }} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold mt-6">Submit Inquiry →</button>
                    <button onClick={() => { setShowCart(false); setShowProforma(true); }} className="w-full mt-3 border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"><FileText size={18} /> Download Proforma Estimate</button>
                    <button onClick={() => setInquiryList([])} className="w-full text-slate-500 hover:text-red-500 text-sm mt-3 py-2">Clear all items</button>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showProforma && inquiryList.length > 0 && <ProformaModal items={inquiryList} business={business} customer={customer} onLog={logProforma} onClose={() => setShowProforma(false)} />}


      {showCheckout && <CheckoutModal business={business} shopCart={shopCart} products={products} customer={customer} onPlaceOrder={placeOrder} onClose={() => setShowCheckout(false)} />}
      {showAccount && <AccountModal customer={customer} inquiryHistory={inquiryHistory} orderHistory={orderHistory} initialTab={accountTab} onAuthed={(d, event) => { applyCustomerSession(d); if (d && d.user) syncCustomerToSheet(customerProfile(d.user), event); setShowAccount(false); }} onLogout={logoutCustomer} onProfileUpdated={onCustomerProfileUpdated} onClose={() => setShowAccount(false)} />}

      {showIdleWarn && customer && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><Clock size={24} className="text-amber-600" /></div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">Still there?</h3>
            <p className="text-sm text-slate-600 mb-5">You've been inactive for a while. Would you like to stay signed in or log out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowIdleWarn(false)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg font-semibold">Stay on site</button>
              <button onClick={logoutCustomer} className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg font-semibold">Log out</button>
            </div>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowAdminLogin(false); setPwdError(''); setAdminPwd(''); }}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6"><div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3"><Lock className="text-amber-600" size={28} /></div><h2 className="text-xl font-bold">Admin Login</h2><p className="text-sm text-slate-500 mt-1">Enter your password to continue</p></div>
            <input type="password" value={adminPwd} onChange={e => { setAdminPwd(e.target.value); setPwdError(''); }} onKeyDown={e => e.key === 'Enter' && tryAdminLogin()} placeholder="Enter password" className="w-full px-4 py-3 border rounded-lg mb-3" autoFocus />
            {pwdError && <div className="text-red-500 text-sm mb-3">{pwdError}</div>}
            <button onClick={tryAdminLogin} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold">Login</button>
            <button onClick={() => { setShowAdminLogin(false); setPwdError(''); setAdminPwd(''); }} className="w-full text-slate-500 hover:text-slate-700 text-sm mt-3 py-2">Cancel</button>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-40 right-6 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl z-50">{toast}</div>}
    </div>
  );
}
