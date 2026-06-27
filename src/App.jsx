import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Search, ShoppingBag, Phone, Mail, MapPin, MessageCircle, Menu, X, ChevronRight, ChevronUp, ChevronDown, Star, Award, Truck, Package, Users, Plus, Minus, Send, Facebook, Instagram, Linkedin, Download, Copy, CheckCircle, ArrowRight, Trash2, Edit, Save, Eye, Lock, Inbox, FileText, Home, Grid, Info, HelpCircle, BarChart3, Clock, TrendingUp, LogOut, Settings, Tag, MessageSquare, ListChecks, Sparkles, Printer, Loader2, Sun, Moon, Heart, EyeOff, Shield, RefreshCw, Share2 } from 'lucide-react';

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
  async sendOtp(email) {
    const r = await fetch(`${this.base}/otp`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, create_user: false }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.msg || d.error_description || d.message || 'Could not send the code');
    return d;
  },
  async verifyOtp(email, token) {
    const r = await fetch(`${this.base}/verify`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'email', email, token }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.msg || d.error_description || 'Invalid or expired code');
    return d; // { access_token, refresh_token, user }
  },
  async sendReset(email, redirectTo) {
    const r = await fetch(`${this.base}/recover`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(redirectTo ? { email, redirect_to: redirectTo } : { email }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.msg || d.error_description || 'Could not send reset email');
    return true;
  },
  async setPassword(access_token, password) {
    const r = await fetch(`${this.base}/user`, { method: 'PUT', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ password }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.msg || d.error_description || 'Could not update password');
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
  async saveWishlist(access_token, wishlist) {
    try {
      const r = await fetch(`${this.base}/user`, { method: 'PUT', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ data: { wishlist } }) });
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
  return { id: user?.id || '', email: user?.email || '', name: m.name || '', phone: m.phone || '', whatsapp: m.whatsapp || '', city: m.city || '', address: m.address || '', addresses: Array.isArray(m.addresses) ? m.addresses : [] };
}

function PasswordInput({ value, onChange, onKeyDown, placeholder, className, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus} className={(className || 'w-full px-3 py-2 border rounded-lg') + ' pr-10'} />
      <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  );
}

function AccountModal({ customer, business, inquiryHistory, orderHistory, initialTab, onAuthed, onLogout, onProfileUpdated, onClose, onBrowse }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '', sameWhatsapp: true, whatsapp: '', address: '', city: '', pincode: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [prof, setProf] = useState(() => (customer ? { ...customer.profile } : { name: '', phone: '', city: '', address: '', email: '' }));
  const [savedMsg, setSavedMsg] = useState('');
  const [acctTab, setAcctTab] = useState(initialTab || 'profile');
  const [openInq, setOpenInq] = useState(null);
  const [openOrd, setOpenOrd] = useState(null);
  const [addresses, setAddresses] = useState(() => (customer && Array.isArray(customer.profile.addresses)) ? customer.profile.addresses : []);
  const [addrForm, setAddrForm] = useState({ recipient: '', label: '', address: '', city: '', pincode: '', phone: '' });
  const [editingAddrId, setEditingAddrId] = useState(null);
  const [addrMsg, setAddrMsg] = useState('');
  const [addrBusy, setAddrBusy] = useState(false);
  useEffect(() => { if (customer && Array.isArray(customer.profile.addresses)) setAddresses(customer.profile.addresses); }, [customer]);
  const persistAddresses = async (next) => {
    setAddrBusy(true); setAddrMsg('');
    try { const u = await customerAuth.updateProfile(customer.access_token, { addresses: next }); onProfileUpdated(u); setAddresses(next); setAddrMsg('Saved ✓'); }
    catch (e) { setAddrMsg('Could not save — try again'); } finally { setAddrBusy(false); }
  };
  const resetAddrForm = () => { setAddrForm({ recipient: '', label: '', address: '', city: '', pincode: '', phone: '' }); setEditingAddrId(null); };
  const startEditAddress = (a) => { setEditingAddrId(a.id); setAddrForm({ recipient: a.recipient || '', label: a.label || '', address: a.address || '', city: a.city || '', pincode: a.pincode || '', phone: a.phone || '' }); setAddrMsg(''); };
  const saveAddress = async () => {
    if (!addrForm.address.trim() || !addrForm.city.trim() || !addrForm.pincode.trim()) { setAddrMsg('Please fill address, city and pincode'); return; }
    if (editingAddrId) {
      const next = addresses.map(a => a.id === editingAddrId ? { ...a, recipient: addrForm.recipient.trim(), label: addrForm.label.trim() || 'Address', address: addrForm.address.trim(), city: addrForm.city.trim(), pincode: addrForm.pincode.trim(), phone: addrForm.phone.trim() } : a);
      await persistAddresses(next);
    } else {
      const entry = { id: 'addr_' + Date.now(), recipient: addrForm.recipient.trim(), label: addrForm.label.trim() || 'Address', address: addrForm.address.trim(), city: addrForm.city.trim(), pincode: addrForm.pincode.trim(), phone: addrForm.phone.trim(), isDefault: addresses.length === 0 };
      await persistAddresses([...addresses, entry]);
    }
    resetAddrForm();
  };
  const deleteAddress = async (id) => { await persistAddresses(addresses.filter(a => a.id !== id)); if (editingAddrId === id) resetAddrForm(); };
  const setDefaultAddress = async (id) => { await persistAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id }))); };
  const [liveOrders, setLiveOrders] = useState(null);
  useEffect(() => { if (customer) setProf({ ...customer.profile }); }, [customer]);
  useEffect(() => { if (initialTab) setAcctTab(initialTab); }, [initialTab]);
  useEffect(() => {
    if (acctTab !== 'orders' || !customer || !customer.access_token || !customer.profile || !customer.profile.id) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&user_id=eq.${encodeURIComponent(customer.profile.id)}&order=created_at.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${customer.access_token}` } });
        if (!r.ok) return;
        const rows = await r.json();
        if (cancel || !Array.isArray(rows)) return;
        setLiveOrders(rows.map(row => { const d = row.data || {}; return { ...d, id: row.id, status: row.status || d.status || 'new', payment: d.paymentLabel || d.payment, paymentLabel: d.paymentLabel || d.payment }; }));
      } catch (e) {}
    })();
    return () => { cancel = true; };
  }, [acctTab, customer]);
  const [liveInq, setLiveInq] = useState(null);
  useEffect(() => {
    if (acctTab !== 'inquiries' || !customer || !customer.access_token || !customer.profile || !customer.profile.id) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?select=*&data->>userId=eq.${encodeURIComponent(customer.profile.id)}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${customer.access_token}` } });
        if (!r.ok) return;
        const rows = await r.json();
        if (cancel || !Array.isArray(rows)) return;
        const list = rows.filter(x => x && x.data && x.data.type === 'inquiry').map(row => { const d = row.data || {}; return { id: row.id, inqNo: d.inqNo || '', date: d.date, message: (d.message || '').trim(), shop: d.shop || '', city: d.city || '', products: (d.products || []).map(p => ({ code: p.code, name: p.name, quantity: p.quantity, selSize: p.selSize, selColor: p.selColor })), status: row.status || d.status || 'new', adminComment: d.adminComment || '' }; }).sort((a, b) => new Date(b.date) - new Date(a.date));
        setLiveInq(list);
      } catch (e) {}
    })();
    return () => { cancel = true; };
  }, [acctTab, customer]);

  const doLogin = async () => {
    setErr(''); setBusy(true);
    try { const d = await customerAuth.login(f.email.trim(), f.password); onAuthed(d, 'login'); setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 250); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  const [loginMethod, setLoginMethod] = useState('password');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const doSendOtp = async () => {
    setErr(''); setNotice('');
    if (!f.email.trim()) { setErr('Please enter your email first'); return; }
    setBusy(true);
    try { await customerAuth.sendOtp(f.email.trim()); setCodeSent(true); setNotice('We emailed you a 6-digit code. Enter it below. If you don\'t see it, check your Spam folder and mark it "Not spam".'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doVerifyOtp = async () => {
    setErr('');
    if (!code.trim()) { setErr('Enter the code from your email'); return; }
    setBusy(true);
    try { const d = await customerAuth.verifyOtp(f.email.trim(), code.trim()); onAuthed(d, 'login'); setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 250); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  const doForgot = async () => {
    setErr(''); setNotice('');
    if (!f.email.trim()) { setErr('Enter your email above first, then tap "Forgot password?"'); return; }
    setBusy(true);
    try { await customerAuth.sendReset(f.email.trim(), window.location.origin); setNotice('If that email has an account, we sent a reset link. Check your inbox — and your Spam folder, marking it "Not spam" if you find it there.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doRegister = async () => {
    setErr(''); setNotice('');
    if (!f.name.trim() || !f.email.trim() || !f.password) { setErr('Please fill name, email and password'); return; }
    if (!f.phone.trim()) { setErr('Please enter your phone number'); return; }
    if (!f.sameWhatsapp && !f.whatsapp.trim()) { setErr('Please enter your WhatsApp number (or tick the box if it is the same as your phone)'); return; }
    if (f.password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (f.password !== f.confirm) { setErr('Passwords do not match'); return; }
    setBusy(true);
    try {
      const whatsappNumber = (f.sameWhatsapp ? f.phone : (f.whatsapp || f.phone)).trim();
      const meta = { name: f.name.trim(), phone: f.phone.trim(), whatsapp: whatsappNumber };
      if (f.address && f.address.trim() && f.city && f.city.trim() && f.pincode && f.pincode.trim()) {
        meta.city = f.city.trim();
        meta.address = f.address.trim();
        meta.addresses = [{ id: 'addr_' + Date.now(), recipient: f.name.trim(), label: 'Home', address: f.address.trim(), city: f.city.trim(), pincode: f.pincode.trim(), phone: f.phone.trim(), isDefault: true }];
      }
      const d = await customerAuth.signup(f.email.trim(), f.password, meta);
      if (d.access_token) onAuthed(d, 'register');
      else { setNotice('Account created. Please log in.'); setMode('login'); }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveProfile = async () => {
    setErr(''); setSavedMsg(''); setBusy(true);
    try {
      const u = await customerAuth.updateProfile(customer.access_token, { name: prof.name, phone: prof.phone }); onProfileUpdated(u); setSavedMsg('Saved ✓');
    }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const inqLiveIds = new Set((liveInq || []).map(x => x.id));
  const inqToShow = [...(liveInq || []), ...((inquiryHistory || []).filter(h => !inqLiveIds.has(h.id)))].sort((a, b) => new Date(a.date) - new Date(b.date));
  const inquiriesView = (
    <div>
      <div className="flex items-center gap-2 mb-4"><ListChecks size={18} className="text-amber-500" /><h3 className="font-bold text-slate-900">My inquiries</h3></div>
      {(!inqToShow || inqToShow.length === 0) ? (
        <div className="text-center py-12 px-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><Inbox size={26} className="text-amber-500" /></div>
          <div className="font-semibold text-slate-900 mb-1">No inquiries yet</div>
          <div className="text-sm text-slate-500 max-w-[240px] mx-auto mb-4">Added items to an inquiry? They'll show up here once you send a request for a quote.</div>
          <button onClick={() => onBrowse && onBrowse()} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg">Browse products</button>
        </div>
      ) : (
        <div className="space-y-3">
          {inqToShow.map(h => {
            const isOpen = openInq === h.id;
            return (
            <div key={h.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <div role="button" tabIndex={0} onClick={() => setOpenInq(isOpen ? null : h.id)} className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-slate-50 cursor-pointer">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.inqNo ? <span className="text-sm font-mono font-bold text-amber-600"><CopyableCode code={h.inqNo} /></span> : <span className="text-sm font-semibold text-slate-700">Inquiry</span>}
                    {h.status ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${h.status === 'resolved' ? 'bg-green-50 text-green-700' : h.status === 'in progress' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{h.status}</span> : <span className="text-[11px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Submitted</span>}
                    {h.adminComment && <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">💬 Update</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1"><Clock size={12} /> {new Date(h.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <ChevronRight size={18} className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </div>
              {isOpen && (
                <div className="px-4 pb-4 -mt-1">
                  {h.products && h.products.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">{h.products.map((p, idx) => <span key={idx} className="text-xs bg-amber-50 text-amber-800 border border-amber-100 px-2 py-1 rounded-md">{p.name || p.code}{p.quantity ? ` × ${p.quantity}` : ''}{(p.selSize||p.selColor) ? ` (${[p.selSize,p.selColor].filter(Boolean).join('/')})` : ''}</span>)}</div>
                  ) : <div className="text-xs text-slate-400 italic mb-2">General inquiry (no products selected)</div>}
                  {h.message && <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border-l-2 border-amber-300">{h.message}</div>}
                  {h.adminComment && <div className="text-sm text-slate-700 bg-blue-50 rounded-lg px-3 py-2 border-l-2 border-blue-400 mt-2"><span className="font-semibold text-blue-700">Update from us:</span> {h.adminComment}</div>}
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

  const ordersToShow = (liveOrders || orderHistory || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const ordersView = (
    <div>
      <div className="flex items-center gap-2 mb-4"><ShoppingBag size={18} className="text-amber-500" /><h3 className="font-bold text-slate-900">My orders</h3></div>
      {(!ordersToShow || ordersToShow.length === 0) ? (
        <div className="text-center py-12 px-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><ShoppingBag size={26} className="text-amber-500" /></div>
          <div className="font-semibold text-slate-900 mb-1">No orders yet</div>
          <div className="text-sm text-slate-500 max-w-[240px] mx-auto mb-4">When you place an order, it'll appear here so you can track its status.</div>
          <button onClick={() => onBrowse && onBrowse()} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg">Browse products</button>
        </div>
      ) : (
        <div className="space-y-3">
          {ordersToShow.map(o => {
            const isOpen = openOrd === o.id;
            return (
            <div key={o.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <div role="button" tabIndex={0} onClick={() => setOpenOrd(isOpen ? null : o.id)} className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-slate-50 cursor-pointer">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-bold text-amber-600"><CopyableCode code={o.orderNo} /></span>
                    <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full capitalize">{o.status || 'new'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1"><Clock size={12} /> {new Date(o.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-slate-900 text-sm">₹{Number(o.total).toLocaleString('en-IN')}</span>
                  <ChevronRight size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 -mt-1">
                  {o.items && o.items.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">{o.items.map((it, idx) => <span key={idx} className="text-xs bg-amber-50 text-amber-800 border border-amber-100 px-2 py-1 rounded-md">{it.name}{(it.size || it.color) ? ` (${[it.size, it.color].filter(Boolean).join('/')})` : ''} ×{it.qty}</span>)}</div>}
                  <div className="flex justify-between items-center text-sm border-t pt-2 mt-1"><span className="text-slate-500">{o.payment}</span><span className="font-bold text-slate-900">₹{Number(o.total).toLocaleString('en-IN')}</span></div>
                  <button onClick={() => openOrderInvoice(o, business || {})} className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1.5"><Download size={15} /> Download invoice (PDF)</button>
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
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">Delivery addresses are managed in <span className="font-medium text-slate-700">My addresses</span>.</div>
        {savedMsg && <div className="text-sm text-green-600">{savedMsg}</div>}
        <button onClick={saveProfile} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold">{busy ? 'Saving…' : 'Save profile'}</button>
      </div>
    </div>
  );

  const addressesView = (
    <div>
      <div className="flex items-center gap-2 mb-4"><MapPin size={18} className="text-amber-500" /><h3 className="font-bold text-slate-900">My addresses</h3></div>
      {addresses.length === 0 ? (
        <div className="text-center py-8 px-4 bg-slate-50 rounded-xl mb-4"><MapPin size={26} className="mx-auto text-slate-300 mb-2" /><div className="text-sm text-slate-500">No saved addresses yet</div><div className="text-xs text-slate-400 mt-1">Add one below to check out faster next time.</div></div>
      ) : (
        <div className="space-y-3 mb-5">
          {addresses.map(a => (
            <div key={a.id} className={`border rounded-xl p-3 ${a.isDefault ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-slate-900 text-sm">{a.label || 'Address'}</span>
                {a.isDefault && <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full">Default</span>}
                <div className="ml-auto flex gap-2">
                  {!a.isDefault && <button onClick={() => setDefaultAddress(a.id)} disabled={addrBusy} className="text-xs text-amber-700 hover:underline">Set default</button>}
                  <button onClick={() => startEditAddress(a)} disabled={addrBusy} className="text-xs text-slate-600 hover:underline">Edit</button>
                  <button onClick={() => deleteAddress(a.id)} disabled={addrBusy} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
              {a.recipient && <div className="text-sm text-slate-700">For: {a.recipient}</div>}
              <div className="text-sm text-slate-600">{a.address}, {a.city} {a.pincode}{a.phone ? ` · ${a.phone}` : ''}</div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t pt-4">
        <div className="text-sm font-semibold text-slate-800 mb-2">{editingAddrId ? 'Edit address' : 'Add a new address'}</div>
        <div className="space-y-2">
          <input value={addrForm.recipient} onChange={e => setAddrForm({ ...addrForm, recipient: e.target.value })} placeholder="Recipient name (optional — if someone else collects)" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <input value={addrForm.label} onChange={e => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="Label (e.g., Home, Office)" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <input value={addrForm.address} onChange={e => setAddrForm({ ...addrForm, address: e.target.value })} placeholder="Address *" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={addrForm.city} onChange={e => setAddrForm({ ...addrForm, city: e.target.value })} placeholder="City *" className="px-3 py-2 border rounded-lg text-sm" />
            <input value={addrForm.pincode} onChange={e => setAddrForm({ ...addrForm, pincode: e.target.value })} placeholder="Pincode *" className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <input value={addrForm.phone} onChange={e => setAddrForm({ ...addrForm, phone: e.target.value })} placeholder="Phone (optional)" className="w-full px-3 py-2 border rounded-lg text-sm" />
          {addrMsg && <div className={`text-sm ${addrMsg.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>{addrMsg}</div>}
          <div className="flex gap-2">
            <button onClick={saveAddress} disabled={addrBusy} className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg font-semibold text-sm">{addrBusy ? 'Saving…' : (editingAddrId ? 'Save changes' : 'Add address')}</button>
            {editingAddrId && <button onClick={resetAddrForm} disabled={addrBusy} className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg font-medium text-sm">Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );

  const sectionTitle = acctTab === 'inquiries' ? 'My inquiries' : acctTab === 'orders' ? 'My orders' : acctTab === 'addresses' ? 'My addresses' : 'Account info';
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
              <NavBtn id="addresses" icon={<MapPin size={18} />} label="My addresses" />
              <div className="border-t border-slate-100 my-2"></div>
              <button onClick={onLogout} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={18} /> Log out</button>
            </aside>
            <div className="flex-1 p-5 min-w-0">
              {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-3">{err}</div>}
              {acctTab === 'inquiries' ? inquiriesView : acctTab === 'orders' ? ordersView : acctTab === 'addresses' ? addressesView : profileView}
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
              <div className="flex gap-2">
                <button onClick={() => { setErr(''); setNotice(''); setLoginMethod('password'); }} className={`flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${loginMethod === 'password' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'}`}>Password</button>
                <button onClick={() => { setErr(''); setNotice(''); setLoginMethod('code'); setCodeSent(false); setCode(''); }} className={`flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${loginMethod === 'code' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'}`}>Email me a code</button>
              </div>
              {loginMethod === 'password' ? (
                <>
                  <div><label className="text-sm font-medium text-slate-700 block mb-1">Email</label><input type="email" value={f.email} onChange={e => setF({...f, email: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doLogin(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="text-sm font-medium text-slate-700 block mb-1">Password</label><PasswordInput value={f.password} onChange={e => setF({...f, password: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doLogin(); }} /></div>
                  <div className="text-right -mt-1"><button onClick={doForgot} disabled={busy} className="text-xs text-amber-600 font-medium hover:underline">Forgot password?</button></div>
                  <button onClick={doLogin} disabled={busy} className="w-full bg-slate-900 hover:bg-amber-500 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold transition-colors">{busy ? 'Logging in…' : 'Log In'}</button>
                </>
              ) : (
                <>
                  <div><label className="text-sm font-medium text-slate-700 block mb-1">Email</label><input type="email" value={f.email} onChange={e => setF({...f, email: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) (codeSent ? doVerifyOtp() : doSendOtp()); }} className="w-full px-3 py-2 border rounded-lg" /></div>
                  {!codeSent ? (
                    <button onClick={doSendOtp} disabled={busy} className="w-full bg-slate-900 hover:bg-amber-500 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold transition-colors">{busy ? 'Sending…' : 'Send me the code'}</button>
                  ) : (
                    <>
                      <div><label className="text-sm font-medium text-slate-700 block mb-1">Enter the 6-digit code</label><input value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} onKeyDown={e => { if (e.key === 'Enter' && !busy) doVerifyOtp(); }} className="w-full px-3 py-2 border rounded-lg text-center text-lg tracking-widest font-semibold" placeholder="••••••" /></div>
                      <button onClick={doVerifyOtp} disabled={busy} className="w-full bg-slate-900 hover:bg-amber-500 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold transition-colors">{busy ? 'Verifying…' : 'Log in with code'}</button>
                      <div className="text-xs text-center text-slate-500">Didn't get it? <button onClick={doSendOtp} disabled={busy} className="text-amber-600 font-medium hover:underline">Resend code</button></div>
                    </>
                  )}
                </>
              )}
              <div className="text-sm text-center text-slate-500">No account? <button onClick={() => { setErr(''); setMode('register'); }} className="text-amber-600 font-medium">Create one</button></div>
            </>
          ) : (
            <>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Name *</label><input value={f.name} onChange={e => setF({...f, name: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Email *</label><input type="email" value={f.email} onChange={e => setF({...f, email: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Phone *</label><input value={f.phone} onChange={e => setF({...f, phone: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={f.sameWhatsapp} onChange={e => setF({...f, sameWhatsapp: e.target.checked})} />
                  My phone number is also my WhatsApp
                </label>
                {!f.sameWhatsapp && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-slate-700 block mb-1">WhatsApp Number *</label>
                    <input value={f.whatsapp} onChange={e => setF({...f, whatsapp: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} placeholder="e.g., +91 98765 43210" className="w-full px-3 py-2 border rounded-lg" />
                    <div className="text-xs text-slate-500 mt-1">Include country code so we can reach you on WhatsApp.</div>
                  </div>
                )}
              </div>
              <div className="pt-1">
                <div className="text-xs text-slate-500 mb-2">Delivery address (optional — you can add it now or later)</div>
                <div className="space-y-2">
                  <input value={f.address} onChange={e => setF({...f, address: e.target.value})} placeholder="Address" className="w-full px-3 py-2 border rounded-lg" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={f.city} onChange={e => setF({...f, city: e.target.value})} placeholder="City" className="px-3 py-2 border rounded-lg" />
                    <input value={f.pincode} onChange={e => setF({...f, pincode: e.target.value})} placeholder="Pincode" className="px-3 py-2 border rounded-lg" />
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-1">If you add all three, it becomes your default delivery address.</div>
              </div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Password *</label><PasswordInput value={f.password} onChange={e => setF({...f, password: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Confirm Password *</label><PasswordInput value={f.confirm} onChange={e => setF({...f, confirm: e.target.value})} onKeyDown={e => { if (e.key === 'Enter' && !busy) doRegister(); }} /></div>
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
function RecoveryModal({ accessToken, refreshToken, onAuthed, onClose }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const finish = () => { try { window.location.replace(window.location.origin + window.location.pathname); } catch (e) { try { onClose(); } catch (e2) {} } };
  const submit = async () => {
    setErr('');
    if (pw.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (pw !== confirm) { setErr('Passwords do not match'); return; }
    setBusy(true);
    try {
      const user = await customerAuth.setPassword(accessToken, pw);
      try { if (onAuthed) onAuthed({ access_token: accessToken, refresh_token: refreshToken, user }, 'login'); } catch (e) {}
      setDone(true);
      setTimeout(finish, 1600);
    }
    catch (e) { setErr(e.message || 'Could not update password. The reset link may have expired — request a new one.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-start justify-center overflow-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Lock size={18} className="text-amber-500" /> Choose a new password</h2>
          <button onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        <div className="p-6 space-y-3">
          {done ? (
            <>
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 flex items-center gap-2"><CheckCircle size={18} /> Password updated — you're logged in!</div>
              <button onClick={finish} className="w-full bg-slate-900 hover:bg-amber-500 text-white py-2.5 rounded-lg font-semibold transition-colors">Continue</button>
            </>
          ) : (
            <>
              {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{err}</div>}
              <p className="text-sm text-slate-600">You opened a secure reset link. Set your new password below.</p>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">New password</label><PasswordInput value={pw} onChange={e => setPw(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Confirm new password</label><PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !busy) submit(); }} /></div>
              <button onClick={submit} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold transition-colors">{busy ? 'Updating…' : 'Update password'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

async function pushToGoogleSheets(inquiry) {
  try {
    const productsStr = inquiry.products?.map(p => `${p.code}-${p.name}${(p.selSize||p.selColor)?` [${[p.selSize,p.selColor].filter(Boolean).join('/')}]`:''} (${p.quantity} pairs)`).join('; ') || '';
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: inquiry.type || 'inquiry', id: inquiry.id || '', status: inquiry.status || 'new', inqNo: inquiry.inqNo || '', name: inquiry.name, shop: inquiry.shop, city: inquiry.city, phone: inquiry.phone, whatsapp: inquiry.whatsapp, email: inquiry.email, message: inquiry.message, products: productsStr, apptDate: inquiry.apptDate || '', apptTime: inquiry.apptTime || '', source: inquiry.source || 'Inquiry Form' }) });
    return true;
  } catch (e) { 
    console.warn('Google Sheets not available in this environment (will work after deployment):', e.message); 
    return null; // null = not attempted/available, vs false = attempted but failed
  }
}

// Allocate the next sequential inquiry reference like INQ-00001 via a Supabase counter
// (a SECURITY DEFINER function), so it does NOT need to read the inquiries table.
async function nextInquiryNumber() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/next_inquiry_number`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (r.ok) {
      const v = await r.json();
      if (typeof v === 'string' && v) return v;
      if (v && typeof v.next_inquiry_number === 'string') return v.next_inquiry_number;
    }
  } catch (e) { /* fall through to a safe unique fallback */ }
  return `INQ-${String(Date.now()).slice(-5)}`;
}

// Order reference, e.g. ORD-240626-165830 (date + time, unique per second)
function makeOrderNo() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return `ORD-${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function makeProformaNo() {
  // Unique, non-repeating reference: millisecond timestamp (always moves forward) + random suffix
  return `PRO-${Date.now()}${String(Math.floor(Math.random() * 900 + 100))}`;
}
const STATUS_RANK = { 'new': 0, 'in progress': 1, 'confirmed': 1, 'packed': 2, 'shipped': 3, 'out for delivery': 4, 'delivered': 5, 'resolved': 5, 'cancelled': 9 };
function statusRank(st) { const k = String(st || '').toLowerCase(); return STATUS_RANK[k] != null ? STATUS_RANK[k] : 50; }
function sortRecords(arr, mode, getDate, getName, getStatus) {
  const a = arr.slice();
  if (mode === 'newest') a.sort((x, y) => new Date(getDate(y)) - new Date(getDate(x)));
  else if (mode === 'name') a.sort((x, y) => String(getName(x) || '').localeCompare(String(getName(y) || '')));
  else if (mode === 'status') a.sort((x, y) => (statusRank(getStatus(x)) - statusRank(getStatus(y))) || (new Date(getDate(x)) - new Date(getDate(y))));
  else a.sort((x, y) => new Date(getDate(x)) - new Date(getDate(y)));
  return a;
}
async function pushOrderToSheets(order) {
  try {
    const productsStr = (order.items || []).map(it => `${it.code}-${it.name} [${it.size}/${it.color}] x${it.qty} @ ₹${it.unit}`).join('; ');
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      type: 'order', id: order.id, status: order.status || 'new', orderId: order.orderNo, name: order.name, phone: order.phone, whatsapp: order.whatsapp, email: order.email,
      address: order.address, city: order.city, pincode: order.pincode, products: productsStr, total: order.total, payment: order.paymentLabel, message: order.note || '', inv: order.invoice || null
    }) });
    return true;
  } catch (e) { return null; }
}
async function syncStatusToSheet({ type, id, humanId, status, email, name, courier, trackingNo, trackingLink, inv }) {
  try {
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateStatus', type: type || 'inquiry', id: id || '', humanId: humanId || '', status: status || '', email: email || '', name: name || '', courier: courier || '', trackingNo: trackingNo || '', trackingLink: trackingLink || '', inv: inv || null }) });
    return true;
  } catch (e) { return null; }
}
async function sendOrderEmail(order) {
  // Web3Forms removed — order emails are now sent for free by Google Apps Script when the row is written to the Sheet.
  return true;
}
async function saveOrderToSupabase(order, accessToken) {
  try {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken || SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, { method: 'POST', headers, body: JSON.stringify([{ id: order.id, data: order, status: 'new', user_id: order.userId || null }]) });
    return r.ok;
  } catch (e) { return null; }
}

// Adjust product stock in Supabase via a security-definer function.
// factor = -1 decrements (order placed), +1 restores (order cancelled).
async function adjustStockRPC(items, factor, token) {
  try {
    const payload = (Array.isArray(items) ? items : []).filter(it => it && it.id).map(it => ({ id: it.id, size: it.size || '', color: it.color || '', qty: parseInt(it.qty) || 0 }));
    if (!payload.length) return;
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/adjust_stock`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${token || SUPABASE_KEY}` }, body: JSON.stringify({ items: payload, factor }) });
  } catch (e) {}
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
      whatsapp: profile.whatsapp || '',
      city: profile.city || '',
      address: profile.address || '',
      userId: profile.id || '',
      date: new Date().toISOString()
    }) });
    return true;
  } catch (e) { return null; }
}

// Mirror the customer's profile into a Supabase `customers` table so the admin can
// list registered customers. Each customer writes only their own row (RLS-enforced).
async function syncCustomerToSupabase(profile, token) {
  try {
    if (!profile || !profile.id || !token) return null;
    const row = {
      id: profile.id,
      data: { name: profile.name || '', email: profile.email || '', phone: profile.phone || '', whatsapp: profile.whatsapp || '', city: profile.city || '', address: profile.address || '', lastSeen: new Date().toISOString() }
    };
    await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row])
    });
    return true;
  } catch (e) { return null; }
}

async function sendInquiryEmail(inquiry) {
  // Web3Forms removed — inquiry emails are now sent for free by Google Apps Script when the row is written to the Sheet.
  return true;
}


// ===== DEFAULT DATA =====
const DEFAULT_CATEGORIES = [
  { id: 'formal', name: 'Formal Shoes', icon: '👞' }, { id: 'casual', name: 'Casual Shoes', icon: '👟' },
  { id: 'sports', name: 'Sports Shoes', icon: '🏃' }, { id: 'sandals', name: 'Sandals', icon: '🩴' },
  { id: 'boots', name: 'Boots', icon: '🥾' }, { id: 'loafers', name: 'Loafers', icon: '🥿' },
];

const DEFAULT_FAQS = [
  { id: 'faq_2', q: 'Do you offer customization or private labeling?', a: 'Yes, we offer customization for bulk orders.' },
  { id: 'faq_3', q: 'What are your payment terms?', a: 'Advance payment / Net 30 for approved customers' },
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
  facebook: '', instagram: '',
  gstin: '', legalName: '[Legal Business Name]', hsnCode: '6403', gstRate: 18,
  bankName: '[Bank Name]', accountNo: '[Account Number]', ifsc: '[IFSC Code]', invoicePrefix: 'INV-',
  deliveryFee: '', freeDeliveryAbove: 0, upiId: '', upiName: '',
  howToOrder: 'How to Order\n\n1. Browse our catalog and open any product.\n2. Choose your size and colour, then tap \'Add to Cart\'.\n3. Open your cart and tap \'Checkout\'.\n4. Enter your delivery details and choose a payment method (Cash on Delivery or UPI).\n5. Place your order — you\'ll get an order number and we\'ll confirm by phone or WhatsApp.\n\nPrefer to ask first? Add items to your inquiry list or message us on WhatsApp and we\'ll be glad to help.',
  shippingPolicy: 'We deliver across India.\n\n- Orders are usually dispatched within 1-3 business days.\n- Delivery typically takes 4-8 business days depending on your location.\n- Delivery charges (if any) are shown at checkout; orders above the free-delivery amount ship free.\n- For tracking or any delivery question, contact us on WhatsApp or phone with your order number.',
  returnsPolicy: 'We want you to be happy with your purchase.\n\n- Returns or exchanges are accepted within 7 days of delivery for unused items in their original condition and packaging.\n- To start a return, contact us with your order number on WhatsApp, phone or email.\n- Refunds, where applicable, are processed to the original payment method within 5-7 business days after we receive and inspect the item.\n- Customised or made-to-order items may not be eligible for return.\n\nPlease update this policy to match exactly how you handle returns.',
  privacyPolicy: 'This Privacy Policy explains how we collect and use your information.\n\n- Information we collect: your name, contact details, delivery address, and the order or inquiry details you provide.\n- How we use it: to process orders and inquiries, arrange delivery, provide support, and contact you about your order.\n- Sharing: we share details only as needed to fulfil your order (for example, with delivery partners) and as required by law. We do not sell your personal information.\n- Your choices: contact us any time to access or update your information.\n- Contact us for any privacy question using the details on our Contact page.\n\nThis is a starting template — please review it for your business and local laws.',
  termsPolicy: 'By using this website and placing an order, you agree to these terms.\n\n- Product images and descriptions are for reference; slight variations may occur.\n- Prices and availability may change without notice. We confirm each order before dispatch.\n- Payment options and any applicable taxes or delivery charges are shown at checkout.\n- Orders may be cancelled if payment isn\'t received or an item is unavailable.\n- For any question, please use the details on our Contact page.\n\nThis is a starting template — please review it for your business and local laws.',
  cancellationPolicy: 'You can cancel an order before it is dispatched.\n\n- To cancel, contact us as soon as possible on WhatsApp, phone or email with your order number.\n- Once an order has been dispatched, it cannot be cancelled, but you may be able to return it as per our Return & Refund Policy.\n- If a prepaid order is cancelled before dispatch, any amount paid is refunded to the original payment method within 5-7 business days.\n- We may cancel an order if the item is unavailable or payment is not received, and will inform you in that case.\n\nThis is a starting template — please review it for your business and local laws.',
  grievanceName: '', grievanceEmail: '', grievancePhone: '', grievanceAddress: '',
  sizeGuideEnabled: true,
  sizeGuideTitle: "Men's footwear size guide",
  sizeGuideNote: 'Place your foot on a sheet of paper, mark the heel and the longest toe, measure the distance in cm, and match it to the "Foot (cm)" column. If you are between sizes, we recommend choosing the larger size.',
  sizeGuideRows: [
    { uk: '6', eu: '40', us: '7', cm: '24.5' },
    { uk: '7', eu: '41', us: '8', cm: '25.4' },
    { uk: '8', eu: '42', us: '9', cm: '26.2' },
    { uk: '9', eu: '43', us: '10', cm: '27.0' },
    { uk: '10', eu: '44', us: '11', cm: '27.8' },
    { uk: '11', eu: '45', us: '12', cm: '28.6' },
  ],
};
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'catalog', label: 'Catalog', icon: Grid },
  { id: 'about', label: 'About', icon: Info },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'contact', label: 'Contact', icon: MessageCircle },
];

// ===== URL ROUTING =====
// Secret admin entry path. Customers never see a link to it; open the admin login
// by visiting yoursite.com/<this>. Change this keyword any time to whatever you like.
const ADMIN_PATH = 'anand-control-2013';
const PAGE_TO_PATH = { home: '/', catalog: '/catalog', about: '/about', faq: '/faq', contact: '/contact', howto: '/how-to-order', returns: '/returns', cancellation: '/cancellation', privacy: '/privacy', terms: '/terms', admin: '/' + ADMIN_PATH };
const PATH_TO_PAGE = { '': 'home', catalog: 'catalog', about: 'about', faq: 'faq', contact: 'contact', 'how-to-order': 'howto', returns: 'returns', cancellation: 'cancellation', privacy: 'privacy', terms: 'terms', [ADMIN_PATH]: 'admin' };
function routeFromPath(pathname) {
  const parts = (pathname || '/').replace(/^\/+|\/+$/g, '').split('/');
  if (parts[0] === 'product' && parts[1]) return { page: 'product', productId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'category' && parts[1]) return { page: 'catalog', categorySlug: decodeURIComponent(parts[1]) };
  return { page: PATH_TO_PAGE[parts[0] || ''] || 'home', productId: null };
}
function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

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
// Convert a normal Google Drive share link into a direct image link that renders
// in <img> tags. Uses Drive's thumbnail endpoint (most reliable for browsers).
// Non-Drive URLs (or blank) are returned unchanged.
function directImageUrl(url) {
  url = String(url || '');
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200';
  return url;
}
function SafeImage({ src, alt, className }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);
  const real = directImageUrl(src);
  useEffect(() => {
    setError(false); setLoaded(false);
    // If the image is already cached/complete, reveal it immediately (the onLoad
    // event may have fired before React attached its handler).
    const img = ref.current;
    if (img && img.complete && img.naturalWidth > 0) { setLoaded(true); return; }
    // Safety: never let an image stay invisible if the load event is missed.
    const t = setTimeout(() => setLoaded(true), 1200);
    return () => clearTimeout(t);
  }, [src]);
  return <img ref={ref} src={error || !real ? PLACEHOLDER_IMG : real} alt={alt} className={`${className || ''} ws-fade ${loaded ? 'ws-loaded' : ''}`} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => { setError(true); setLoaded(true); }} />;
}
// Inline heritage crest (navy shield + gold border + interlocking AF).
// The filled navy shield makes it visible on ANY background and identical everywhere.
function CrestEmblem({ className }) {
  return (
    <svg viewBox="0 0 120 122" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Anand Footwear">
      <path d="M18 8 L102 8 L102 58 Q102 95 60 114 Q18 95 18 58 Z" fill="#0f2038" stroke="#caa043" strokeWidth="3" />
      <g transform="translate(-65,-53) scale(0.4)">
        <g stroke="#dcb863" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M232 340 L300 188 L368 340" /><path d="M261 287 L339 287" /></g>
        <g stroke="#f6f1e7" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M340 199 L340 333" /><path d="M340 205 L394 205" /><path d="M340 268 L384 268" /></g>
      </g>
    </svg>
  );
}

function WhatsAppIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function AdminPager({ page, pageSize, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-amber-50">‹ Prev</button>
      <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-amber-50">Next ›</button>
      <span className="text-xs text-slate-400 ml-2">Showing {from}–{to} of {total}</span>
    </div>
  );
}

function ShareButton({ product, business }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = (typeof window !== 'undefined' ? window.location.origin : '') + '/product/' + product.id;
  const msg = `Check out ${product.name}${business && business.name ? ' at ' + business.name : ''}: ${url}`;
  const onShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: product.name, text: `Check out ${product.name}`, url }); return; } catch (e) {}
    }
    setOpen(o => !o);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch (e) { try { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } catch (e2) {} }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative">
      <button onClick={onShare} className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-amber-50 rounded-lg px-3 py-1.5 text-sm text-slate-700" title="Share this product"><Share2 size={16} className="text-amber-500" /> Share</button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-30 overflow-hidden" onMouseLeave={() => setOpen(false)}>
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-amber-50"><WhatsAppIcon size={16} /> WhatsApp</a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-amber-50"><Facebook size={16} className="text-blue-600" /> Facebook</a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out ' + product.name)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-amber-50"><span className="w-4 text-center font-bold text-slate-800">𝕏</span> X (Twitter)</a>
          <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check out ' + product.name)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-amber-50"><Send size={16} className="text-sky-500" /> Telegram</a>
          <a href={`mailto:?subject=${encodeURIComponent(product.name)}&body=${encodeURIComponent(msg)}`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-amber-50"><Mail size={16} className="text-slate-500" /> Email</a>
          <button onClick={copy} className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-amber-50 border-t">{copied ? <><CheckCircle size={16} className="text-green-500" /> Link copied</> : <><Copy size={16} className="text-slate-500" /> Copy link</>}</button>
        </div>
      )}
    </div>
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
  const [hover, setHover] = useState(false);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const resumeTimer = useRef(null);
  const imgs = images && images.length ? images : [''];
  const pauseFor = (ms = 7000) => { setPaused(true); clearTimeout(resumeTimer.current); resumeTimer.current = setTimeout(() => setPaused(false), ms); };
  const go = (n) => { setIdx((n + imgs.length) % imgs.length); pauseFor(); };
  const pick = (i) => { setIdx(i); pauseFor(); };
  // Auto-rotate when more than one image, unless hovering (desktop) or just after a manual change
  useEffect(() => {
    if (imgs.length <= 1 || hover || paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % imgs.length), 4000);
    return () => clearInterval(t);
  }, [imgs.length, hover, paused]);
  useEffect(() => () => clearTimeout(resumeTimer.current), []);
  const onTouchStart = (e) => { touchX.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };
  return (
    <div>
      <div className="relative bg-slate-100 rounded-2xl overflow-hidden aspect-square" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {imgs.map((src, i) => (
          <div key={i} className="absolute inset-0 transition-opacity duration-700 ease-in-out" style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? 'auto' : 'none' }} aria-hidden={i !== idx}>
            <SafeImage src={src} alt={i === idx ? alt : ''} className="w-full h-full object-cover" />
          </div>
        ))}
        {imgs.length > 1 && (
          <>
            <button onClick={() => go(idx - 1)} aria-label="Previous image" className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-md"><ChevronRight className="rotate-180" size={20} /></button>
            <button onClick={() => go(idx + 1)} aria-label="Next image" className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-md"><ChevronRight size={20} /></button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
              {imgs.map((_, i) => <button key={i} onClick={() => pick(i)} aria-label={`Go to image ${i + 1}`} className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-amber-500' : 'bg-white/70'}`} />)}
            </div>
          </>
        )}
      </div>
      {imgs.length > 1 && (
        <div className="hidden md:flex gap-2 mt-3 flex-wrap">
          {imgs.map((src, i) => (
            <button key={i} onClick={() => pick(i)} style={i === idx ? { borderColor: '#C6A15B' } : {}} className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${i === idx ? '' : 'border-transparent'}`}>
              <SafeImage src={src} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, categories, onView, onAddToInquiry, isWished, onToggleWish }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all hover:-translate-y-1 group">
      <div className="relative aspect-square overflow-hidden bg-slate-100 cursor-pointer" onClick={() => onView(product)}>
        <SafeImage src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        {onToggleWish && <button onClick={(e) => { e.stopPropagation(); onToggleWish(product.id); }} aria-label={isWished ? 'Remove from saved' : 'Save to wishlist'} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm z-10"><Heart size={18} className={isWished ? 'text-rose-500' : 'text-slate-400'} fill={isWished ? 'currentColor' : 'none'} /></button>}
        {product.isNew && <span className="absolute top-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">NEW</span>}
        {product.isBestseller && <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">★ BEST</span>}
        {product.outOfStock && <span className="absolute bottom-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">Out of Stock</span>}
        {!product.outOfStock && (() => { const t = productTotalStock(product); return t > 0 && t <= 5 ? <span className="absolute bottom-3 left-3 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-semibold">Only {t} left</span> : null; })()}
      </div>
      <div className="p-4">
        <div className="text-xs text-slate-500 font-mono mb-1">{product.code}</div>
        <h3 className="font-semibold text-slate-900 mb-1 truncate">{product.name}</h3>
        <div className="text-xs text-slate-600 mb-3">{categories.find(c => c.id === product.category)?.name || 'Uncategorized'}</div>
        <div className="flex justify-between items-center mb-3">
          {(() => { const b = parseFloat(product.retailPrice) || parseFloat(product.priceFrom) || 0; const d = discPctFor(product); const dp = d > 0 ? Math.round(b * (1 - d / 100)) : b; return <div>{d > 0 ? <div className="flex items-center gap-2 flex-wrap"><span className="text-lg font-bold text-slate-900">₹{dp.toLocaleString('en-IN')}</span><span className="text-sm text-slate-400 line-through">₹{b.toLocaleString('en-IN')}</span><span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{d}% off</span></div> : <div className="text-lg font-bold text-slate-900">₹{b.toLocaleString('en-IN')}</div>}<div className="text-xs text-slate-500">per pair</div></div>; })()}
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
    const qty = item.quantity || 1;
    const price = discountedUnitPrice(item, qty) || parseFloat(item.retailPrice) || parseFloat(item.priceFrom) || 0;
    const subtotal = price * qty;
    const cgst = (subtotal * gstRate) / 200;
    const sgst = (subtotal * gstRate) / 200;
    const total = subtotal + cgst + sgst;
    return { price, subtotal, cgst, sgst, total };
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
                    <td className="p-2 text-right">₹{r.price.toFixed(2)}</td>
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
function discPctFor(p) { const d = parseFloat(p && p.discountPercent); return (isFinite(d) && d > 0) ? Math.min(d, 90) : 0; }
function discountedUnitPrice(p, qty) { const base = retailUnitPrice(p, qty); const d = discPctFor(p); return d > 0 ? Math.round(base * (1 - d / 100)) : base; }
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
    const price = discountedUnitPrice(item, qty) || base;
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
            <div><label className="block text-sm font-medium text-slate-700 mb-1">City</label><input value={buyer.city} onChange={e => setBuyer({...buyer, city: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
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
  const savedAddresses = (customer && Array.isArray(prof.addresses)) ? prof.addresses : [];
  const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0] || null;
  const [form, setForm] = useState({
    name: (defaultAddr && defaultAddr.recipient) || prof.name || '', phone: (defaultAddr && defaultAddr.phone) || prof.phone || '', whatsapp: '', email: prof.email || '',
    address: (defaultAddr && defaultAddr.address) || prof.address || '', city: (defaultAddr && defaultAddr.city) || prof.city || '', pincode: (defaultAddr && defaultAddr.pincode) || '', note: ''
  });
  const [selectedAddrId, setSelectedAddrId] = useState(defaultAddr ? defaultAddr.id : (savedAddresses.length ? null : 'new'));
  const [saveNewAddr, setSaveNewAddr] = useState(false);
  const pickAddress = (a) => { setSelectedAddrId(a.id); setForm(f => ({ ...f, name: a.recipient || f.name, address: a.address || '', city: a.city || '', pincode: a.pincode || '', phone: a.phone || f.phone })); };
  const codAllowed = shopCart.length > 0 && shopCart.every(it => { const pr = products.find(p => p.id === it.id); return pr ? pr.codAvailable !== false : true; });
  const [pay, setPay] = useState(codAllowed ? 'cod' : 'upi');
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');

  const gstRate = parseFloat(business.gstRate) || 0;
  const subtotal = shopCart.reduce((a, it) => a + retailUnitPrice(it, it.qty) * it.qty, 0);
  const discount = shopCart.reduce((a, it) => a + (retailUnitPrice(it, it.qty) - discountedUnitPrice(it, it.qty)) * it.qty, 0);
  const taxable = subtotal - discount;
  const gst = Math.round(taxable * gstRate / 100);
  const shipRaw = (business.deliveryFee == null ? '' : String(business.deliveryFee)).trim();
  const freeAbove = parseFloat(business.freeDeliveryAbove) || 0;
  const delivery = (freeAbove > 0 && taxable >= freeAbove) ? 0 : (shipRaw === '' ? Math.round(taxable * 0.05) : (parseFloat(shipRaw) || 0));
  const total = taxable + gst + delivery;
  const upiId = (business.upiId || '').trim();

  const place = async () => {
    setErr('');
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.pincode.trim()) { setErr('Please fill name, phone, address, city and pincode.'); return; }
    if (pay === 'cod' && !codAllowed) { setErr('Cash on Delivery is not available for some items. Please choose UPI.'); return; }
    setPlacing(true);
    const items = shopCart.map(it => { const orig = retailUnitPrice(it, it.qty); const unit = discountedUnitPrice(it, it.qty); return { id: it.id, code: it.code, name: it.name, size: it.size, color: it.color, qty: it.qty, unit, origUnit: orig, lineTotal: unit * it.qty }; });
    const invoiceNo = `${business.invoicePrefix || 'INV-'}${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const invoice = {
      invoiceNo, date: new Date().toLocaleDateString('en-IN'),
      seller: { name: business.legalName || business.name || '', address: business.address || '', phone: business.phone || '', email: business.email || '', gstin: business.gstin || '' },
      bank: { name: business.bankName || '', acc: business.accountNo || '', ifsc: business.ifsc || '' },
      buyer: { name: form.name.trim(), address: form.address.trim(), city: form.city.trim(), pincode: form.pincode.trim(), phone: form.phone.trim(), email: form.email.trim() },
      hsn: business.hsnCode || '6403', gstRate,
      items: items.map(it => ({ name: it.name, code: it.code, size: it.size, color: it.color, qty: it.qty, rate: it.unit, amount: it.lineTotal })),
      taxable, cgst: gst / 2, sgst: gst / 2, delivery, total,
      paymentLabel: pay === 'cod' ? 'Cash on Delivery' : pay === 'bank' ? 'Bank Transfer (to be confirmed)' : 'UPI (to be confirmed)'
    };
    const order = {
      id: `ord_${Date.now()}`, orderNo: makeOrderNo(), invoiceNo, type: 'order', date: new Date().toISOString(),
      name: form.name.trim(), phone: form.phone.trim(), whatsapp: (form.whatsapp || form.phone).trim(), email: form.email.trim(),
      address: form.address.trim(), city: form.city.trim(), pincode: form.pincode.trim(), note: form.note.trim(),
      items, subtotal, discount, gst, gstRate, delivery, shipping: delivery, total, invoice,
      payment: pay, paymentLabel: pay === 'cod' ? 'Cash on Delivery' : pay === 'bank' ? 'Bank Transfer (to be confirmed)' : 'UPI (to be confirmed)', status: 'new'
    };
    try {
      await onPlaceOrder(order); setDone(order);
      if (customer && customer.access_token && selectedAddrId === 'new' && saveNewAddr && form.address.trim() && form.city.trim() && form.pincode.trim()) {
        try {
          const existing = (customer.profile && Array.isArray(customer.profile.addresses)) ? customer.profile.addresses : [];
          const entry = { id: 'addr_' + Date.now(), recipient: form.name.trim(), label: 'Address', address: form.address.trim(), city: form.city.trim(), pincode: form.pincode.trim(), phone: form.phone.trim(), isDefault: existing.length === 0 };
          await customerAuth.updateProfile(customer.access_token, { addresses: [...existing, entry] });
        } catch (e2) {}
      }
    } catch (e) { setErr('Could not place the order. Please try again or contact us on WhatsApp.'); }
    setPlacing(false);
  };

  if (done) {
    const upiLink = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(business.upiName || business.name || '')}&am=${done.total}&cu=INR` : '';
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 text-center my-auto max-h-[92vh] overflow-y-auto relative overflow-x-hidden" onClick={e => e.stopPropagation()}>
          <div className="absolute inset-x-0 top-0 h-0 pointer-events-none" aria-hidden="true">
            {['#caa043','#1f7a4d','#185fa5','#d4537e','#caa043','#e0533a','#185fa5','#1f7a4d','#caa043','#d4537e'].map((c, i) => (
              <span key={i} className="ws-conf" style={{ left: `${6 + i * 9}%`, background: c, animationDelay: `${(i % 5) * 0.12}s` }}></span>
            ))}
          </div>
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle className="text-green-600" size={32} /></div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Order placed! 🎉</h2>
          <div className="inline-block bg-amber-50 border border-amber-200 text-amber-700 font-mono font-bold px-4 py-1.5 rounded-full mb-3">{done.orderNo}</div>
          <p className="text-slate-600 text-sm mb-4">Total <span className="font-bold">₹{done.total.toLocaleString('en-IN')}</span> · {done.paymentLabel}</p>
          {done.payment === 'upi' && (
            <div className="bg-slate-50 border rounded-xl p-4 text-left text-sm mb-4">
              <div className="font-semibold text-slate-900 mb-1">Pay ₹{done.total.toLocaleString('en-IN')} via UPI</div>
              {upiId ? (<>
                <div className="text-slate-600">UPI ID: <span className="font-mono font-semibold">{upiId}</span></div>
                <div className="my-3 flex flex-col items-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`} alt="Scan to pay via UPI" width="160" height="160" className="rounded-lg border bg-white p-1" />
                  <div className="text-xs text-slate-500 mt-1">Scan with any UPI app to pay (amount pre-filled)</div>
                </div>
                {upiLink && <a href={upiLink} className="inline-block bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold">Open UPI app to pay (on phone)</a>}
                <div className="text-xs text-slate-500 mt-2">On a computer, scan the QR with your phone. After paying, we'll confirm your payment and dispatch your order.</div>
              </>) : <div className="text-slate-600">We'll share UPI payment details on WhatsApp shortly.</div>}
            </div>
          )}
          {done.payment === 'bank' && (
            <div className="bg-slate-50 border rounded-xl p-4 text-left text-sm mb-4">
              <div className="font-semibold text-slate-900 mb-2">Pay ₹{done.total.toLocaleString('en-IN')} by Bank Transfer (NEFT/IMPS)</div>
              {business.bankName ? (<div className="space-y-1 text-slate-700">
                <div>Account name: <span className="font-semibold">{business.legalName || business.name}</span></div>
                <div>Bank: <span className="font-semibold">{business.bankName}</span></div>
                <div>A/C no.: <span className="font-mono font-semibold">{business.accountNo}</span></div>
                <div>IFSC: <span className="font-mono font-semibold">{business.ifsc}</span></div>
              </div>) : <div className="text-slate-600">We'll share our bank details on WhatsApp shortly.</div>}
              <div className="text-xs text-slate-500 mt-2">After transferring, we'll verify your payment and dispatch your order.</div>
            </div>
          )}
          <p className="text-xs text-slate-500 mb-2">We've received your order and will confirm it once payment is verified.{customer ? ' You can see it under My orders.' : ''}</p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 mb-4">After paying, tap <span className="font-semibold">Send payment proof</span> below and send us a screenshot of your payment so we can confirm and dispatch your order.</div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hi, I placed order ${done.orderNo} (Total ₹${done.total}). I'm attaching my payment screenshot.`)}`} target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2"><WhatsAppIcon size={16} /> Send payment proof</a>
            <button onClick={() => window.location.reload()} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-semibold">Done</button>
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
            {shopCart.map(it => { const u = discountedUnitPrice(it, it.qty); return <div key={it.key} className="flex justify-between py-0.5 gap-2"><span className="text-slate-600">{it.name} <span className="text-xs text-slate-400">({it.size}/{it.color}) ×{it.qty}</span></span><span className="font-medium whitespace-nowrap">₹{(u * it.qty).toLocaleString('en-IN')}</span></div>; })}
            <div className="border-t mt-2 pt-2 space-y-0.5">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>−₹{discount.toLocaleString('en-IN')}</span></div>}
              <div className="flex justify-between text-slate-600"><span>GST ({gstRate}%)</span><span>₹{gst.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-slate-600"><span>Shipping</span><span>{delivery ? `₹${delivery.toLocaleString('en-IN')}` : 'Free'}</span></div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-1"><span>Total</span><span>₹{total.toLocaleString('en-IN')}</span></div>
            </div>
          </div>

          <div className="text-sm font-semibold text-slate-900 mb-2">Delivery details</div>
          {savedAddresses.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-2">Choose a saved address</div>
              <div className="flex flex-wrap gap-2">
                {savedAddresses.map(a => (
                  <button key={a.id} type="button" onClick={() => pickAddress(a)} className={`text-left border rounded-lg px-3 py-2 text-xs max-w-[220px] ${selectedAddrId === a.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}>
                    <div className="font-semibold text-slate-800">{a.label || 'Address'}{a.isDefault ? ' · Default' : ''}</div>
                    <div className="text-slate-500 truncate">{a.address}, {a.city} {a.pincode}</div>
                  </button>
                ))}
                <button type="button" onClick={() => { setSelectedAddrId('new'); setForm(f => ({ ...f, address: '', city: '', pincode: '' })); }} className={`border rounded-lg px-3 py-2 text-xs ${selectedAddrId === 'new' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}>+ New address</button>
              </div>
            </div>
          )}
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
          {customer && selectedAddrId === 'new' && (
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-4 cursor-pointer">
              <input type="checkbox" checked={saveNewAddr} onChange={e => setSaveNewAddr(e.target.checked)} />
              Save this address to my account for next time
            </label>
          )}
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
            {business.bankName && business.accountNo && (
              <label className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer ${pay === 'bank' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
                <input type="radio" name="pay" checked={pay === 'bank'} onChange={() => setPay('bank')} />
                <div><div className="text-sm font-medium text-slate-900">Bank Transfer (NEFT/IMPS)</div><div className="text-xs text-slate-500">Pay to our bank account after placing the order</div></div>
              </label>
            )}
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
  const [form, setForm] = useState(() => ({
    name: (customer && customer.profile && customer.profile.name) || '',
    shop: '', city: (customer && customer.profile && customer.profile.city) || '',
    phone: (customer && customer.profile && customer.profile.phone) || '',
    email: (customer && customer.profile && customer.profile.email) || '',
    message: '', sameWhatsapp: true, whatsapp: ''
  }));
  const [submitted, setSubmitted] = useState(false);
  const [submittedNo, setSubmittedNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState({ db: null, sheets: null, email: null });

  const submit = async () => {
    if (!form.name || !form.phone) { showToast('Please fill name and phone'); return; }
    setSubmitting(true);
    const whatsappNumber = form.sameWhatsapp ? form.phone : (form.whatsapp || form.phone);
    const inqNo = await nextInquiryNumber();
    setSubmittedNo(inqNo);
    const inq = { id: `inq_${Date.now()}`, inqNo, ...form, whatsapp: whatsappNumber, products: [...inquiryList], date: new Date().toISOString(), status: 'new', adminComment: '', userId: (customer && customer.profile && customer.profile.id) || '', type: 'inquiry', source: 'Inquiry Form' };
    
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
        <p className="text-xs text-slate-400 mb-6 max-w-md mx-auto">We've emailed you a confirmation. If it's not in your inbox, please check your Spam or Promotions folder and mark it "Not spam" so you don't miss our reply.</p>
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

      {(business.grievanceName || business.grievanceEmail || business.grievancePhone || business.grievanceAddress) && (
        <div className="max-w-2xl mx-auto mt-10 bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-1">Grievance Officer</h3>
          <p className="text-sm text-slate-500 mb-4">For any complaint, you may reach our grievance officer:</p>
          <div className="space-y-2 text-sm text-slate-700">
            {business.grievanceName && <div className="flex gap-2"><span className="text-slate-500 w-20 flex-shrink-0">Name</span><span className="font-medium">{business.grievanceName}</span></div>}
            {business.grievanceEmail && <div className="flex gap-2"><span className="text-slate-500 w-20 flex-shrink-0">Email</span><a href={`mailto:${business.grievanceEmail}`} className="font-medium text-amber-600 break-all">{business.grievanceEmail}</a></div>}
            {business.grievancePhone && <div className="flex gap-2"><span className="text-slate-500 w-20 flex-shrink-0">Phone</span><a href={`tel:${business.grievancePhone}`} className="font-medium">{business.grievancePhone}</a></div>}
            {business.grievanceAddress && <div className="flex gap-2"><span className="text-slate-500 w-20 flex-shrink-0">Address</span><span className="font-medium whitespace-pre-line">{business.grievanceAddress}</span></div>}
          </div>
        </div>
      )}

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
                {f.type !== 'checkbox' && <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}{f.required && ' *'}</label>}
                {f.type === 'checkbox' ? <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form[f.key] !== false} onChange={e => setForm({...form, [f.key]: e.target.checked})} className="w-4 h-4" /> <span className="text-sm font-medium text-slate-700">{f.label}</span></label> : f.type === 'textarea' ? <textarea value={form[f.key] || ''} onChange={e => setForm({...form, [f.key]: e.target.value})} rows="3" className="w-full px-3 py-2 border rounded-lg" placeholder={f.placeholder} /> : f.type === 'number' ? <input type="number" min={f.min} max={f.max} value={form[f.key] ?? ''} onChange={e => setForm({...form, [f.key]: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" placeholder={f.placeholder} /> : <input value={form[f.key] || ''} onChange={e => setForm({...form, [f.key]: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder={f.placeholder} />}
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
function openOrderInvoice(order, business) {
  const items = order.items || [];
  const hasAmounts = items.some(it => it.unit != null || it.lineTotal != null);
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rows = items.map(it => {
    const line = it.lineTotal != null ? it.lineTotal : (it.unit || 0) * (it.qty || 1);
    return `<tr><td>${esc(it.code ? it.code + ' ' : '')}${esc(it.name)}${(it.size || it.color) ? ` <span class="muted">(${esc([it.size, it.color].filter(Boolean).join(' / '))})</span>` : ''}</td><td class="c">${it.qty || 1}</td>${hasAmounts ? `<td class="r">${it.unit != null ? money(it.unit) : '—'}</td><td class="r">${money(line)}</td>` : ''}</tr>`;
  }).join('');
  const cs = hasAmounts ? 3 : 1;
  const addr = esc([order.address, order.city, order.pincode].filter(Boolean).join(', '));
  const sub = order.subtotal != null ? `<tr><td class="r" colspan="${cs}">Subtotal</td><td class="r">${money(order.subtotal)}</td></tr>` : '';
  const gst = (order.gst != null && order.gst !== 0) ? `<tr><td class="r" colspan="${cs}">GST (${order.gstRate || 0}%)</td><td class="r">${money(order.gst)}</td></tr>` : '';
  const del = order.delivery != null ? `<tr><td class="r" colspan="${cs}">Shipping</td><td class="r">${order.delivery ? money(order.delivery) : 'Free'}</td></tr>` : '';
  const disc = (order.discount != null && order.discount !== 0) ? `<tr><td class="r" colspan="${cs}">Discount</td><td class="r">−${money(order.discount)}</td></tr>` : '';
  const foot = hasAmounts
    ? `<tfoot>${sub}${disc}${gst}${del}<tr class="tot"><td class="r" colspan="${cs}">Total</td><td class="r">${money(order.total)}</td></tr></tfoot>`
    : `<tfoot><tr class="tot"><td class="r">Total</td><td class="r">${money(order.total)}</td></tr></tfoot>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.orderNo)}</title><style>*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}body{margin:0;padding:32px;color:#1e293b}.wrap{max-width:720px;margin:0 auto}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:20px}.biz{font-size:20px;font-weight:bold;color:#0f172a}.muted{color:#64748b;font-size:12px;font-weight:normal}h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc;font-size:12px;text-transform:uppercase;color:#64748b}.c{text-align:center}.r{text-align:right}.tot td{font-weight:bold;font-size:15px;border-top:2px solid #0f172a;border-bottom:none}.grid{display:flex;gap:32px;font-size:13px;margin-bottom:8px}.grid h3{font-size:12px;text-transform:uppercase;color:#64748b;margin:0 0 4px}.pay{margin-top:16px;font-size:13px}.ft{margin-top:32px;text-align:center;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px}.btn{display:inline-block;margin:0 0 16px;background:#f59e0b;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer}@media print{.btn{display:none}body{padding:0}}</style></head><body><div class="wrap"><button class="btn" onclick="window.print()">Download / Print PDF</button><div class="head"><div><div class="biz">${esc(business.name)}</div><div class="muted">${esc(business.address)}</div>${business.gstin ? `<div class="muted">GSTIN: ${esc(business.gstin)}</div>` : ''}${business.email ? `<div class="muted">${esc(business.email)}</div>` : ''}${business.phone ? `<div class="muted">${esc(business.phone)}</div>` : ''}</div><div style="text-align:right"><h1>Invoice</h1><div class="muted">${esc(order.orderNo)}</div><div class="muted">${order.date ? new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div></div></div><div class="grid"><div><h3>Bill to</h3><div>${esc(order.name)}</div><div class="muted">${addr}</div>${order.phone ? `<div class="muted">${esc(order.phone)}</div>` : ''}</div><div><h3>Status</h3><div style="text-transform:capitalize">${esc(order.status || 'New')}</div></div></div><table><thead><tr><th>Item</th><th class="c">Qty</th>${hasAmounts ? '<th class="r">Unit</th><th class="r">Amount</th>' : ''}</tr></thead><tbody>${rows}</tbody>${foot}</table><div class="pay">Payment method: <strong>${esc(order.paymentLabel || order.payment)}</strong></div>${order.note ? `<div class="pay">Note: ${esc(order.note)}</div>` : ''}<div class="ft">Thank you for shopping with ${esc(business.name || 'us')}.</div></div><script>setTimeout(function(){window.print();},500);</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups for this site to download the invoice.'); return; }
  w.document.write(html);
  w.document.close();
}

function getMapSrc(business) {
  const rawEmbed = (business.mapEmbedUrl || '').trim();
  let mapSrc = '';
  if (rawEmbed) {
    const m = rawEmbed.match(/src\s*=\s*"([^"]+)"/i);
    mapSrc = m ? m[1] : rawEmbed;
  } else if ((business.mapQuery || '').trim()) {
    mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(business.mapQuery.trim())}&output=embed`;
  }
  return { src: mapSrc, valid: /^https?:\/\//i.test(mapSrc) };
}

function PolicyPage({ title, intro, sections }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">{title}</h1>
      {intro && <p className="text-slate-600 mb-8">{intro}</p>}
      {(sections || []).map((sec, i) => (
        <div key={i} className="mb-8">
          {sec.heading && <h2 className="text-xl font-bold text-slate-900 mb-3">{sec.heading}</h2>}
          <div className="text-slate-600 whitespace-pre-line leading-relaxed">{(sec.text && sec.text.trim()) ? sec.text : 'Content coming soon. The shop owner can add this in the admin panel.'}</div>
        </div>
      ))}
    </div>
  );
}

function CopyableCode({ code, className = '' }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const copy = async (e) => {
    if (e) e.stopPropagation();
    try { await navigator.clipboard.writeText(code); }
    catch (_) { try { const ta = document.createElement('textarea'); ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch (e2) {} }
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="select-all">{code}</span>
      <button type="button" onClick={copy} title="Copy" className="text-slate-400 hover:text-amber-600 active:scale-95">{copied ? <CheckCircle size={13} /> : <Copy size={13} />}</button>
    </span>
  );
}

function OrderFulfill({ row, statuses, onSave }) {
  const o = row.data || {};
  const [status, setStatus] = useState(row.status || 'new');
  const [courier, setCourier] = useState(o.courier || '');
  const [trackingNo, setTrackingNo] = useState(o.trackingNo || '');
  const [trackingLink, setTrackingLink] = useState(o.trackingLink || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStatus(row.status || 'new'); setCourier(o.courier || ''); setTrackingNo(o.trackingNo || ''); setTrackingLink(o.trackingLink || ''); }, [row.id, row.status]);
  const dirty = status !== (row.status || 'new') || courier !== (o.courier || '') || trackingNo !== (o.trackingNo || '') || trackingLink !== (o.trackingLink || '');
  const showShip = status === 'shipped';
  return (
    <div className="w-full mt-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600 flex items-center gap-2">Status:
          <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-2 py-1 text-sm font-medium capitalize">{statuses.map(st => <option key={st} value={st}>{st}</option>)}</select>
        </label>
        {showShip && (<>
          <input value={courier} onChange={e => setCourier(e.target.value)} placeholder="Courier (e.g. Delhivery)" className="border rounded-lg px-2 py-1 text-sm" />
          <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="Tracking no." className="border rounded-lg px-2 py-1 text-sm" />
          <input value={trackingLink} onChange={e => setTrackingLink(e.target.value)} placeholder="Tracking link (https://…)" className="border rounded-lg px-2 py-1 text-sm flex-1 min-w-[160px]" />
        </>)}
        <button type="button" disabled={!dirty || saving} onClick={async () => { setSaving(true); await onSave({ status, courier, trackingNo, trackingLink }); setSaving(false); }} className={`px-3 py-1 rounded-lg text-sm font-semibold ${dirty && !saving ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{saving ? '…' : 'Save & email'}</button>
      </div>
      <div className="text-xs text-slate-400 mt-1">Saving updates the status and emails the customer.{showShip ? ' Tracking details are included in the email.' : ''}</div>
    </div>
  );
}

function OrderStatusControl({ value, statuses, onSave }) {
  const [status, setStatus] = useState(value || 'new');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStatus(value || 'new'); }, [value]);
  const dirty = status !== (value || 'new');
  return (
    <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">Status:
      <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-2 py-1 text-sm font-medium capitalize">{statuses.map(st => <option key={st} value={st}>{st}</option>)}</select>
      <button type="button" disabled={!dirty || saving} onClick={async () => { setSaving(true); await onSave(status); setSaving(false); }} className={`px-3 py-1 rounded-lg text-sm font-semibold ${dirty && !saving ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{saving ? '…' : 'Save'}</button>
    </label>
  );
}

function InquiryStatusControl({ inquiry, onSave }) {
  const norm = s => ['new', 'in progress', 'resolved'].includes(s) ? s : 'new';
  const [status, setStatus] = useState(norm(inquiry.status));
  const [comment, setComment] = useState(inquiry.adminComment || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStatus(norm(inquiry.status)); setComment(inquiry.adminComment || ''); }, [inquiry.id, inquiry.status, inquiry.adminComment]);
  const dirty = status !== norm(inquiry.status) || comment !== (inquiry.adminComment || '');
  return (
    <div className="mt-4 border-t pt-3 space-y-2">
      <div className="flex items-center gap-2"><label className="text-sm text-slate-600">Status:</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm border rounded-lg px-3 py-1 capitalize"><option value="new">New</option><option value="in progress">In Progress</option><option value="resolved">Resolved</option></select>
      </div>
      <div><label className="block text-xs font-medium text-slate-500 mb-1">Comment for customer (shown in their account)</label><textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="e.g., We've received your inquiry and will share a quote shortly." className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
      <button type="button" disabled={!dirty || saving} onClick={async () => { setSaving(true); await onSave(status, comment); setSaving(false); }} className={`text-sm px-4 py-1.5 rounded-lg font-semibold ${dirty && !saving ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{saving ? 'Saving…' : 'Save status & comment'}</button>
    </div>
  );
}

function InquiryCommentBox({ value, onSave }) {
  const [text, setText] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const dirty = text !== (value || '');
  return (
    <div className="mt-4 border-t pt-3">
      <label className="block text-xs font-medium text-slate-500 mb-1">Comment for customer (shown in their account)</label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="e.g., We've received your inquiry and will share a quote shortly." className="w-full border rounded-lg px-3 py-2 text-sm" />
      <button disabled={!dirty || saving} onClick={async () => { setSaving(true); await onSave(text); setSaving(false); }} className={`mt-1 text-sm px-3 py-1.5 rounded-lg font-semibold ${dirty && !saving ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{saving ? 'Saving…' : 'Save comment'}</button>
    </div>
  );
}

function csvEscape(v) {
  var s = (v == null ? '' : String(v));
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCSV(rows) {
  if (!rows || !rows.length) return '';
  var headers = Object.keys(rows[0]);
  var lines = [headers.map(csvEscape).join(',')];
  rows.forEach(function (r) { lines.push(headers.map(function (h) { return csvEscape(r[h]); }).join(',')); });
  return lines.join('\n');
}
function downloadCSV(name, rows) {
  var csv = toCSV(rows);
  var stamp = new Date().toISOString().slice(0, 10);
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name + '-' + stamp + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

const reviewsApi = {
  async listApproved(productId) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=*&approved=eq.true&data->>productId=eq.${encodeURIComponent(productId)}&order=created_at.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      if (!r.ok) return [];
      return await r.json();
    } catch (e) { return []; }
  },
  async submit(review, token) {
    try {
      const id = 'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify([{ id, data: review, approved: false }]) });
      return r.ok;
    } catch (e) { return false; }
  },
  async listAll(adminToken) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=*&order=created_at.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` } });
      if (!r.ok) return [];
      return await r.json();
    } catch (e) { return []; }
  },
  async setApproved(id, approved, adminToken) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${id}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ approved }) });
      return r.ok;
    } catch (e) { return false; }
  },
  async remove(id, adminToken) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` } });
      return r.ok;
    } catch (e) { return false; }
  }
};

function Stars({ value }) {
  const v = Math.round(Number(value) || 0);
  return <span style={{ letterSpacing: '1px' }}>{[1, 2, 3, 4, 5].map(i => <span key={i} className={i <= v ? 'text-amber-500' : 'text-slate-300'}>★</span>)}</span>;
}

function ProductReviews({ productId, productName, customer, onLogin }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const loggedIn = !!(customer && customer.profile && customer.profile.id && customer.access_token);

  useEffect(() => {
    let active = true;
    setLoading(true); setDone(false); setShowForm(false); setRating(0); setText('');
    reviewsApi.listApproved(productId).then(rows => { if (active) { setList(Array.isArray(rows) ? rows : []); setLoading(false); } });
    return () => { active = false; };
  }, [productId]);

  const count = list.length;
  const avg = count ? (list.reduce((a, r) => a + (Number(r.data && r.data.rating) || 0), 0) / count) : 0;

  const submit = async () => {
    setErr('');
    if (!loggedIn) { setErr('Please log in to write a review.'); return; }
    if (!rating) { setErr('Please tap the stars to give a rating.'); return; }
    if (!text.trim()) { setErr('Please write a short review.'); return; }
    setSubmitting(true);
    let verified = false;
    const userId = customer.profile.id;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=data&user_id=eq.${encodeURIComponent(userId)}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${customer.access_token}` } });
      if (r.ok) { const orders = await r.json(); verified = (Array.isArray(orders) ? orders : []).some(o => ((o.data && o.data.items) || []).some(it => String(it.id) === String(productId))); }
    } catch (e) {}
    const review = { productId: String(productId), productName: productName || '', name: (customer.profile.name || 'Customer').trim(), rating: Number(rating), text: text.trim().slice(0, 1000), verified, userId, date: new Date().toISOString() };
    const ok = await reviewsApi.submit(review, customer.access_token);
    setSubmitting(false);
    if (ok) { setDone(true); } else { setErr('Could not submit your review. Please try again.'); }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-900">Customer reviews</h2>
        {count > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">{avg.toFixed(1)}</span>
            <span className="text-lg"><Stars value={avg} /></span>
            <span className="text-sm text-slate-500">({count})</span>
          </div>
        )}
        {!done && (loggedIn
          ? <button onClick={() => setShowForm(s => !s)} className="ml-auto text-sm bg-slate-900 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors">Write a review</button>
          : <button onClick={() => onLogin && onLogin()} className="ml-auto text-sm bg-slate-900 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors">Log in to write a review</button>)}
      </div>

      {done && <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 mb-6">Thank you! Your review has been submitted and will appear here once it's approved.</div>}

      {showForm && loggedIn && !done && (
        <div className="bg-slate-50 border rounded-xl p-4 mb-6">
          <div className="text-sm text-slate-600 mb-3">Posting as <span className="font-semibold text-slate-900">{customer.profile.name || 'your account'}</span></div>
          <div className="text-sm font-medium text-slate-700 mb-1">Your rating</div>
          <div className="flex gap-1 mb-3 text-3xl">
            {[1, 2, 3, 4, 5].map(i => (
              <button key={i} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)} className={(hover || rating) >= i ? 'text-amber-500' : 'text-slate-300'} aria-label={`${i} star${i > 1 ? 's' : ''}`}>★</button>
            ))}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Share your experience with this product *" className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
          {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
          <button onClick={submit} disabled={submitting} className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg font-semibold">{submitting ? 'Submitting…' : 'Submit review'}</button>
          <div className="text-xs text-slate-400 mt-2">Reviews appear after a quick check by our team.</div>
        </div>
      )}

      {loading ? <div className="text-slate-400 text-sm py-6">Loading reviews…</div>
        : count === 0 ? <div className="text-slate-500 text-sm py-6 bg-slate-50 rounded-xl text-center">No reviews yet.{loggedIn ? ' Be the first to review this product.' : ' Log in to be the first to review this product.'}</div>
          : (
            <div className="space-y-3">
              {list.map(r => {
                const d = r.data || {};
                return (
                  <div key={r.id} className="border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{d.name || 'Customer'}</span>
                      {d.verified && d.userId && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={12} /> Verified Purchase</span>}
                      <span className="text-sm ml-auto"><Stars value={d.rating} /></span>
                    </div>
                    <div className="text-sm text-slate-600 leading-relaxed">{d.text}</div>
                    {d.date && <div className="text-xs text-slate-400 mt-1">{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
}

function SizeGuideModal({ business, onClose }) {
  const rows = business.sizeGuideRows || [];
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden my-auto max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <span className="text-white font-semibold">{business.sizeGuideTitle || 'Size guide'}</span>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-slate-300" /></button>
        </div>
        <div className="p-5">
          {rows.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-slate-50">
                <th className="text-left p-2 border font-semibold">UK</th>
                <th className="text-left p-2 border font-semibold">EU</th>
                <th className="text-left p-2 border font-semibold">US</th>
                <th className="text-left p-2 border font-semibold">Foot (cm)</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="p-2 border">{r.uk}</td>
                    <td className="p-2 border">{r.eu}</td>
                    <td className="p-2 border">{r.us}</td>
                    <td className="p-2 border">{r.cm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-sm text-slate-500">Size chart coming soon.</div>}
          {business.sizeGuideNote && <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed"><div className="font-semibold text-slate-700 mb-1">How to measure</div>{business.sizeGuideNote}</div>}
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ business, saveBusiness, products, saveProducts, categories, saveCategories, faqs, saveFaqs, testimonials, saveTestimonials, features, saveFeatures, steps, saveSteps, inquiries, saveInquiries, updateInquiry, adminToken, navigate, showToast, setAdminAuth, logout }) {
  const [tab, setTab] = useState('dashboard');
  const [adminReviews, setAdminReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [adminCustomers, setAdminCustomers] = useState([]);
  const [custLoading, setCustLoading] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const loadAdminCustomers = async () => {
    if (!adminToken) return;
    setCustLoading(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=*&order=created_at.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` } });
      if (r.ok) { const rows = await r.json(); setAdminCustomers(Array.isArray(rows) ? rows : []); }
    } catch (e) {}
    setCustLoading(false);
  };
  useEffect(() => { if (tab === 'customers') loadAdminCustomers(); }, [tab]);
  const loadAdminReviews = async () => {
    if (!adminToken) return;
    setReviewsLoading(true);
    const rows = await reviewsApi.listAll(adminToken);
    setAdminReviews(Array.isArray(rows) ? rows : []);
    setReviewsLoading(false);
  };
  useEffect(() => { if (tab === 'reviews') loadAdminReviews(); }, [tab]);
  const approveReview = async (id, approved) => { const ok = await reviewsApi.setApproved(id, approved, adminToken); if (ok) { setAdminReviews(prev => prev.map(r => r.id === id ? { ...r, approved } : r)); showToast(approved ? 'Review approved ✓' : 'Review hidden'); } else showToast('Could not update review'); };
  const deleteReview = async (id) => { if (!confirm('Delete this review permanently?')) return; const ok = await reviewsApi.remove(id, adminToken); if (ok) { setAdminReviews(prev => prev.filter(r => r.id !== id)); showToast('Review deleted'); } else showToast('Could not delete review'); };
  const [orders, setOrders] = useState([]);
  const [inqSearch, setInqSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [inqPage, setInqPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const ADMIN_PAGE_SIZE = 25;
  useEffect(() => { setInqPage(1); }, [inqSearch, tab]);
  useEffect(() => { setOrderPage(1); }, [orderSearch, tab]);
  const [inqSort, setInqSort] = useState('oldest');
  const [orderSort, setOrderSort] = useState('oldest');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  useEffect(() => {
    if (tab !== 'orders') return;
    if (!adminToken) { setOrdersError('Your admin session needs a fresh login to load orders. Please log out and log in again.'); setOrders([]); return; }
    let cancel = false;
    (async () => {
      setOrdersLoading(true); setOrdersError('');
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const rows = await r.json();
        if (!cancel) setOrders(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancel) setOrdersError('Could not load orders. Check that the admin read policy is set in Supabase (see note below).');
      } finally { if (!cancel) setOrdersLoading(false); }
    })();
    return () => { cancel = true; };
  }, [tab, adminToken]);
  const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  const updateOrderStatus = async (rowId, payload) => {
    const status = (payload && payload.status) || 'new';
    const courier = (payload && payload.courier) || '';
    const trackingNo = (payload && payload.trackingNo) || '';
    const trackingLink = (payload && payload.trackingLink) || '';
    const ord = orders.find(r => r.id === rowId);
    const oldStatus = (ord && ord.status) || 'new';
    const items = (ord && ord.data && ord.data.items) || [];
    const newData = { ...((ord && ord.data) || {}), courier, trackingNo, trackingLink };
    setOrders(prev => prev.map(r => r.id === rowId ? { ...r, status, data: newData } : r));
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(rowId)}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status, data: newData }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Stock: add back when cancelling, subtract again if a cancelled order is re-opened
      if (status === 'cancelled' && oldStatus !== 'cancelled') adjustStockRPC(items, 1, adminToken);
      else if (oldStatus === 'cancelled' && status !== 'cancelled') adjustStockRPC(items, -1, adminToken);
      syncStatusToSheet({ type: 'order', id: rowId, humanId: (ord && ord.data && ord.data.orderNo) || '', status, email: (ord && ord.data && ord.data.email) || '', name: (ord && ord.data && ord.data.name) || '', courier, trackingNo, trackingLink, inv: (ord && ord.data && ord.data.invoice) || null });
      showToast('Order updated — customer emailed ✓');
    } catch (e) { showToast('Could not update status — check the Supabase update policy'); }
  };
  const [editingProduct, setEditingProduct] = useState(null);
  const [editBiz, setEditBiz] = useState(business);
  const [invoiceFor, setInvoiceFor] = useState(null);
  const blankProduct = { id: '', code: '', name: '', category: categories[0]?.id || '', image: '', images: [''], sizes: ['6','7','8','9','10','11'], colors: ['Black'], material: '', priceFrom: '', isNew: false, isBestseller: false, active: true, outOfStock: false, codAvailable: true, description: '', availabilityNote: '', retailPrice: '', discountPercent: '', qtyBreaks: [{ minQty: 11, price: '' }], stockGrid: {} };
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
    { id: 'proforma', label: 'Proforma', icon: FileText },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
    { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'features', label: 'Why Choose Us', icon: Sparkles },
    { id: 'steps', label: 'How to Order', icon: ListChecks },
    { id: 'business', label: 'Business Info', icon: Settings },
    { id: 'integrations', label: 'Integrations', icon: CheckCircle },
    { id: 'export', label: 'Export / Backup', icon: Download },
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
            {(() => {
              const THRESHOLD = 5;
              const low = [];
              (products || []).forEach(p => {
                const g = (p && p.stockGrid) || {};
                Object.keys(g).forEach(k => {
                  const qty = parseInt(g[k]) || 0;
                  if (qty <= THRESHOLD) { const [size, color] = k.split('|'); low.push({ name: p.name, code: p.code, size, color, qty }); }
                });
              });
              low.sort((a, b) => a.qty - b.qty);
              return (
                <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
                  <div className="flex items-center gap-2 mb-4"><TrendingUp size={18} className="text-amber-500" /><h2 className="text-lg font-bold text-slate-900">Low stock</h2><span className="text-sm text-slate-500">items at or below {THRESHOLD}</span></div>
                  {low.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">Everything is well stocked 👍</div>
                  ) : (
                    <div className="divide-y">
                      {low.slice(0, 50).map((it, idx) => (
                        <div key={idx} className="py-2.5 flex items-center gap-3 text-sm">
                          <span className="font-medium text-slate-900">{it.name || it.code}</span>
                          <span className="text-slate-500">{[it.size, it.color].filter(Boolean).join(' · ')}</span>
                          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium ${it.qty === 0 ? 'bg-red-100 text-red-700' : it.qty <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{it.qty === 0 ? 'Out of stock' : `${it.qty} left`}</span>
                        </div>
                      ))}
                      {low.length > 50 && <div className="pt-3 text-xs text-slate-400">+ {low.length - 50} more…</div>}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'customers' && (() => {
          const q = custSearch.trim().toLowerCase();
          const rows = adminCustomers.map(c => ({ id: c.id, ...(c.data || {}), created_at: c.created_at }))
            .filter(c => !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q));
          return (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
                <span className="text-sm text-slate-500">{adminCustomers.length} registered</span>
                <button onClick={loadAdminCustomers} className="ml-auto text-sm border px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Loader2 size={14} className={custLoading ? 'animate-spin' : ''} /> Refresh</button>
              </div>
              <p className="text-slate-600 mb-4 text-sm max-w-2xl">These are customers who created an account. The list fills automatically as customers register or log in. (Guests who order without an account aren't listed here — their details are on each order.)</p>
              <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Search by name, email, phone, city" className="w-full max-w-md px-3 py-2 border rounded-lg mb-4 text-sm" />
              {custLoading && adminCustomers.length === 0 ? <div className="text-slate-400 py-8">Loading customers…</div>
                : rows.length === 0 ? <div className="bg-white rounded-xl p-12 text-center text-slate-500"><Users size={48} className="mx-auto mb-3 opacity-50" />{adminCustomers.length === 0 ? 'No registered customers yet.' : 'No matches for your search.'}</div>
                  : (
                    <div className="bg-white rounded-xl border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50 text-left">
                          <th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Email</th><th className="p-3 font-medium">Phone</th><th className="p-3 font-medium">WhatsApp</th><th className="p-3 font-medium">City</th><th className="p-3 font-medium">Joined</th><th className="p-3"></th>
                        </tr></thead>
                        <tbody>
                          {rows.map(c => (
                            <tr key={c.id} className="border-t">
                              <td className="p-3 font-medium text-slate-900">{c.name || '—'}</td>
                              <td className="p-3 text-slate-600">{c.email || '—'}</td>
                              <td className="p-3 text-slate-600">{c.phone || '—'}</td>
                              <td className="p-3 text-slate-600">{c.whatsapp || '—'}</td>
                              <td className="p-3 text-slate-600">{c.city || '—'}</td>
                              <td className="p-3 text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                              <td className="p-3">{(c.whatsapp || c.phone) && <a href={`https://wa.me/${(c.whatsapp || c.phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded text-xs whitespace-nowrap">WhatsApp</a>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
            </div>
          );
        })()}

        {tab === 'reviews' && (() => {
          const pending = adminReviews.filter(r => !r.approved);
          const approved = adminReviews.filter(r => r.approved);
          const card = (r) => {
            const d = r.data || {};
            return (
              <div key={r.id} className="bg-white border rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{d.name || 'Customer'}</span>
                  {d.verified && d.userId
                    ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Verified buyer</span>
                    : <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">Not verified</span>}
                  <span className="text-xs text-slate-400">· {d.productName || d.productId}</span>
                  <span className="text-sm ml-auto"><Stars value={d.rating} /></span>
                </div>
                <div className="text-sm text-slate-600 leading-relaxed mb-2">{d.text}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {d.date && <span className="text-xs text-slate-400 mr-auto">{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {!r.approved
                    ? <button onClick={() => approveReview(r.id, true)} className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">Approve</button>
                    : <button onClick={() => approveReview(r.id, false)} className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded">Hide</button>}
                  <button onClick={() => deleteReview(r.id)} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded hover:bg-red-100">Delete</button>
                </div>
              </div>
            );
          };
          return (
            <div>
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <h1 className="text-3xl font-bold text-slate-900">Reviews</h1>
                <button onClick={loadAdminReviews} className="text-sm border px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Loader2 size={14} className={reviewsLoading ? 'animate-spin' : ''} /> Refresh</button>
              </div>
              <p className="text-slate-600 mb-6 text-sm max-w-2xl">New reviews stay hidden until you approve them. Approved reviews show on the product page. "Verified buyer" means the reviewer was logged in and had ordered that product.</p>
              {reviewsLoading && adminReviews.length === 0 ? <div className="text-slate-400 py-8">Loading reviews…</div> : (
                <>
                  <h2 className="text-sm font-semibold text-slate-700 mb-2">Pending approval ({pending.length})</h2>
                  {pending.length === 0 ? <div className="bg-white rounded-xl p-6 text-center text-slate-400 text-sm mb-6">Nothing waiting for approval.</div> : <div className="mb-6">{pending.map(card)}</div>}
                  <h2 className="text-sm font-semibold text-slate-700 mb-2">Approved & live ({approved.length})</h2>
                  {approved.length === 0 ? <div className="bg-white rounded-xl p-6 text-center text-slate-400 text-sm">No approved reviews yet.</div> : <div>{approved.map(card)}</div>}
                </>
              )}
            </div>
          );
        })()}

        {tab === 'export' && (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Export / Backup</h1>
            <p className="text-slate-600 mb-6 max-w-2xl text-sm">Download a copy of your data as CSV (opens in Excel / Google Sheets). Keep these files somewhere safe (your computer or Google Drive) as a backup. Each file is named with today's date.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6 max-w-2xl">Order and inquiry files contain customer details (names, phones, addresses). Keep them private.</div>
            <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
              <button onClick={() => downloadCSV('products', (products || []).map(p => ({ id: p.id, code: p.code, name: p.name, category: (categories.find(c => c.id === p.category) || {}).name || p.category || '', retailPrice: p.retailPrice, discountPercent: p.discountPercent, sizes: (p.sizes || []).join(' | '), colors: (p.colors || []).join(' | '), totalStock: productTotalStock(p), active: p.active !== false ? 'yes' : 'no', isNew: p.isNew ? 'yes' : '', isBestseller: p.isBestseller ? 'yes' : '', outOfStock: p.outOfStock ? 'yes' : '', image: p.image || '' })))} className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 hover:bg-amber-50 text-left"><span className="font-medium text-slate-800">Products ({(products || []).length})</span><Download size={18} className="text-amber-600" /></button>

              <button onClick={async () => { try { const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}` } }); const rows = await r.json(); const flat = (Array.isArray(rows) ? rows : []).map(o => { const d = o.data || {}; return { orderNo: d.orderNo || '', invoiceNo: d.invoiceNo || '', date: d.date || '', status: o.status || '', name: d.name || '', phone: d.phone || '', email: d.email || '', address: d.address || '', city: d.city || '', pincode: d.pincode || '', items: (d.items || []).map(i => `${i.code || ''} ${i.size || ''}/${i.color || ''} x${i.qty || 1}`).join(' | '), subtotal: d.subtotal || '', gst: d.gst || '', delivery: d.delivery || '', total: d.total || '', payment: d.paymentLabel || d.payment || '' }; }); if (!flat.length) { showToast('No orders to export'); return; } downloadCSV('orders', flat); } catch (e) { showToast('Could not export orders — try again'); } }} className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 hover:bg-amber-50 text-left"><span className="font-medium text-slate-800">Orders</span><Download size={18} className="text-amber-600" /></button>

              <button onClick={() => { const flat = (inquiries || []).map(q => ({ inqNo: q.inqNo || '', date: q.date || '', status: q.status || '', name: q.name || '', shop: q.shop || '', city: q.city || '', phone: q.phone || '', email: q.email || '', message: q.message || '', products: (q.products || []).map(p => `${p.code || ''} ${p.name || ''} x${p.quantity || 1}`).join(' | ') })); if (!flat.length) { showToast('No inquiries to export'); return; } downloadCSV('inquiries', flat); }} className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 hover:bg-amber-50 text-left"><span className="font-medium text-slate-800">Inquiries ({(inquiries || []).length})</span><Download size={18} className="text-amber-600" /></button>

              <button onClick={() => downloadCSV('categories', (categories || []).map(c => ({ id: c.id, name: c.name, icon: c.icon || '' })))} className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 hover:bg-amber-50 text-left"><span className="font-medium text-slate-800">Categories ({(categories || []).length})</span><Download size={18} className="text-amber-600" /></button>

              <button onClick={() => downloadCSV('faqs', (faqs || []).map(f => ({ question: f.question || f.q || '', answer: f.answer || f.a || '' })))} className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 hover:bg-amber-50 text-left"><span className="font-medium text-slate-800">FAQs ({(faqs || []).length})</span><Download size={18} className="text-amber-600" /></button>

              <button onClick={() => downloadCSV('testimonials', (testimonials || []).map(t => ({ name: t.name || '', role: t.role || t.location || '', text: t.text || t.quote || '', rating: t.rating || '', active: t.active !== false ? 'yes' : 'no' })))} className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 hover:bg-amber-50 text-left"><span className="font-medium text-slate-800">Testimonials ({(testimonials || []).length})</span><Download size={18} className="text-amber-600" /></button>

              <button onClick={() => downloadCSV('business-settings', Object.keys(business || {}).map(k => ({ field: k, value: typeof business[k] === 'object' ? JSON.stringify(business[k]) : business[k] })))} className="flex items-center justify-between gap-2 border rounded-lg px-4 py-3 hover:bg-amber-50 text-left sm:col-span-2"><span className="font-medium text-slate-800">Business settings</span><Download size={18} className="text-amber-600" /></button>
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
                    const ah = { apikey: SUPABASE_KEY, Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
                    const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, { method: 'POST', headers: { ...ah, 'Prefer': 'return=minimal' }, body: JSON.stringify([{ id: testId, data: { test: true }, status: 'test' }]) });
                    if (r.ok) {
                      tests.push('✅ Supabase Write: Working');
                      await fetch(`${SUPABASE_URL}/rest/v1/inquiries?id=eq.${testId}`, { method: 'DELETE', headers: ah });
                    } else tests.push(`❌ Supabase Write: HTTP ${r.status} - ${(await r.text()).slice(0,150)}`);
                  } catch (e) { tests.push(`❌ Supabase Write: ${e.message}`); }
                  
                  // Test Google Sheets
                  try {
                    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ test: true }) });
                    tests.push('🟡 Google Sheets: Request sent (cannot verify - works on real deployment)');
                  } catch (e) { tests.push(`❌ Google Sheets: ${e.message} (blocked in artifact)`); }
                  
                  // Email now goes through Google Apps Script (Sheet) — Web3Forms removed
                  tests.push('ℹ️ Emails are sent free by Google Apps Script when a row reaches the Sheet. Test by placing a real order/inquiry.');
                  
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
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Discount (%)</label><input type="number" min="0" max="90" value={pForm.discountPercent || ''} onChange={e => setPForm({...pForm, discountPercent: e.target.value})} placeholder="blank = no discount, e.g. 10" className="w-full px-3 py-2 border rounded-lg" /><div className="text-xs text-slate-500 mt-1">Leave blank for no discount. Shows a struck-through price and the discounted price to customers.</div></div>
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

        {(tab === 'inquiries' || tab === 'proforma') && (() => {
          const isProforma = tab === 'proforma';
          const q = inqSearch.trim().toLowerCase();
          const list = sortRecords(inquiries.filter(i => isProforma ? i.type === 'proforma' : i.type !== 'proforma').filter(i => !q || (i.name || '').toLowerCase().includes(q) || (i.inqNo || '').toLowerCase().includes(q)), inqSort, i => i.date, i => i.name, i => i.status);
          const safeInqPage = Math.min(inqPage, Math.max(1, Math.ceil(list.length / ADMIN_PAGE_SIZE)));
          const inqPageList = list.slice((safeInqPage - 1) * ADMIN_PAGE_SIZE, safeInqPage * ADMIN_PAGE_SIZE);
          return (
          <div>
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap"><h1 className="text-3xl font-bold text-slate-900">{isProforma ? 'Proforma Leads' : 'Inquiries'} ({list.length})</h1><div className="flex gap-2 flex-wrap"><input value={inqSearch} onChange={e => setInqSearch(e.target.value)} placeholder={isProforma ? 'Search name or no.' : 'Search name or inquiry no.'} className="px-3 py-2 border rounded-lg text-sm w-56 max-w-full" /><select value={inqSort} onChange={e => setInqSort(e.target.value)} className="px-3 py-2 border rounded-lg text-sm"><option value="oldest">Oldest first</option><option value="newest">Newest first</option><option value="status">By status</option><option value="name">Name (A–Z)</option></select></div></div>
            <div className="space-y-4">
              {inqPageList.map(i => (
                <div key={i.id} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                    <div>
                      {i.inqNo && <div className="text-xs font-mono font-bold text-amber-600 mb-0.5"><CopyableCode code={i.inqNo} /></div>}
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">{i.name}{i.source === 'Proforma Download' && <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><FileText size={11} /> Proforma Lead</span>}{i.type === 'appointment' && <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={11} /> Appointment</span>}</h3>
                      {i.type === 'appointment' && (i.apptDate || i.apptTime) && <div className="text-sm text-purple-700 font-medium mt-1">📅 {i.apptDate}{i.apptTime ? ` at ${i.apptTime}` : ''}</div>}
                      <div className="text-sm text-slate-600">{i.shop || 'No shop'} • {i.city || 'No city'}</div>
                      <div className="text-sm text-slate-500 mt-1">📞 {i.phone} {i.whatsapp && i.whatsapp !== i.phone && `• 💬 ${i.whatsapp}`} {i.email && `• ✉️ ${i.email}`}</div>
                    </div>
                    <div className="text-right">
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
                  <InquiryStatusControl inquiry={i} onSave={(status, comment) => updateInquiry(i.id, status, comment)} />
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <a href={`tel:${i.phone}`} className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">📞 Call</a>
                    {(i.whatsapp || i.phone) && <a href={`https://wa.me/${(i.whatsapp || i.phone + '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">💬 WhatsApp</a>}
                    {i.email && <a href={`mailto:${i.email}`} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded hover:bg-blue-100">✉️ Email</a>}
                    {i.products && i.products.length > 0 && <button onClick={() => setInvoiceFor(i)} className="text-sm bg-amber-50 text-amber-700 px-3 py-1 rounded hover:bg-amber-100 flex items-center gap-1"><FileText size={14} /> Generate GST Invoice</button>}
                    <button onClick={() => { if (confirm('Delete?')) saveInquiries(inquiries.filter(x => x.id !== i.id)); }} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded hover:bg-red-100 ml-auto">Delete</button>
                  </div>
                </div>
              ))}
              {list.length === 0 && <div className="bg-white rounded-xl p-12 text-center text-slate-500"><Inbox size={48} className="mx-auto mb-3 opacity-50" />{inqSearch ? 'No matches for your search' : (isProforma ? 'No proforma leads yet' : 'No inquiries yet')}</div>}
            </div>
            <AdminPager page={safeInqPage} pageSize={ADMIN_PAGE_SIZE} total={list.length} onPage={setInqPage} />
          </div>
          );
        })()}

        {tab === 'orders' && (() => {
          const q = orderSearch.trim().toLowerCase();
          const list = sortRecords(orders.filter(row => { const o = row.data || {}; return !q || (o.name || '').toLowerCase().includes(q) || (o.orderNo || '').toLowerCase().includes(q); }), orderSort, r => (r.data || {}).date || r.created_at, r => (r.data || {}).name, r => r.status);
          const safeOrderPage = Math.min(orderPage, Math.max(1, Math.ceil(list.length / ADMIN_PAGE_SIZE)));
          const orderPageList = list.slice((safeOrderPage - 1) * ADMIN_PAGE_SIZE, safeOrderPage * ADMIN_PAGE_SIZE);
          return (
          <div>
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap"><h1 className="text-3xl font-bold text-slate-900">Orders ({list.length})</h1><div className="flex gap-2 flex-wrap"><input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Search name or order no." className="px-3 py-2 border rounded-lg text-sm w-56 max-w-full" /><select value={orderSort} onChange={e => setOrderSort(e.target.value)} className="px-3 py-2 border rounded-lg text-sm"><option value="oldest">Oldest first</option><option value="newest">Newest first</option><option value="status">By status</option><option value="name">Name (A–Z)</option></select></div></div>
            {ordersError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">{ordersError}</div>}
            {ordersLoading && <div className="bg-white rounded-xl p-12 text-center text-slate-500">Loading orders…</div>}
            {!ordersLoading && !ordersError && list.length === 0 && <div className="bg-white rounded-xl p-12 text-center text-slate-500"><ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />{orderSearch ? 'No orders match your search' : 'No orders yet'}</div>}
            <div className="space-y-4">
              {orderPageList.map(row => { const o = row.data || {}; return (
                <div key={row.id} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                    <div>
                      <div className="font-mono font-bold text-amber-600"><CopyableCode code={o.orderNo} /></div>
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
                    {o.discount > 0 && <span>Discount −₹{Number(o.discount).toLocaleString('en-IN')}</span>}
                    <span>GST ({o.gstRate}%) ₹{Number(o.gst || 0).toLocaleString('en-IN')}</span>
                    <span>Shipping {o.delivery ? `₹${Number(o.delivery).toLocaleString('en-IN')}` : 'Free'}</span>
                    {o.note && <span>Note: {o.note}</span>}
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap items-center">
                    <a href={`tel:${o.phone}`} className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">📞 Call</a>
                    {(o.whatsapp || o.phone) && <a href={`https://wa.me/${(o.whatsapp || o.phone + '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">💬 WhatsApp</a>}
                    <OrderFulfill row={row} statuses={ORDER_STATUSES} onSave={(payload) => updateOrderStatus(row.id, payload)} />
                  </div>
                </div>
              ); })}
            </div>
            <AdminPager page={safeOrderPage} pageSize={ADMIN_PAGE_SIZE} total={list.length} onPage={setOrderPage} />
          </div>
          );
        })()}

        {tab === 'faqs' && <CrudListEditor title="FAQs" icon={HelpCircle} items={faqs} onSave={async (l) => { await saveFaqs(l); showToast('FAQs updated ✓'); }} itemLabel="FAQ" idPrefix="faq" fields={[{ key: 'q', label: 'Question', required: true }, { key: 'a', label: 'Answer', required: true, type: 'textarea' }]} renderItem={(item) => (<div><div className="font-semibold text-slate-900 mb-1">{item.q}</div><div className="text-sm text-slate-600 line-clamp-2">{item.a}</div></div>)} />}

        {tab === 'testimonials' && <CrudListEditor title="Testimonials" icon={MessageSquare} items={testimonials} onSave={async (l) => { await saveTestimonials(l); showToast('Testimonials updated ✓'); }} itemLabel="Testimonial" idPrefix="test" fields={[{ key: 'name', label: 'Customer Name', required: true }, { key: 'shop', label: 'Shop Name' }, { key: 'city', label: 'City' }, { key: 'content', label: 'Testimonial Content', required: true, type: 'textarea' }, { key: 'rating', label: 'Rating (1-5)', type: 'number', required: true, min: 1, max: 5, default: 5 }, { key: 'active', label: 'Show on site', type: 'checkbox', default: true }]} renderItem={(item) => (<div><div className="flex items-center gap-2 mb-1"><div className="font-semibold text-slate-900">{item.name}</div><div className="text-amber-400 text-sm">{'★'.repeat(item.rating || 5)}</div>{item.active === false && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">Hidden</span>}</div><div className="text-xs text-slate-500 mb-1">{item.shop}{item.shop && item.city && ' • '}{item.city}</div><div className="text-sm text-slate-600 line-clamp-2 italic">"{item.content}"</div></div>)} />}

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
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Logo Image URL (optional)</label><input value={editBiz.logoImage || ''} onChange={e => setEditBiz({...editBiz, logoImage: e.target.value})} placeholder="https://... (leave blank to use logo text)" className="w-full px-3 py-2 border rounded-lg" />{editBiz.logoImage && <img src={directImageUrl(editBiz.logoImage)} alt="logo preview" className="mt-2 w-16 h-16 rounded-lg object-cover border" />}<div className="text-xs text-slate-500 mt-1">If set, this image replaces the text logo in the header & footer.</div></div>
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
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Shipping Fee (₹)</label><input type="number" value={editBiz.deliveryFee ?? ''} onChange={e => setEditBiz({...editBiz, deliveryFee: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="blank = 5% of order" /><div className="text-xs text-slate-500 mt-1">Leave blank to charge 5% of the order as shipping. Enter a number for a flat fee (0 = free).</div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Free Shipping Above (₹)</label><input type="number" value={editBiz.freeDeliveryAbove || ''} onChange={e => setEditBiz({...editBiz, freeDeliveryAbove: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 999" /><div className="text-xs text-slate-500 mt-1">Order amount at/above this = free shipping. 0 = always charge shipping.</div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">UPI ID (for online payment)</label><input value={editBiz.upiId || ''} onChange={e => setEditBiz({...editBiz, upiId: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., yourname@okhdfc" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">UPI Payee Name</label><input value={editBiz.upiName || ''} onChange={e => setEditBiz({...editBiz, upiName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Name shown in customer's UPI app" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Payment Note (shown to buyers)</label><input value={editBiz.paymentNote || ''} onChange={e => setEditBiz({...editBiz, paymentNote: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Payment via UPI / bank transfer on order confirmation. GST invoice provided." /><div className="text-xs text-slate-500 mt-1">A short line shown on the inquiry cart and contact page. You can include your UPI ID here if you like.</div></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Google Maps — Address or Coordinates</label><input value={editBiz.mapQuery || ''} onChange={e => setEditBiz({...editBiz, mapQuery: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 12 MG Road, Agra, UP 282001  (or  27.1767,78.0081)" /><div className="text-xs text-slate-500 mt-1">Shows a map on the contact page. For a precise pin, use the embed link field below instead.</div></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Google Maps Embed Link (optional, more precise)</label><input value={editBiz.mapEmbedUrl || ''} onChange={e => setEditBiz({...editBiz, mapEmbedUrl: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder='Paste the src link from Google Maps → Share → Embed a map' /><div className="text-xs text-slate-500 mt-1">In Google Maps: find your shop → Share → "Embed a map" → copy the link inside src="...". Overrides the address above.</div></div>
                  <div className="md:col-span-2 mt-2 pt-4 border-t"><h3 className="font-bold text-slate-900 mb-1">Size Guide</h3><div className="text-xs text-slate-500 mb-3">Shown via a "Size guide" link on every product page. Edit the rows to match how your footwear actually fits. The Foot (cm) column is the most reliable guide for customers.</div></div>
                  <div className="md:col-span-2 flex items-center gap-2"><input type="checkbox" id="sgToggle" checked={editBiz.sizeGuideEnabled !== false} onChange={e => setEditBiz({ ...editBiz, sizeGuideEnabled: e.target.checked })} /><label htmlFor="sgToggle" className="text-sm font-medium text-slate-700">Show the size guide on product pages</label></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Size guide title</label><input value={editBiz.sizeGuideTitle || ''} onChange={e => setEditBiz({ ...editBiz, sizeGuideTitle: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Men's footwear size guide" /></div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Size chart</label>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse mb-2">
                        <thead><tr className="bg-slate-50">
                          <th className="p-2 border text-left font-medium">UK</th><th className="p-2 border text-left font-medium">EU</th><th className="p-2 border text-left font-medium">US</th><th className="p-2 border text-left font-medium">Foot (cm)</th><th className="p-2 border"></th>
                        </tr></thead>
                        <tbody>
                          {(editBiz.sizeGuideRows || []).map((row, idx) => {
                            const upd = (field, val) => { const rows = [...(editBiz.sizeGuideRows || [])]; rows[idx] = { ...rows[idx], [field]: val }; setEditBiz({ ...editBiz, sizeGuideRows: rows }); };
                            return (
                              <tr key={idx}>
                                <td className="p-1 border"><input value={row.uk || ''} onChange={e => upd('uk', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                                <td className="p-1 border"><input value={row.eu || ''} onChange={e => upd('eu', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                                <td className="p-1 border"><input value={row.us || ''} onChange={e => upd('us', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                                <td className="p-1 border"><input value={row.cm || ''} onChange={e => upd('cm', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                                <td className="p-1 border text-center"><button type="button" onClick={() => { const rows = (editBiz.sizeGuideRows || []).filter((_, i) => i !== idx); setEditBiz({ ...editBiz, sizeGuideRows: rows }); }} className="text-red-600 hover:text-red-700"><Trash2 size={15} /></button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <button type="button" onClick={() => setEditBiz({ ...editBiz, sizeGuideRows: [...(editBiz.sizeGuideRows || []), { uk: '', eu: '', us: '', cm: '' }] })} className="text-sm border px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Plus size={14} /> Add row</button>
                  </div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">"How to measure" note</label><textarea value={editBiz.sizeGuideNote || ''} onChange={e => setEditBiz({ ...editBiz, sizeGuideNote: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

                  <div className="md:col-span-2 mt-2 pt-4 border-t"><h3 className="font-bold text-slate-900 mb-1">Info & Policy Pages</h3><div className="text-xs text-slate-500 mb-3">These appear as pages linked in the website footer. Edit the wording to match your business. For Privacy and Terms, please review with a professional — these are starting templates, not legal advice.</div></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">How to Order</label><textarea value={editBiz.howToOrder || ''} onChange={e => setEditBiz({...editBiz, howToOrder: e.target.value})} rows={6} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Shipping &amp; Delivery</label><textarea value={editBiz.shippingPolicy || ''} onChange={e => setEditBiz({...editBiz, shippingPolicy: e.target.value})} rows={5} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Returns &amp; Refunds</label><textarea value={editBiz.returnsPolicy || ''} onChange={e => setEditBiz({...editBiz, returnsPolicy: e.target.value})} rows={6} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Privacy Policy</label><textarea value={editBiz.privacyPolicy || ''} onChange={e => setEditBiz({...editBiz, privacyPolicy: e.target.value})} rows={7} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Terms &amp; Conditions</label><textarea value={editBiz.termsPolicy || ''} onChange={e => setEditBiz({...editBiz, termsPolicy: e.target.value})} rows={7} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Cancellation Policy</label><textarea value={editBiz.cancellationPolicy || ''} onChange={e => setEditBiz({...editBiz, cancellationPolicy: e.target.value})} rows={6} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="md:col-span-2 mt-2 pt-4 border-t"><h3 className="font-bold text-slate-900 mb-1">Grievance Officer &amp; Legal (optional)</h3><div className="text-xs text-slate-500 mb-3">For India e-commerce rules. The Grievance Officer block shows on the Contact page only when you fill at least one field below — until then nothing appears. You can use a role label instead of a personal name (e.g., "Grievance Officer, {business.name}").</div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Grievance Officer Name / Label</label><input value={editBiz.grievanceName || ''} onChange={e => setEditBiz({...editBiz, grievanceName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Grievance Officer" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Grievance Email</label><input value={editBiz.grievanceEmail || ''} onChange={e => setEditBiz({...editBiz, grievanceEmail: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., support@yourdomain.com" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Grievance Phone</label><input value={editBiz.grievancePhone || ''} onChange={e => setEditBiz({...editBiz, grievancePhone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., +91 8218596945" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Grievance / Business Address (optional)</label><textarea value={editBiz.grievanceAddress || ''} onChange={e => setEditBiz({...editBiz, grievanceAddress: e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Leave blank to hide" /></div>
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
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Customers</label><input value={editBiz.retailers || ''} onChange={e => setEditBiz({...editBiz, retailers: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
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
// ===== SEO helpers (purely additive: title, meta, canonical, structured data) =====
function seoSetMeta(name, content) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
  el.setAttribute('content', content || '');
}
function seoSetProp(prop, content) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[property="${prop}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
  el.setAttribute('content', content || '');
}
function seoSetCanonical(href) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', href || '');
}
function seoSetJsonLd(id, obj) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(id);
  if (!obj) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = id; document.head.appendChild(el); }
  try { el.textContent = JSON.stringify(obj); } catch (e) {}
}

export default function App() {
  const [page, setPage] = useState('home');
  const [history, setHistory] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pendingProductId, setPendingProductId] = useState(null);
  const [pendingCategorySlug, setPendingCategorySlug] = useState(null);
  const routingReady = useRef(false);
  const [inquiryList, setInquiryList] = useState([]);
  const [shopCart, setShopCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [cartTab, setCartTab] = useState('cart');
  const [buySel, setBuySel] = useState({ size: '', color: '', qty: 1 });
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [cartPop, setCartPop] = useState(false);
  const cartCount = shopCart.reduce((a, it) => a + it.qty, 0) + inquiryList.length;
  const prevCartCount = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prevCartCount.current) { setCartPop(true); const t = setTimeout(() => setCartPop(false), 480); prevCartCount.current = cartCount; return () => clearTimeout(t); }
    prevCartCount.current = cartCount;
  }, [cartCount]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [wishlist, setWishlist] = useState([]);
  const [recentIds, setRecentIds] = useState([]);
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [dark, setDark] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  const [customer, setCustomer] = useState(null); // { access_token, refresh_token, profile }
  const [showAccount, setShowAccount] = useState(false);
  const [recovery, setRecovery] = useState(null);
  useEffect(() => {
    try {
      const h = window.location.hash || '';
      if (h.includes('type=recovery') && h.includes('access_token=')) {
        const params = new URLSearchParams(h.replace(/^#/, ''));
        const at = params.get('access_token');
        const rt = params.get('refresh_token');
        if (at) setRecovery({ accessToken: at, refreshToken: rt || '' });
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
      }
    } catch (e) {}
  }, []);
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
    setWishlist(local => Array.from(new Set([...(Array.isArray(local) ? local : []), ...(Array.isArray(m.wishlist) ? m.wishlist : [])])));
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
    // Reduce stock for what was bought (server-side, safe) + reflect locally right away
    adjustStockRPC(o.items, -1, token);
    setProducts(prev => prev.map(p => {
      const its = (o.items || []).filter(it => it.id === p.id);
      if (!its.length) return p;
      const g = { ...(p.stockGrid || {}) };
      its.forEach(it => { const k = `${it.size || ''}|${it.color || ''}`; g[k] = Math.max(0, (parseInt(g[k]) || 0) - (parseInt(it.qty) || 0)); });
      return { ...p, stockGrid: g };
    }));
    setShopCart([]);
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
        .then(d => { applyCustomerSession(d); if (d && d.user) syncCustomerToSupabase(customerProfile(d.user), d.access_token); })
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

  const wishSyncTimer = useRef(null);
  const wishSyncReady = useRef(false);
  useEffect(() => {
    if (!wishSyncReady.current) { wishSyncReady.current = true; return; }
    if (!customer || !customer.access_token) return;
    clearTimeout(wishSyncTimer.current);
    wishSyncTimer.current = setTimeout(() => { customerAuth.saveWishlist(customer.access_token, wishlist); }, 1500);
    return () => clearTimeout(wishSyncTimer.current);
  }, [wishlist, customer]);

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
  const loadInquiriesAsAdmin = async () => {
    const tok = adminTokenRef.current;
    if (!tok) return;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}` } });
      if (!r.ok) return;
      const rows = await r.json();
      if (Array.isArray(rows)) setInquiries(rows.map(x => ({ ...x.data, status: x.status })));
    } catch (e) {}
  };
  useEffect(() => { if (adminAuth && adminToken) loadInquiriesAsAdmin(); }, [adminAuth, adminToken]);
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
        const [bizRows, prodRows, catRows, faqRows, testRows, featRows, stepRows] = await Promise.all([
          sb.select('business_info').catch(e => { console.error('business_info:', e); return []; }),
          sb.select('products').catch(e => { console.error('products:', e); return []; }),
          sb.select('categories').catch(e => { console.error('categories:', e); return []; }),
          sb.select('faqs').catch(e => { console.error('faqs:', e); return []; }),
          sb.select('testimonials').catch(e => { console.error('testimonials:', e); return []; }),
          sb.select('features').catch(e => { console.error('features:', e); return []; }),
          sb.select('steps').catch(e => { console.error('steps:', e); return []; }),
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

        // Inquiries are loaded separately by loadInquiriesAsAdmin (authenticated, admin-only).
        // Do NOT set them here, or a late-finishing initial load can wipe the admin-loaded list.
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
      const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([{ id: inq.id, data: inq, status: inq.status }]),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} - ${(await r.text()).slice(0, 200)}`);
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
      inqNo: makeProformaNo(),
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
      const tok = adminTokenRef.current;
      const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
      await fetch(`${SUPABASE_URL}/rest/v1/inquiries?id=neq.NONEXISTENT`, { method: 'DELETE', headers: h });
      if (list.length > 0) await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(list.map(i => ({ id: i.id, data: i, status: i.status }))) });
    } catch (e) { console.error(e); }
  };
  const updateInquiry = async (inqId, status, adminComment) => {
    const cur = inquiries.find(i => i.id === inqId) || {};
    const data = { ...cur, status, adminComment };
    setInquiries(prev => prev.map(i => i.id === inqId ? { ...i, status, adminComment } : i));
    try {
      const tok = adminTokenRef.current;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?id=eq.${encodeURIComponent(inqId)}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ data, status }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      syncStatusToSheet({ type: cur.type || 'inquiry', id: inqId, humanId: cur.inqNo || '', status });
      showToast('Inquiry updated ✓');
    }
    catch (e) { showToast('Could not update inquiry'); }
  };

  const yearsInBusiness = Math.max(0, new Date().getFullYear() - (parseInt(business.foundedYear) || 2013));

  const visibleProducts = products.filter(p => p.active !== false);
  const visibleTestimonials = testimonials.filter(t => t.active !== false);

  const allSizes = Array.from(new Set(visibleProducts.flatMap(p => (p.sizes || []).filter(Boolean)))).sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || String(a).localeCompare(String(b)));
  const allColors = Array.from(new Set(visibleProducts.flatMap(p => (p.colors || []).filter(Boolean)))).sort((a, b) => String(a).localeCompare(String(b)));
  const priceOf = (p) => parseFloat(p.retailPrice) || parseFloat(p.priceFrom) || 0;
  const filtered = visibleProducts
    .filter(p => !showWishlistOnly || wishlist.includes(p.id))
    .filter(p => catFilter === 'all' || p.category === catFilter)
    .filter(p => sizeFilter === 'all' || (p.sizes || []).map(String).includes(String(sizeFilter)))
    .filter(p => colorFilter === 'all' || (p.colors || []).map(c => String(c).toLowerCase()).includes(String(colorFilter).toLowerCase()))
    .filter(p => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const catName = (categories.find(c => c.id === p.category)?.name || '');
      const hay = [p.name, p.code, catName, p.description, (p.colors || []).join(' '), (p.sizes || []).join(' ')].join(' ').toLowerCase();
      return q.split(/\s+/).every(term => hay.includes(term));
    })
    .sort((a, b) => {
      if (sort === 'price-low') return priceOf(a) - priceOf(b);
      if (sort === 'price-high') return priceOf(b) - priceOf(a);
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sort === 'bestsellers') return (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0);
      return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
    });

  const addToInquiry = (p, size = '', color = '', qty = 1) => {
    if (inquiryList.find(x => x.id === p.id)) { showToast('Already in inquiry list'); return; }
    setInquiryList([...inquiryList, { ...p, quantity: Math.max(1, qty || 1), selSize: size || '', selColor: color || '' }]);
    showToast('Added to inquiry list ✓');
  };

  const routeTransition = (fn) => {
    if (typeof document !== 'undefined' && document.startViewTransition) {
      try { document.startViewTransition(() => { flushSync(fn); }); return; } catch (e) {}
    }
    fn();
  };

  const navigate = (p) => {
    routeTransition(() => {
      if (p === 'home') setHistory([]);
      else if (p !== page) setHistory(prev => [...prev, page]);
      setPage(p); setMenuOpen(false);
      if (p !== 'product') setSelectedProduct(null);
      window.scrollTo(0, 0);
    });
  };

  const submitHeaderSearch = () => {
    setSearch(headerSearch.trim());
    setCatFilter('all'); setSizeFilter('all'); setColorFilter('all');
    setShowSearch(false);
    navigate('catalog');
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

  // On load: restore the admin session (priority), else the page from the URL.
  // Guest cart/inquiry/wishlist/recent are NOT restored — they live only in memory
  // (privacy on shared devices). Logged-in users get theirs from their account.
  useEffect(() => {
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

    // Otherwise restore the page from the URL (real routing)
    if (!adminRestored) {
      try {
        const r = routeFromPath(window.location.pathname);
        if (r.page === 'admin') {
          // Secret admin path visited: open the login prompt over the site (no blank page).
          if (adminTokenRef.current) { setPage('admin'); } else { setShowAdminLogin(true); }
        }
        else if (r.page === 'product' && r.productId) { setPage('product'); setPendingProductId(r.productId); }
        else if (r.categorySlug) { setPage('catalog'); setPendingCategorySlug(r.categorySlug); }
        else if (r.page !== 'home') setPage(r.page);
      } catch (e) {}
    } else {
      try { window.history.replaceState({ page: 'admin' }, '', '/' + ADMIN_PATH); } catch (e) {}
    }
    setTimeout(() => { routingReady.current = true; }, 0);
  }, []);

  // Keep the browser URL in sync with the current page/product/category (real routing)
  useEffect(() => {
    if (!routingReady.current) return;
    let url;
    if (page === 'product' && selectedProduct) url = '/product/' + selectedProduct.id;
    else if (page === 'catalog' && catFilter && catFilter !== 'all') {
      const c = categories.find(x => x.id === catFilter);
      url = c ? ('/category/' + slugify(c.name)) : '/catalog';
    } else url = PAGE_TO_PATH[page] || '/';
    try { if ((window.location.pathname || '/') !== url) window.history.pushState({ page }, '', url); } catch (e) {}
  }, [page, selectedProduct, catFilter, categories]);

  // ===== SEO: per-page title, meta description, canonical, Open Graph, structured data =====
  // Purely additive — does not change any app behaviour. Uses the current origin so it
  // works on anand-footwear.vercel.app today and on a custom domain later with no change.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let active = true;
    const origin = (window.location && window.location.origin) || '';
    const path = (window.location && window.location.pathname) || '/';
    const bizName = (business.name && business.name[0] !== '[') ? business.name : 'Anand Footwear';
    if (page === 'admin') { return; }
    let title = `${bizName} — Premium Men's Footwear`;
    let desc = business.tagline || "Premium men's footwear in India. Pan-India delivery and GST billing.";
    if (page === 'catalog') { title = `Shop Men's Footwear — ${bizName}`; desc = `Browse the ${bizName} collection of men's footwear. ${business.shippingCoverage || 'Pan-India delivery'}, GST billing.`; }
    else if (page === 'about') { title = `About Us — ${bizName}`; desc = `Learn about ${bizName}.`; }
    else if (page === 'faq') { title = `FAQ — ${bizName}`; desc = `Frequently asked questions about ordering from ${bizName}.`; }
    else if (page === 'contact') { title = `Contact Us — ${bizName}`; desc = `Get in touch with ${bizName}.`; }
    else if (page === 'howto') { title = `How to Order & Shipping — ${bizName}`; }
    else if (page === 'returns') { title = `Returns & Refunds — ${bizName}`; }
    else if (page === 'privacy') { title = `Privacy Policy — ${bizName}`; }
    else if (page === 'terms') { title = `Terms & Conditions — ${bizName}`; }
    else if (page === 'cancellation') { title = `Cancellation Policy — ${bizName}`; }
    else if (page === 'product' && selectedProduct) {
      title = `${selectedProduct.name} — ${bizName}`;
      desc = (selectedProduct.description || `${selectedProduct.name} by ${bizName}.`).replace(/\s+/g, ' ').trim().slice(0, 155);
    }
    document.title = title;
    seoSetMeta('description', desc);
    seoSetProp('og:title', title);
    seoSetProp('og:description', desc);
    seoSetProp('og:url', origin + path);
    seoSetCanonical(origin + path);

    if (page === 'product' && selectedProduct) {
      const p = selectedProduct;
      const price = parseFloat(p.retailPrice) || 0;
      const productLd = {
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.name, sku: p.code || undefined,
        description: (p.description || '').replace(/\s+/g, ' ').trim() || undefined,
        image: directImageUrl(p.image) || undefined,
        brand: { '@type': 'Brand', name: bizName }
      };
      if (price > 0) productLd.offers = { '@type': 'Offer', priceCurrency: 'INR', price: String(price), availability: p.outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: origin + path };
      seoSetJsonLd('seo-jsonld', productLd);
      // Add review stars (aggregateRating) once approved reviews are fetched.
      reviewsApi.listApproved(p.id).then(rows => {
        if (!active) return;
        const list = Array.isArray(rows) ? rows : [];
        if (list.length > 0) {
          const avg = list.reduce((a, r) => a + (Number(r.data && r.data.rating) || 0), 0) / list.length;
          productLd.aggregateRating = { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: String(list.length) };
          seoSetJsonLd('seo-jsonld', productLd);
        }
      }).catch(() => {});
    } else if (page === 'home') {
      seoSetJsonLd('seo-jsonld', {
        '@context': 'https://schema.org', '@type': 'Organization',
        name: bizName, url: origin || undefined,
        logo: business.logoImage ? directImageUrl(business.logoImage) : undefined,
        telephone: business.phone || undefined, email: business.email || undefined
      });
    } else {
      seoSetJsonLd('seo-jsonld', null);
    }
    return () => { active = false; };
  }, [page, selectedProduct, business, catFilter, categories]);

  // Scroll-reveal: fade-and-rise elements (.ws-reveal) as they enter the viewport.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('IntersectionObserver' in window)) { document.querySelectorAll('.ws-reveal').forEach(el => el.classList.add('ws-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('ws-in'); io.unobserve(e.target); } });
    }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
    document.documentElement.classList.add('ws-anim');
    const observeAll = () => { document.querySelectorAll('.ws-reveal:not(.ws-in)').forEach(el => io.observe(el)); };
    observeAll();
    const timers = [setTimeout(observeAll, 100), setTimeout(observeAll, 400), setTimeout(observeAll, 1000), setTimeout(observeAll, 2000)];
    let mo;
    try { mo = new MutationObserver(() => observeAll()); mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    const safety = setTimeout(() => { document.querySelectorAll('.ws-reveal:not(.ws-in)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight) el.classList.add('ws-in'); }); }, 3000);
    return () => { timers.forEach(clearTimeout); clearTimeout(safety); io.disconnect(); if (mo) mo.disconnect(); };
  }, [page]);

  // Handle browser Back/Forward
  useEffect(() => {
    const onPop = () => {
      const r = routeFromPath(window.location.pathname);
      setMenuOpen(false);
      if (r.page === 'product' && r.productId) {
        const p = products.find(x => String(x.id) === String(r.productId));
        setPage('product');
        if (p) setSelectedProduct(p); else { setSelectedProduct(null); setPendingProductId(r.productId); }
      } else if (r.categorySlug) {
        setSelectedProduct(null); setPage('catalog');
        const c = categories.find(x => slugify(x.name) === r.categorySlug);
        if (c) setCatFilter(c.id); else setPendingCategorySlug(r.categorySlug);
      } else { setSelectedProduct(null); if (r.page === 'catalog') setCatFilter('all'); setPage(r.page); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [products, categories]);

  // Resolve a product opened directly via /product/{id} once products have loaded
  useEffect(() => {
    if (!pendingProductId || !products.length) return;
    const p = products.find(x => String(x.id) === String(pendingProductId));
    if (p) setSelectedProduct(p); else setPage('catalog');
    setPendingProductId(null);
  }, [pendingProductId, products]);

  // Resolve a category opened directly via /category/{slug} once categories have loaded
  useEffect(() => {
    if (!pendingCategorySlug || !categories.length) return;
    const c = categories.find(x => slugify(x.name) === pendingCategorySlug);
    if (c) setCatFilter(c.id);
    setPendingCategorySlug(null);
  }, [pendingCategorySlug, categories]);

  // Cart, inquiry, wishlist and recently-viewed are kept in memory only.
  // Nothing is written to the browser, so a guest's data never carries over to the
  // next person on a shared device, and clears on refresh. Logged-in users get
  // their cart / inquiry / wishlist from their account (and it syncs back).
  const toggleWish = (id) => setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Reset how many catalog items are shown whenever the result set changes
  useEffect(() => { setVisibleCount(24); }, [search, catFilter, sizeFilter, colorFilter, sort, showWishlistOnly]);

  const addToShopCart = (p, size, color, qty) => {
    const q = Math.max(1, parseInt(qty) || 1);
    setShopCart(prev => {
      const key = `${p.id}|${size}|${color}`;
      const existing = prev.find(it => it.key === key);
      if (existing) return prev.map(it => it.key === key ? { ...it, qty: it.qty + q } : it);
      return [...prev, { key, id: p.id, code: p.code, name: p.name, image: (productImages(p)[0] || ''), size, color, qty: q, retailPrice: p.retailPrice, qtyBreaks: p.qtyBreaks, discountPercent: p.discountPercent }];
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
    routeTransition(() => {
      setHistory(prev2 => prev2.slice(0, -1));
      setPage(prev); setMenuOpen(false);
      if (prev !== 'product') setSelectedProduct(null);
      window.scrollTo(0, 0);
    });
  };

  const viewProduct = (p) => {
    setRecentIds(prev => [p.id, ...prev.filter(x => x !== p.id)].slice(0, 8));
    routeTransition(() => {
      if (page !== 'product') setHistory(prev => [...prev, page]);
      setSelectedProduct(p); setPage('product'); setMenuOpen(false);
      setBuySel({ size: '', color: '', qty: 1 });
      window.scrollTo(0, 0);
    });
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
        <AdminPanel business={business} saveBusiness={saveBusiness} products={products} saveProducts={saveProducts} categories={categories} saveCategories={saveCategories} faqs={faqs} saveFaqs={saveFaqs} testimonials={testimonials} saveTestimonials={saveTestimonials} features={features} saveFeatures={saveFeatures} steps={steps} saveSteps={saveSteps} inquiries={inquiries} saveInquiries={saveInquiries} updateInquiry={updateInquiry} adminToken={adminToken} navigate={navigate} showToast={showToast} setAdminAuth={setAdminAuth} logout={logout} />
        {toast && <div className="ws-toast fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5"><CheckCircle size={18} className="text-green-400 flex-shrink-0" /><span className="text-sm">{toast}</span></div>}
      </>
    );
  }

  return (
    <div className={`min-h-screen bg-white app-root pb-16 lg:pb-0 overflow-x-hidden${dark ? ' theme-dark' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Nunito:wght@600;700;800;900&family=Playfair+Display:wght@600;700;800&display=swap');

        /* ---- Typography: elegant serif display headings, crisp body ---- */
        .app-root, .app-root input, .app-root textarea, .app-root select, .app-root button, .app-root a { font-family:'Inter', system-ui, sans-serif; }
        .app-root h1, .app-root h2 { font-family:'Playfair Display', Georgia, serif; font-weight:700; letter-spacing:-0.01em; }
        .app-root h3, .app-root h4 { font-family:'Nunito', system-ui, sans-serif; font-weight:800; letter-spacing:-0.01em; }

        /* ===== Motion & polish (lightweight, GPU-friendly) ===== */
        /* 1) Scroll reveal: elements fade-and-rise when they enter the viewport.
           The hidden state only applies once JS adds .ws-anim, so if JS never runs, content stays visible. */
        .ws-reveal { transition:opacity .6s cubic-bezier(.22,.61,.36,1), transform .6s cubic-bezier(.22,.61,.36,1); will-change:opacity,transform; }
        .ws-anim .ws-reveal:not(.ws-in) { opacity:0; transform:translateY(20px); }
        /* 2) Product card hover: lift + soft shadow; inner image zoom */
        .ws-card { transition:transform .35s ease, box-shadow .35s ease; }
        @media (hover:hover){ .ws-card:hover { transform:translateY(-6px); box-shadow:0 14px 30px rgba(15,32,56,.16); } }
        .ws-zoom { overflow:hidden; }
        .ws-zoom img { transition:transform .5s ease; }
        @media (hover:hover){ .ws-card:hover .ws-zoom img { transform:scale(1.08); } }
        /* 3) Image fade-in once loaded */
        .ws-fade { opacity:0; transition:opacity .5s ease; }
        .ws-fade.ws-loaded { opacity:1; }
        /* 4) Cart icon pop when an item is added */
        @keyframes wsCartPop { 0%{transform:scale(1)} 30%{transform:scale(1.35)} 60%{transform:scale(.9)} 100%{transform:scale(1)} }
        .ws-cart-pop { animation:wsCartPop .45s ease; }
        /* button press feedback */
        .app-root button:active { transform:scale(.97); }
        /* 5) Hero: slow Ken-Burns zoom + headline slide-in */
        @keyframes wsKen { from{transform:scale(1)} to{transform:scale(1.12)} }
        .ws-ken { animation:wsKen 18s ease-in-out infinite alternate; }
        @keyframes wsHeroIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
        .ws-hero-in { animation:wsHeroIn .8s cubic-bezier(.22,.61,.36,1) both; }
        /* E) Animated hero gradient overlay (subtle navy↔gold drift) */
        @keyframes wsHeroGrad { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(6%,4%) scale(1.15)} 100%{transform:translate(0,0) scale(1)} }
        .ws-hero-grad { animation:wsHeroGrad 16s ease-in-out infinite; }
        /* C) Polished toast slide-in */
        @keyframes wsToastIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .ws-toast { animation:wsToastIn .4s cubic-bezier(.22,.61,.36,1) both; }
        /* G) Confetti burst (order success) */
        @keyframes wsConfFall { 0%{transform:translateY(-10px) rotate(0);opacity:0} 12%{opacity:1} 100%{transform:translateY(220px) rotate(340deg);opacity:0} }
        .ws-conf { position:absolute; top:0; width:8px; height:8px; border-radius:1px; animation:wsConfFall 2.4s ease-in forwards; pointer-events:none; }
        /* B) Skeleton shimmer */
        @keyframes wsShimmer { 0%{background-position:-260px 0} 100%{background-position:260px 0} }
        .ws-sk { background:linear-gradient(90deg,#eef1f5 25%,#f7f9fb 37%,#eef1f5 63%); background-size:360px 100%; animation:wsShimmer 1.3s linear infinite; border-radius:6px; }
        /* I) Accent polish: softer card shadows + gold focus rings */
        .app-root .shadow-sm { box-shadow:0 1px 3px rgba(15,32,56,.06), 0 1px 2px rgba(15,32,56,.04) !important; }
        .app-root .shadow-xl { box-shadow:0 18px 40px rgba(15,32,56,.14) !important; }
        /* A) Sticky mobile buy bar */
        @keyframes wsBarUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .ws-buybar { animation:wsBarUp .3s ease both; }
        /* Respect users who prefer reduced motion — turn everything off */
        @media (prefers-reduced-motion: reduce){
          .ws-reveal,.ws-card,.ws-zoom img,.ws-fade { transition:none !important; }
          .ws-reveal { opacity:1 !important; transform:none !important; }
          .ws-fade { opacity:1 !important; }
          .ws-ken,.ws-hero-in,.ws-cart-pop,.ws-hero-grad,.ws-toast,.ws-conf,.ws-sk,.ws-buybar { animation:none !important; }
        }

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
        /* #1 + #2 — hover backgrounds in dark mode (resting bg was darkened, hover variants were not, so hover flashed light and hid text) */
        .theme-dark .hover\\:bg-slate-50:hover { background-color:#1c3a63 !important; }
        .theme-dark .hover\\:bg-slate-100:hover { background-color:#24406b !important; }
        .theme-dark .hover\\:bg-slate-200:hover { background-color:#2c4d7d !important; }
        .theme-dark .hover\\:bg-amber-50:hover { background-color:rgba(198,161,91,0.22) !important; }
        .theme-dark .hover\\:bg-amber-100:hover { background-color:rgba(198,161,91,0.3) !important; }
        .theme-dark .hover\\:bg-green-50:hover { background-color:rgba(34,197,94,0.22) !important; }
        .theme-dark .hover\\:bg-green-100:hover { background-color:rgba(34,197,94,0.3) !important; }
        .theme-dark .hover\\:bg-blue-50:hover { background-color:rgba(59,130,246,0.22) !important; }
        .theme-dark .hover\\:bg-blue-100:hover { background-color:rgba(59,130,246,0.3) !important; }
        .theme-dark .hover\\:bg-red-50:hover { background-color:rgba(239,68,68,0.22) !important; }
        .theme-dark .hover\\:bg-red-100:hover { background-color:rgba(239,68,68,0.3) !important; }
        /* #4 — light-grey blocks (disabled buttons, dividers) shouldn't read as pale boxes on dark */
        .theme-dark .bg-slate-200 { background-color:#24406b !important; }
        .theme-dark .bg-slate-300 { background-color:#2c4d7d !important; }
        /* #5 — faint text bumped for readability on dark */
        .theme-dark .text-slate-400 { color:#7e93b0 !important; }
        .theme-dark .text-slate-300 { color:#9fb0c9 !important; }
      `}</style>
      {loadError && <div className="bg-amber-100 border-b border-amber-300 text-amber-800 text-xs px-4 py-2 text-center">⚠️ {loadError}</div>}
      <div className="bg-slate-900 text-white text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1"><Phone size={12} /> {business.phone}</span>
            <span className="hidden md:flex items-center gap-1"><Mail size={12} /> {business.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-amber-400">Trusted by {business.retailers} Customers</span>
            {business.facebook && <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400"><Facebook size={14} /></a>}
            {business.instagram && <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400"><Instagram size={14} /></a>}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {history.length > 0 && <button onClick={goBack} className="px-1.5 sm:px-3 py-2 hover:bg-amber-50 rounded-lg flex items-center gap-1 text-slate-700 hover:text-amber-600 flex-shrink-0" title="Go back"><ChevronRight className="rotate-180" size={18} /><span className="text-sm font-medium hidden sm:inline">Back</span></button>}
            <div onClick={() => navigate('home')} className="cursor-pointer flex items-center gap-2 sm:gap-3 min-w-0">
              {business.logoImage ? <img src={directImageUrl(business.logoImage)} alt={business.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shadow-md flex-shrink-0" /> : <CrestEmblem className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />}
              <div className="min-w-0"><div className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{business.name}</div><div className="text-xs text-slate-500 hidden sm:block">{business.tagline}</div></div>
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
                  <button onClick={() => goToSection('sec-reviews')} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><MessageSquare size={16} /> What customers say</button>
                  <button onClick={() => navigate('faq')} className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><HelpCircle size={16} /> FAQ</button>
                </div>
              </div>
            </div>

            <button onClick={() => navigate('contact')} className={`text-sm font-medium transition-colors ${page === 'contact' ? 'text-amber-600' : 'text-slate-700 hover:text-amber-600'}`}>Contact</button>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button onClick={() => setShowSearch(s => !s)} className="p-2 hover:bg-amber-50 rounded-lg text-slate-700" title="Search products" aria-label="Search products"><Search size={22} /></button>
            <button onClick={() => setDark(d => !d)} className="p-2 hover:bg-amber-50 rounded-lg text-slate-700" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle dark mode">{dark ? <Sun size={22} /> : <Moon size={22} />}</button>
            <button onClick={() => { setShowWishlistOnly(true); setCatFilter('all'); setSearch(''); navigate('catalog'); }} className="hidden sm:inline-flex relative p-2 hover:bg-amber-50 rounded-lg text-slate-700" title="Saved items" aria-label="Saved items"><Heart size={22} />{wishlist.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold">{wishlist.length}</span>}</button>
            <button onClick={() => { setAccountTab('profile'); setShowAccount(true); }} className="hidden lg:flex p-2 hover:bg-amber-50 rounded-lg text-slate-700 items-center gap-1.5 text-sm font-medium" title={customer ? 'My Account' : 'Login'}><Users size={20} />{customer && <span className="hidden sm:inline max-w-[90px] truncate">{customer.profile.name || 'Account'}</span>}</button>
            <button onClick={openCart} className="hidden lg:inline-flex relative p-2 hover:bg-amber-50 rounded-lg" title="Cart & Inquiry"><ShoppingBag size={22} className={`text-slate-700 ${cartPop ? 'ws-cart-pop' : ''}`} />{(shopCart.reduce((a, it) => a + it.qty, 0) + inquiryList.length) > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{shopCart.reduce((a, it) => a + it.qty, 0) + inquiryList.length}</span>}</button>
            <button onClick={() => navigate('contact')} className="hidden md:block bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-semibold">Get Quote</button>
            <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={24} /> : <Menu size={24} />}</button>
          </div>
        </div>
        {showSearch && (
          <div className="border-t border-gray-100 bg-white overflow-hidden" style={{ animation: 'wsSearchOpen .26s ease' }}>
            <style>{`@keyframes wsSearchOpen{from{opacity:0;max-height:0;transform:translateY(-6px)}to{opacity:1;max-height:80px;transform:none}}`}</style>
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
              <Search size={18} className="text-slate-400 flex-shrink-0" />
              <input autoFocus value={headerSearch} onChange={e => setHeaderSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitHeaderSearch(); if (e.key === 'Escape') setShowSearch(false); }} placeholder="Search e.g. black formal, AF-101…" className="flex-1 min-w-0 px-2 py-2 outline-none bg-transparent text-slate-800" />
              <button onClick={submitHeaderSearch} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0">Search</button>
              <button onClick={() => setShowSearch(false)} className="p-2 text-slate-500 hover:text-slate-700 flex-shrink-0" aria-label="Close search"><X size={20} /></button>
            </div>
          </div>
        )}
        {menuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setMenuOpen(false)}>
            <div className="bg-white w-72 max-w-[85%] h-full overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center"><span className="font-bold text-slate-900">Menu</span><button onClick={() => setMenuOpen(false)} aria-label="Close"><X size={22} /></button></div>
              <div className="p-2">
                {NAV_ITEMS.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${page === item.id ? 'bg-amber-50 text-amber-600' : 'text-slate-700 hover:bg-slate-50'}`}><item.icon size={18} /> {item.label}</button>)}

                <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Browse</div>
                <button onClick={() => navigate('catalog')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Grid size={18} /> Shop by category</button>
                <button onClick={() => { setShowWishlistOnly(true); setCatFilter('all'); setSearch(''); navigate('catalog'); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Heart size={18} /> Saved items{wishlist.length > 0 ? ` (${wishlist.length})` : ''}</button>
                <button onClick={() => goToSection('sec-featured')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Star size={18} /> Featured products</button>

                <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Company</div>
                <button onClick={() => goToSection('sec-why')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><CheckCircle size={18} /> Why choose us</button>
                <button onClick={() => goToSection('sec-reviews')} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><MessageSquare size={18} /> What customers say</button>

                <div className="border-t border-slate-100 my-2"></div>
                {customer ? (
                  <>
                    <div className="px-3 pt-1 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">My account</div>
                    <button onClick={() => { setAccountTab('profile'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><Users size={18} /> Account info</button>
                    <button onClick={() => { setAccountTab('inquiries'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><ListChecks size={18} /> My inquiries</button>
                    <button onClick={() => { setAccountTab('orders'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><ShoppingBag size={18} /> My orders</button>
                    <button onClick={() => { setAccountTab('addresses'); setShowAccount(true); setMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"><MapPin size={18} /> My addresses</button>
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

      <style>{`::view-transition-old(root),::view-transition-new(root){animation-duration:.32s;animation-timing-function:ease}`}</style>
      <main>
        {page === 'home' && (
          <>
            <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
              <div className="absolute inset-0 opacity-10 ws-hero-grad" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 75% 75%, #f59e0b 0%, transparent 50%)' }}></div>
              <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
                <div className="ws-hero-in">
                  <div className="inline-block px-4 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-6">⭐ {(business.heroBadge || '{years} Years of Excellence').replace('{years}', yearsInBusiness)}</div>
                  <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">{business.heroTitle}</h1>
                  <p className="text-lg text-slate-300 mb-8">{business.heroSubtitle}</p>
                  <div className="flex flex-wrap gap-4">
                    <button onClick={() => navigate('catalog')} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2">Browse Catalog <ArrowRight size={18} /></button>
                    <button onClick={() => navigate('contact')} className="border-2 border-white/30 hover:bg-white/10 px-8 py-3 rounded-lg font-semibold">Request Quote</button>
                  </div>
                </div>
                <div className="relative hidden md:block">
                  <div className="aspect-square bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl shadow-2xl overflow-hidden"><SafeImage src={IMG_URLS[0]} alt="Premium shoes" className="w-full h-full object-cover mix-blend-overlay opacity-90 ws-ken" /></div>
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

            <section className="bg-white py-12 border-b ws-reveal">
              <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
                {[{ icon: Award, value: yearsInBusiness, label: 'Years in Business' }, { icon: Users, value: business.retailers, label: 'Customers Served' }, { icon: MapPin, value: business.cities, label: 'Cities Covered' }, { icon: Package, value: business.skus, label: 'Products in Stock' }].map((s, i) => (
                  <div key={i} className="text-center"><s.icon className="text-amber-500 mx-auto mb-3" size={32} /><div className="text-3xl md:text-4xl font-bold text-slate-900">{s.value}</div><div className="text-sm text-slate-600 mt-1">{s.label}</div></div>
                ))}
              </div>
            </section>

            {categories.length > 0 && (
              <section className="py-16 bg-slate-50 ws-reveal">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Shop by Category</h2></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {categories.map(c => <button key={c.id} onClick={() => { setCatFilter(c.id); navigate('catalog'); }} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg border transition-all hover:-translate-y-1 group"><div className="text-4xl mb-3">{c.icon}</div><div className="font-semibold text-slate-900 group-hover:text-amber-600">{c.name}</div><div className="text-xs text-slate-500 mt-1">{visibleProducts.filter(p => p.category === c.id).length} products</div></button>)}
                  </div>
                </div>
              </section>
            )}

            {visibleProducts.filter(p => p.isNew).length > 0 && (
              <section id="sec-featured" className="py-16 bg-white ws-reveal">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex justify-between items-end mb-8"><div><span className="text-amber-600 font-semibold text-sm uppercase">Just In</span><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">New Arrivals</h2></div><button onClick={() => navigate('catalog')} className="text-amber-600 font-medium flex items-center gap-1 hover:underline">View All <ChevronRight size={18} /></button></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{visibleProducts.filter(p => p.isNew).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} isWished={wishlist.includes(p.id)} onToggleWish={toggleWish} />)}</div>
                </div>
              </section>
            )}

            {visibleProducts.filter(p => p.isBestseller).length > 0 && (
              <section className="py-16 bg-slate-50 ws-reveal">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex justify-between items-end mb-8"><div><span className="text-amber-600 font-semibold text-sm uppercase">Customer Favorites</span><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">Bestsellers</h2></div><button onClick={() => navigate('catalog')} className="text-amber-600 font-medium flex items-center gap-1 hover:underline">View All <ChevronRight size={18} /></button></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{visibleProducts.filter(p => p.isBestseller).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} isWished={wishlist.includes(p.id)} onToggleWish={toggleWish} />)}</div>
                </div>
              </section>
            )}

            {features.length > 0 && (
              <section id="sec-why" className="py-16 bg-slate-50 ws-reveal">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Why Choose Us</h2></div>
                  <div className="flex flex-wrap justify-center gap-6">
                    {features.map((f) => <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-6 text-center hover:shadow-md transition-shadow basis-full sm:basis-[calc(50%-12px)] lg:basis-[calc(33.333%-16px)]"><div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">{f.icon}</div><h3 className="font-bold text-slate-900 mb-2">{f.title}</h3><p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p></div>)}
                  </div>
                </div>
              </section>
            )}

            {visibleTestimonials.length > 0 && (
              <section id="sec-reviews" className="py-16 bg-slate-50 ws-reveal">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">What Our Customers Say</h2></div>
                  <div className={`grid gap-6 ${visibleTestimonials.length >= 3 ? 'md:grid-cols-3' : visibleTestimonials.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-2xl mx-auto'}`}>
                    {visibleTestimonials.slice(0, 6).map(t => (
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

            <section className="py-16 bg-gradient-to-r from-amber-500 to-amber-600 text-white ws-reveal">
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
              <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search e.g. black formal, AF-101…" className="w-full pl-10 pr-4 py-2 border rounded-lg" /></div>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="all">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>
                {allSizes.length > 0 && <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="all">All Sizes</option>{allSizes.map(s => <option key={s} value={s}>Size {s}</option>)}</select>}
                {allColors.length > 0 && <select value={colorFilter} onChange={e => setColorFilter(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="all">All Colours</option>{allColors.map(c => <option key={c} value={c}>{c}</option>)}</select>}
                <select value={sort} onChange={e => setSort(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="newest">Newest</option><option value="bestsellers">Bestsellers</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="name">Name: A to Z</option></select>
                <button onClick={() => setShowWishlistOnly(v => !v)} className={`px-4 py-2 border rounded-lg flex items-center justify-center gap-2 text-sm font-medium ${showWishlistOnly ? 'bg-rose-50 border-rose-300 text-rose-600' : 'text-slate-700'}`}><Heart size={16} fill={showWishlistOnly ? 'currentColor' : 'none'} /> Saved{wishlist.length > 0 ? ` (${wishlist.length})` : ''}</button>
              </div>
            </div>
            <div className="text-sm text-slate-600 mb-4">Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}{filtered.length !== visibleProducts.length ? ` (filtered from ${visibleProducts.length})` : ''} products</div>
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100">
                    <div className="ws-sk" style={{ aspectRatio: '1 / 1', borderRadius: 0 }}></div>
                    <div className="p-4">
                      <div className="ws-sk" style={{ height: 10, width: '40%', marginBottom: 10 }}></div>
                      <div className="ws-sk" style={{ height: 12, width: '80%', marginBottom: 10 }}></div>
                      <div className="ws-sk" style={{ height: 10, width: '55%', marginBottom: 16 }}></div>
                      <div className="ws-sk" style={{ height: 36, width: '100%', borderRadius: 8 }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{filtered.slice(0, visibleCount).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} isWished={wishlist.includes(p.id)} onToggleWish={toggleWish} />)}</div>
            )}
            {filtered.length > visibleCount && <div className="text-center mt-8"><button onClick={() => setVisibleCount(c => c + 24)} className="bg-slate-900 hover:bg-amber-500 text-white px-8 py-3 rounded-lg font-semibold transition-colors">Load more products</button></div>}
            {filtered.length === 0 && showWishlistOnly && <div className="text-center py-16 px-4"><div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><Heart size={26} className="text-amber-500" /></div><div className="font-semibold text-slate-900 mb-1">No saved items yet</div><div className="text-sm text-slate-500 max-w-[240px] mx-auto mb-4">Tap the heart on any product to save it here for later.</div><button onClick={() => setShowWishlistOnly(false)} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg">Browse products</button></div>}
            {filtered.length === 0 && !showWishlistOnly && <div className="text-center py-16 px-4"><div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><Search size={26} className="text-amber-500" /></div><div className="font-semibold text-slate-900 mb-1">No products found</div><div className="text-sm text-slate-500 max-w-[240px] mx-auto mb-4">Try a different spelling or fewer words — or clear the filters to see everything.</div><button onClick={() => { setSearch(''); setCatFilter('all'); setSizeFilter('all'); setColorFilter('all'); }} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg">Clear filters</button></div>}
            {(() => {
              const recent = recentIds.map(id => visibleProducts.find(p => p.id === id)).filter(Boolean).slice(0, 4);
              return recent.length > 0 ? (
                <div className="mt-14">
                  <h2 className="text-xl font-bold text-slate-900 mb-5">Recently viewed</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{recent.map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} isWished={wishlist.includes(p.id)} onToggleWish={toggleWish} />)}</div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {page === 'product' && !selectedProduct && <div className="max-w-7xl mx-auto px-4 py-24 text-center text-slate-400">Loading…</div>}
        {page === 'product' && selectedProduct && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <button onClick={() => navigate('catalog')} className="text-slate-600 hover:text-amber-600 mb-6 flex items-center gap-1"><ChevronRight className="rotate-180" size={18} /> Back to Catalog</button>
            <div className="grid md:grid-cols-2 gap-12">
              <ProductGallery key={selectedProduct.id} images={productImages(selectedProduct)} alt={selectedProduct.name} />
              <div>
                <div className="flex gap-2 mb-3">{selectedProduct.isNew && <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-semibold">NEW</span>}{selectedProduct.isBestseller && <span className="bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-semibold">★ BESTSELLER</span>}{selectedProduct.outOfStock && <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold">OUT OF STOCK</span>}</div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="text-sm text-slate-500 font-mono pt-1">{selectedProduct.code}</div>
                  <ShareButton product={selectedProduct} business={business} />
                </div>
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
                  const dPct = discPctFor(p);
                  const dUnit = discountedUnitPrice(p, sel.qty || 1);
                  const dBase = dPct > 0 ? Math.round(base * (1 - dPct / 100)) : base;
                  const canBuy = !p.outOfStock && sel.size && sel.color && comboStock > 0;
                  return (
                    <>
                    <div className="mb-6">
                      {base > 0 && (
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2 flex-wrap"><span className="text-3xl font-bold text-slate-900">₹{(canBuy ? dUnit : dBase).toLocaleString('en-IN')}</span>{dPct > 0 && <span className="text-lg text-slate-400 line-through">₹{(canBuy ? unit : base).toLocaleString('en-IN')}</span>}<span className="text-slate-500 text-sm">/ pair</span>{dPct > 0 && <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">{dPct}% off</span>}{canBuy && unit < base && <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">bulk price applied</span>}</div>
                          {brks.length > 0 && <div className="text-sm text-amber-700 bg-amber-50 inline-block px-3 py-1 rounded-lg mt-2">{brks.map(b => `Buy ${b.minQty}+ at ₹${b.price.toLocaleString('en-IN')}`).join('  ·  ')} — applied automatically</div>}
                        </div>
                      )}
                      {!p.outOfStock && base > 0 && (
                        <>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1"><div className="text-xs text-slate-500">Size</div>{business.sizeGuideEnabled && <button onClick={() => setShowSizeGuide(true)} className="text-xs text-amber-600 hover:text-amber-700 underline flex items-center gap-1">Size guide</button>}</div>
                            <div className="flex gap-2 flex-wrap">{(p.sizes || []).filter(Boolean).map(s => { const st = sizeStock(s); const active = sel.size === s; return <button key={s} disabled={st === 0} onClick={() => setBuySel({ ...sel, size: s, qty: 1 })} className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${active ? 'bg-amber-500 text-white border-amber-500' : st === 0 ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed line-through' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-500'}`}>{s}</button>; })}</div>
                          </div>
                          <div className="mb-3">
                            <div className="text-xs text-slate-500 mb-1">Colour</div>
                            <div className="flex gap-2 flex-wrap">{(p.colors || []).filter(Boolean).map(c => { const st = colorStock(c); const active = sel.color === c; return <button key={c} disabled={st === 0} onClick={() => setBuySel({ ...sel, color: c, qty: 1 })} className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${active ? 'bg-amber-500 text-white border-amber-500' : st === 0 ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed line-through' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-500'}`}>{c}</button>; })}</div>
                          </div>
                          <div className="text-sm mb-3 min-h-[20px]">{(sel.size && sel.color) ? (comboStock > 0 ? <span className="text-green-600 font-medium">{comboStock <= 4 ? `Only ${comboStock} left` : 'In stock'}</span> : <span className="text-red-500 font-medium">Out of stock in this size/colour</span>) : <span className="text-slate-400">Select size and colour</span>}</div>
                          {canBuy && (
                            <div className="flex items-center gap-3 mb-4">
                              <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden"><button onClick={() => setBuySel({ ...sel, qty: Math.max(1, (sel.qty || 1) - 1) })} className="px-3 py-2 hover:bg-slate-100">−</button><span className="px-4 font-semibold">{sel.qty || 1}</span><button onClick={() => setBuySel({ ...sel, qty: Math.min(comboStock, (sel.qty || 1) + 1) })} disabled={(sel.qty || 1) >= comboStock} className="px-3 py-2 hover:bg-slate-100 disabled:text-slate-300">+</button></div>
                              <div className="text-sm text-slate-600">Total: <span className="font-bold text-slate-900">₹{(dUnit * (sel.qty || 1)).toLocaleString('en-IN')}</span></div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                        {p.outOfStock || base <= 0
                          ? null
                          : <button disabled={!canBuy} onClick={() => addToShopCart(p, sel.size, sel.color, sel.qty || 1)} className={`w-full sm:flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${canBuy ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}><ShoppingBag size={18} /> Add to Cart</button>}
                        {p.outOfStock
                          ? <button disabled className="w-full sm:flex-1 bg-slate-200 text-slate-500 py-3 rounded-lg font-semibold cursor-not-allowed">Out of Stock</button>
                          : <button onClick={() => { const hasOpts = ((p.sizes || []).filter(Boolean).length > 0 || (p.colors || []).filter(Boolean).length > 0); if (base > 0 && hasOpts && (!sel.size || !sel.color)) { showToast('Please select size and colour first'); return; } addToInquiry(p, sel.size, sel.color, (sel.size && sel.color) ? (sel.qty || 1) : 1); }} className="w-full sm:flex-1 bg-slate-900 hover:bg-slate-700 text-white py-3 rounded-lg font-semibold transition-colors">Add to Inquiry</button>}
                        <a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hi, I'm interested in ${p.code} - ${p.name}`)}`} target="_blank" rel="noopener noreferrer" className="w-full sm:flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold text-center flex items-center justify-center gap-2"><WhatsAppIcon size={18} /> Chat with us</a>
                      </div>
                      <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600"><Shield size={16} className="text-emerald-600 flex-shrink-0" /> Secure checkout</div>
                        <div className="flex items-center gap-2 text-xs text-slate-600"><FileText size={16} className="text-blue-600 flex-shrink-0" /> GST invoice</div>
                        <div className="flex items-center gap-2 text-xs text-slate-600"><Truck size={16} className="text-amber-600 flex-shrink-0" /> {business.shippingCoverage || 'Pan-India'} delivery</div>
                        <div className="flex items-center gap-2 text-xs text-slate-600"><RefreshCw size={16} className="text-rose-600 flex-shrink-0" /> Easy returns</div>
                      </div>
                    </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="mt-16 max-w-3xl">
              <ProductReviews productId={selectedProduct.id} productName={selectedProduct.name} customer={customer} onLogin={() => { setAccountTab('profile'); setShowAccount(true); }} />
            </div>
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">You may also like</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{(() => {
                const sameCat = visibleProducts.filter(p => p.category === selectedProduct.category && p.id !== selectedProduct.id);
                const fillers = visibleProducts.filter(p => p.id !== selectedProduct.id && !sameCat.some(s => s.id === p.id)).sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0) || (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
                const rel = [...sameCat, ...fillers].slice(0, 4);
                return rel.map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} isWished={wishlist.includes(p.id)} onToggleWish={toggleWish} />);
              })()}</div>
            </div>
            {(() => {
              const recent = recentIds.map(id => visibleProducts.find(p => p.id === id)).filter(p => p && p.id !== selectedProduct.id).slice(0, 4);
              return recent.length > 0 ? (
                <div className="mt-16">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Recently viewed</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{recent.map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} isWished={wishlist.includes(p.id)} onToggleWish={toggleWish} />)}</div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {page === 'about' && (() => {
          const map = getMapSrc(business);
          return (
          <div className="max-w-6xl mx-auto px-4 py-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">About Us</h1>
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Story</h2>
                <p className="text-slate-700 leading-relaxed mb-8 whitespace-pre-line">{business.about}</p>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h2>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{business.mission}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-5">
                  <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><MapPin size={18} className="text-amber-500" /> Visit us</h3>
                  <p className="text-sm text-slate-600 leading-relaxed flex items-start gap-2 mb-2"><MapPin size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />{business.address}</p>
                  <p className="text-sm text-slate-600 leading-relaxed flex items-start gap-2"><Clock size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />{business.hours}</p>
                </div>
                {map.valid && <iframe title="Our location" src={map.src} className="w-full" style={{ height: 200, border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>}
                {map.valid && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.mapQuery || business.address || '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm text-amber-600 hover:bg-amber-50 py-3 font-medium border-t border-slate-100"><MapPin size={16} /> Get directions</a>}
                {!map.valid && <div className="px-5 pb-5 text-xs text-slate-400">Add your shop's Google Maps address in admin → Business Info to show a map here.</div>}
              </div>
            </div>
          </div>
          );
        })()}

        {page === 'faq' && <div className="max-w-3xl mx-auto px-4 py-12"><h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">FAQ</h1><p className="text-slate-600 mb-12">Common questions from our customers</p><div className="space-y-3">{faqs.map(f => <FAQItem key={f.id} q={f.q} a={f.a} />)}{faqs.length === 0 && <div className="text-center text-slate-500 py-12">No FAQs yet</div>}</div></div>}

        {page === 'howto' && <PolicyPage title="How to Order & Shipping" sections={[{ text: business.howToOrder }, { heading: 'Shipping & Delivery', text: business.shippingPolicy }]} />}
        {page === 'returns' && <PolicyPage title="Returns & Refunds" sections={[{ text: business.returnsPolicy }]} />}
        {page === 'privacy' && <PolicyPage title="Privacy Policy" sections={[{ text: business.privacyPolicy }]} />}
        {page === 'terms' && <PolicyPage title="Terms & Conditions" sections={[{ text: business.termsPolicy }]} />}
        {page === 'cancellation' && <PolicyPage title="Cancellation Policy" sections={[{ text: business.cancellationPolicy }]} />}

        {page === 'contact' && <ContactPage business={business} inquiryList={inquiryList} setInquiryList={setInquiryList} saveInquiry={saveInquiry} navigate={navigate} showToast={showToast} customer={customer} onInquirySubmitted={recordInquiryHistory} />}
      </main>

      <footer className="bg-slate-900 text-white pt-12 pb-40 mt-16">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">{business.logoImage ? <img src={directImageUrl(business.logoImage)} alt={business.name} className="w-10 h-10 rounded-lg object-cover" /> : <CrestEmblem className="w-10 h-10" />}<div className="font-bold">{business.name}</div></div>
            <p className="text-sm text-slate-400 mb-4">{business.tagline}</p>
            <div className="flex gap-3">{business.facebook && <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-slate-800 hover:bg-amber-500 rounded-full flex items-center justify-center transition-colors"><Facebook size={16} /></a>}{business.instagram && <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-slate-800 hover:bg-amber-500 rounded-full flex items-center justify-center transition-colors"><Instagram size={16} /></a>}</div>
          </div>
          <div><h4 className="font-bold mb-3">Quick Links</h4><ul className="space-y-2 text-sm text-slate-400">{NAV_ITEMS.map(i => <li key={i.id}><button onClick={() => navigate(i.id)} className="hover:text-amber-400">{i.label}</button></li>)}</ul></div>
          <div><h4 className="font-bold mb-3">Categories</h4><ul className="space-y-2 text-sm text-slate-400">{categories.map(c => <li key={c.id}><button onClick={() => { setCatFilter(c.id); navigate('catalog'); }} className="hover:text-amber-400">{c.name}</button></li>)}</ul></div>
          <div><h4 className="font-bold mb-3">Contact</h4><ul className="space-y-2 text-sm text-slate-400"><li className="flex gap-2"><Phone size={14} className="mt-0.5 flex-shrink-0" />{business.phone}</li><li className="flex gap-2"><Mail size={14} className="mt-0.5 flex-shrink-0" />{business.email}</li><li className="flex gap-2"><MapPin size={14} className="mt-0.5 flex-shrink-0" />{business.address}</li><li className="flex gap-2"><Clock size={14} className="mt-0.5 flex-shrink-0" />{business.hours}</li></ul></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t border-slate-800 flex flex-col items-center gap-3 text-sm text-slate-400">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {(business.howToOrder || business.shippingPolicy) && <button onClick={() => navigate('howto')} className="hover:text-amber-400">How to Order &amp; Shipping</button>}
            {business.returnsPolicy && <button onClick={() => navigate('returns')} className="hover:text-amber-400">Returns &amp; Refunds</button>}
            {business.cancellationPolicy && <button onClick={() => navigate('cancellation')} className="hover:text-amber-400">Cancellation</button>}
            {business.privacyPolicy && <button onClick={() => navigate('privacy')} className="hover:text-amber-400">Privacy Policy</button>}
            {business.termsPolicy && <button onClick={() => navigate('terms')} className="hover:text-amber-400">Terms &amp; Conditions</button>}
          </div>
          <div>© {new Date().getFullYear()} {business.name}. All rights reserved.{business.gstin ? ` · GSTIN: ${business.gstin}` : ''}</div>
          {adminAuth && <button onClick={() => setPage('admin')} className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1"><Lock size={11} /> Admin Panel</button>}
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
                shopCart.length === 0 ? <div className="text-center py-12 px-4"><div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><ShoppingBag size={26} className="text-amber-500" /></div><div className="font-semibold text-slate-900 mb-1">Your cart is empty</div><div className="text-sm text-slate-500 max-w-[240px] mx-auto mb-4">Looks like you haven't added anything yet. Explore our collection to get started.</div><button onClick={() => { setShowCart(false); navigate('catalog'); }} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg">Browse products</button></div> : (
                  <>
                    {shopCart.map(it => {
                      const orig = retailUnitPrice(it, it.qty);
                      const unit = discountedUnitPrice(it, it.qty);
                      const dPct = discPctFor(it);
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
                            <div className="text-sm mt-1">₹{unit.toLocaleString('en-IN')} × {it.qty} = <span className="font-semibold">₹{(unit * it.qty).toLocaleString('en-IN')}</span>{dPct > 0 && <span className="text-xs text-green-600 ml-1">({dPct}% off)</span>}{unit < orig && dPct === 0 && <span className="text-xs text-amber-600 ml-1">(bulk price)</span>}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center mt-4 py-3 border-t text-lg"><span className="font-semibold">Subtotal</span><span className="font-bold">₹{shopCart.reduce((a, it) => a + discountedUnitPrice(it, it.qty) * it.qty, 0).toLocaleString('en-IN')}</span></div>
                    {(() => { const sav = shopCart.reduce((a, it) => a + (retailUnitPrice(it, it.qty) - discountedUnitPrice(it, it.qty)) * it.qty, 0); return sav > 0 ? <div className="text-sm text-green-600 -mt-2 mb-1">You save ₹{sav.toLocaleString('en-IN')}</div> : null; })()}
                    <div className="text-xs text-slate-500 mb-3">Taxes and shipping are confirmed at checkout.</div>
                    <button onClick={() => { setShowCart(false); setShowCheckout(true); }} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold">Checkout →</button>
                    <button onClick={() => setShopCart([])} className="w-full text-slate-500 hover:text-red-500 text-sm mt-3 py-2">Clear cart</button>
                    {business.paymentNote && <div className="mt-3 text-xs text-slate-500 flex items-start gap-2"><Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" /><span>{business.paymentNote}</span></div>}
                  </>
                )
              ) : (
                inquiryList.length === 0 ? <div className="text-center py-12 px-4"><div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><ListChecks size={26} className="text-amber-500" /></div><div className="font-semibold text-slate-900 mb-1">Your inquiry list is empty</div><div className="text-sm text-slate-500 max-w-[240px] mx-auto mb-4">Add products to request a quote, then send your inquiry from here.</div><button onClick={() => { setShowCart(false); navigate('catalog'); }} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg">Browse products</button></div> : (
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
      {recovery && <RecoveryModal accessToken={recovery.accessToken} refreshToken={recovery.refreshToken} onAuthed={(d) => { applyCustomerSession(d); if (d && d.user) { syncCustomerToSheet(customerProfile(d.user), 'login'); syncCustomerToSupabase(customerProfile(d.user), d.access_token); } }} onClose={() => setRecovery(null)} />}
      {showSizeGuide && <SizeGuideModal business={business} onClose={() => setShowSizeGuide(false)} />}
      {showAccount && <AccountModal customer={customer} business={business} inquiryHistory={inquiryHistory} orderHistory={orderHistory} initialTab={accountTab} onAuthed={(d, event) => { applyCustomerSession(d); if (d && d.user) { syncCustomerToSheet(customerProfile(d.user), event); syncCustomerToSupabase(customerProfile(d.user), d.access_token); } setShowAccount(false); }} onLogout={logoutCustomer} onProfileUpdated={onCustomerProfileUpdated} onBrowse={() => { setShowAccount(false); navigate('catalog'); }} onClose={() => setShowAccount(false)} />}

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
            <PasswordInput value={adminPwd} onChange={e => { setAdminPwd(e.target.value); setPwdError(''); }} onKeyDown={e => e.key === 'Enter' && tryAdminLogin()} placeholder="Enter password" className="w-full px-4 py-3 border rounded-lg mb-3" autoFocus />
            {pwdError && <div className="text-red-500 text-sm mb-3">{pwdError}</div>}
            <button onClick={tryAdminLogin} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold">Login</button>
            <button onClick={() => { setShowAdminLogin(false); setPwdError(''); setAdminPwd(''); }} className="w-full text-slate-500 hover:text-slate-700 text-sm mt-3 py-2">Cancel</button>
          </div>
        </div>
      )}

      {toast && <div className="ws-toast fixed bottom-40 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5"><CheckCircle size={18} className="text-green-400 flex-shrink-0" /><span className="text-sm">{toast}</span></div>}
    </div>
  );
}
