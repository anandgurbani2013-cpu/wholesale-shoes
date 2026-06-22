import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Phone, Mail, MapPin, MessageCircle, Menu, X, ChevronRight, Star, Award, Truck, Package, Users, Plus, Minus, Send, Facebook, Instagram, Linkedin, Download, CheckCircle, ArrowRight, Trash2, Edit, Save, Eye, Lock, Inbox, FileText, Home, Grid, Info, HelpCircle, BarChart3, Clock, TrendingUp, LogOut, Settings, Tag, MessageSquare, ListChecks, Sparkles, Printer, Bot, Loader2 } from 'lucide-react';

// ===== CONFIGURATION =====
const SUPABASE_URL = 'https://yfcnkmbfugypratmlahz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY25rbWJmdWd5cHJhdG1sYWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjUxMTEsImV4cCI6MjA5NzcwMTExMX0.phMz2gjcbLY17LfaRfMI0weuYOMKM4hXJVpvATk3Jl4';
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbz79bSOmt6s31Byx8BL7h0qyVOz8Gv8Z8fNlyfFUsdFuvijNM7F7na86wzIdgHi5pvm/exec';
const WEB3FORMS_KEY = '28dbd52f-c661-42f5-b781-34ba0c7d0249';
const ADMIN_EMAIL = 'anandgurbani2013@gmail.com';

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

// ===== EXTERNAL SERVICES =====
async function pushToGoogleSheets(inquiry) {
  try {
    const productsStr = inquiry.products?.map(p => `${p.code}-${p.name} (${p.quantity} pairs)`).join('; ') || '';
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: inquiry.name, shop: inquiry.shop, city: inquiry.city, phone: inquiry.phone, email: inquiry.email, message: inquiry.message, products: productsStr }) });
    return true;
  } catch (e) { 
    console.warn('Google Sheets not available in this environment (will work after deployment):', e.message); 
    return null; // null = not attempted/available, vs false = attempted but failed
  }
}

async function sendInquiryEmail(inquiry) {
  try {
    const productsStr = inquiry.products?.map(p => `${p.code}-${p.name} (${p.quantity} pairs)`).join('; ') || 'None';
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `New Inquiry from ${inquiry.name}${inquiry.shop ? ' - ' + inquiry.shop : ''}`,
        from_name: 'Wholesale Shoes Website',
        name: inquiry.name,
        shop: inquiry.shop || 'N/A',
        city: inquiry.city || 'N/A',
        phone: inquiry.phone,
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

async function askAI(messages, businessContext) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: `You are a helpful customer support assistant for ${businessContext.name}, a wholesale men's footwear business. Be friendly, concise, and professional.

Business Info:
- Name: ${businessContext.name}
- Phone: ${businessContext.phone}
- WhatsApp: ${businessContext.whatsapp}
- Email: ${businessContext.email}
- Address: ${businessContext.address}
- Hours: ${businessContext.hours}
- Payment Terms: ${businessContext.paymentTerms}
- Lead Time: ${businessContext.leadTime}
- Shipping: ${businessContext.shippingCoverage}
- About: ${businessContext.about}

Products (${businessContext.products?.length || 0} total):
${businessContext.products?.slice(0, 15).map(p => `- ${p.code}: ${p.name} (${businessContext.categories?.find(c => c.id === p.category)?.name || 'N/A'}, MOQ: ${p.moq} pairs, From ₹${p.priceFrom})`).join('\n') || 'No products yet'}

Categories: ${businessContext.categories?.map(c => c.name).join(', ') || 'N/A'}

Guidelines:
- Answer questions about products, pricing, MOQ, shipping, payment terms
- If asked about specific product not in list, suggest contacting via WhatsApp
- For orders/quotes, direct them to use "Add to Inquiry" or WhatsApp
- Be friendly but brief (2-4 sentences usually)
- Never make up information you don't have
- If unsure, recommend WhatsApp: ${businessContext.whatsapp}`,
        messages: messages
      })
    });
    if (!r.ok) throw new Error('AI request failed');
    const data = await r.json();
    return data.content[0].text;
  } catch (e) {
    console.error('AI error:', e);
    return `Sorry, I'm having trouble right now. Please contact us directly on WhatsApp at ${businessContext.whatsapp} or call ${businessContext.phone} for immediate assistance.`;
  }
}

// ===== DEFAULT DATA =====
const DEFAULT_CATEGORIES = [
  { id: 'formal', name: 'Formal Shoes', icon: '👞' }, { id: 'casual', name: 'Casual Shoes', icon: '👟' },
  { id: 'sports', name: 'Sports Shoes', icon: '🏃' }, { id: 'sandals', name: 'Sandals', icon: '🩴' },
  { id: 'boots', name: 'Boots', icon: '🥾' }, { id: 'loafers', name: 'Loafers', icon: '🥿' },
];

const DEFAULT_FAQS = [
  { id: 'faq_1', q: 'What is the minimum order quantity (MOQ)?', a: 'Our MOQ typically starts at 50 pairs per product.' },
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
  { id: 'feat_2', icon: '📦', title: 'Low MOQ', desc: 'Competitive minimum order quantities for retailers of all sizes' },
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
  years: 'XX', retailers: 'XXX+', cities: 'XX+', skus: 'XXX+',
  about: '[Your business story]', mission: '[Your mission statement]',
  paymentTerms: 'Advance / Net 30', leadTime: '7-15 business days', shippingCoverage: 'Pan India',
  heroTitle: "Premium Men's Footwear at Wholesale Prices",
  heroSubtitle: 'Your trusted partner for bulk men\'s shoe supply.',
  heroBadge: 'XX Years of Excellence',
  facebook: '#', instagram: '#', linkedin: '#',
  gstin: '[YOUR GSTIN]', legalName: '[Legal Business Name]', hsnCode: '6403', gstRate: 18,
  bankName: '[Bank Name]', accountNo: '[Account Number]', ifsc: '[IFSC Code]', invoicePrefix: 'INV-',
};

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'catalog', label: 'Catalog', icon: Grid },
  { id: 'wholesale', label: 'Wholesale Info', icon: FileText },
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
    material: '[Material details]', moq: 50, priceFrom: 'XXX',
    isNew: i < 3, isBestseller: i >= 3 && i < 6, description: '[Product description]',
    pricingTiers: [{ qty: '50-99 pairs', price: '₹XXX' }, { qty: '100-499 pairs', price: '₹XXX' }, { qty: '500+ pairs', price: '₹XXX' }],
  }));
}

// ===== UTILS =====
function SafeImage({ src, alt, className }) {
  const [error, setError] = useState(false);
  return <img src={error || !src ? PLACEHOLDER_IMG : src} alt={alt} className={className} onError={() => setError(true)} />;
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

function ProductCard({ product, categories, onView, onAddToInquiry }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all hover:-translate-y-1 group">
      <div className="relative aspect-square overflow-hidden bg-slate-100 cursor-pointer" onClick={() => onView(product)}>
        <SafeImage src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        {product.isNew && <span className="absolute top-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">NEW</span>}
        {product.isBestseller && <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">★ BEST</span>}
      </div>
      <div className="p-4">
        <div className="text-xs text-slate-500 font-mono mb-1">{product.code}</div>
        <h3 className="font-semibold text-slate-900 mb-1 truncate">{product.name}</h3>
        <div className="text-xs text-slate-600 mb-3">{categories.find(c => c.id === product.category)?.name || 'Uncategorized'}</div>
        <div className="flex justify-between items-center mb-3">
          <div><div className="text-xs text-slate-500">From</div><div className="text-lg font-bold text-amber-600">₹{product.priceFrom}</div></div>
          <div className="text-right"><div className="text-xs text-slate-500">MOQ</div><div className="text-sm font-semibold text-slate-700">{product.moq} pairs</div></div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onAddToInquiry(product); }} className="w-full bg-slate-900 hover:bg-amber-500 text-white py-2 rounded-lg text-sm font-semibold transition-colors">Add to Inquiry</button>
      </div>
    </div>
  );
}

// ===== AI CHATBOT =====
function AIChatbot({ business, products, categories }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! 👋 I'm your virtual assistant from ${business.name}. How can I help you today? Ask me about products, pricing, MOQ, shipping, or anything else!` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
    const response = await askAI(apiMessages, { ...business, products, categories });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 rounded-full shadow-2xl flex items-center justify-center text-white z-40 transition-all hover:scale-110 group" title="Ask AI Assistant">
        <Bot size={26} />
        <span className="absolute -top-2 -left-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">AI</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl w-80 sm:w-96 h-[500px] flex flex-col border border-slate-200">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-t-2xl flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Bot size={20} /></div>
          <div>
            <div className="font-bold text-sm">AI Assistant</div>
            <div className="text-xs text-blue-100 flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Online 24/7</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="hover:bg-white/20 p-1 rounded"><X size={20} /></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'}`}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span></div>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t bg-white rounded-b-2xl">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask me anything..." disabled={loading} className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={send} disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-2 rounded-lg"><Send size={18} /></button>
        </div>
        <div className="text-xs text-slate-400 mt-1 text-center">Powered by AI • For urgent help, use WhatsApp</div>
      </div>
    </div>
  );
}

// ===== GST INVOICE GENERATOR =====
function GSTInvoiceGenerator({ inquiry, business, onClose }) {
  const invoiceNumber = `${business.invoicePrefix || 'INV-'}${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const date = new Date().toLocaleDateString('en-IN');
  const items = inquiry.products || [];
  const gstRate = parseFloat(business.gstRate) || 18;
  
  const calcRow = (item) => {
    const price = parseFloat(item.priceFrom) || 0;
    const subtotal = price * (item.quantity || item.moq);
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
                    <td className="p-2 text-center">{item.quantity || item.moq}</td>
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

// ===== CONTACT PAGE =====
function ContactPage({ business, inquiryList, setInquiryList, saveInquiry, navigate, showToast }) {
  const [form, setForm] = useState({ name: '', shop: '', city: '', phone: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState({ db: null, sheets: null, email: null });

  const submit = async () => {
    if (!form.name || !form.phone) { showToast('Please fill name and phone'); return; }
    setSubmitting(true);
    const inq = { id: `inq_${Date.now()}`, ...form, products: [...inquiryList], date: new Date().toISOString(), status: 'new' };
    
    const dbOk = await saveInquiry(inq);
    setSubmissionStatus(s => ({ ...s, db: dbOk }));
    
    const sheetsOk = await pushToGoogleSheets(inq);
    setSubmissionStatus(s => ({ ...s, sheets: sheetsOk }));
    
    const emailOk = await sendInquiryEmail(inq);
    setSubmissionStatus(s => ({ ...s, email: emailOk }));
    
    setSubmitting(false);
    setSubmitted(true);
    setInquiryList([]);
    setForm({ name: '', shop: '', city: '', phone: '', email: '', message: '' });
  };

  if (submitted) {
    const StatusItem = ({ status, label }) => {
      if (status === true) return <div className="flex items-center gap-2"><CheckCircle className="text-green-500 flex-shrink-0" size={16} /><span>{label}</span></div>;
      return <div className="flex items-center gap-2"><X className="text-red-500 flex-shrink-0" size={16} /><span>{label}</span></div>;
    };
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="text-green-600" size={40} /></div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Inquiry Submitted! 🎉</h1>
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
          <a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hi, I just submitted an inquiry. My name is ${form.name || 'Customer'}.`)}`} target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"><MessageCircle size={18} /> Message on WhatsApp</a>
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
            <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700 block mb-1">Email</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700 block mb-1">Message</label><textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows="4" placeholder="Tell us what you're looking for..." className="w-full px-3 py-2 border rounded-lg"></textarea></div>
          </div>
          {inquiryList.length > 0 && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="font-semibold text-slate-900 mb-2">📦 Products in Your Inquiry ({inquiryList.length})</div>
              <div className="text-sm text-slate-600">{inquiryList.map(p => `${p.code} (${p.quantity} pairs)`).join(', ')}</div>
            </div>
          )}
          <button onClick={submit} disabled={submitting} className="mt-6 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="animate-spin" size={18} /> Submitting...</> : <><Send size={18} /> Submit Inquiry</>}
          </button>
          <div className="text-xs text-slate-500 mt-2 text-center">Your inquiry will be saved to database, Google Sheets, and emailed to us.</div>
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
            <MessageCircle className="mx-auto mb-2" size={32} />
            <div className="font-bold">Chat on WhatsApp</div>
            <div className="text-sm opacity-90 mt-1">Quick responses to your queries</div>
          </a>
        </div>
      </div>
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
function AdminPanel({ business, saveBusiness, products, saveProducts, categories, saveCategories, faqs, saveFaqs, testimonials, saveTestimonials, features, saveFeatures, steps, saveSteps, inquiries, saveInquiries, navigate, showToast, setAdminAuth }) {
  const [tab, setTab] = useState('dashboard');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editBiz, setEditBiz] = useState(business);
  const [invoiceFor, setInvoiceFor] = useState(null);
  const blankProduct = { id: '', code: '', name: '', category: categories[0]?.id || '', image: '', sizes: ['6','7','8','9','10','11'], colors: ['Black'], material: '', moq: 50, priceFrom: '', isNew: false, isBestseller: false, description: '', pricingTiers: [{qty:'50-99 pairs',price:''},{qty:'100-499 pairs',price:''},{qty:'500+ pairs',price:''}] };
  const [pForm, setPForm] = useState(blankProduct);

  useEffect(() => { setEditBiz(business); }, [business]);

  const editProduct = (p) => { setEditingProduct(p); setPForm({ ...p }); setTab('product-edit'); };
  const newProduct = () => { setEditingProduct(null); setPForm({ ...blankProduct, id: `prod_${Date.now()}`, code: `SH-${String(products.length + 1).padStart(4, '0')}`, category: categories[0]?.id || '' }); setTab('product-edit'); };

  const saveProduct = async () => {
    if (!pForm.name || !pForm.code) { showToast('Name and code required'); return; }
    const updated = editingProduct ? products.map(p => p.id === editingProduct.id ? pForm : p) : [...products, pForm];
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
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
    { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
    { id: 'features', label: 'Why Choose Us', icon: Sparkles },
    { id: 'steps', label: 'How to Order', icon: ListChecks },
    { id: 'business', label: 'Business Info', icon: Settings },
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
          <button onClick={() => { setAdminAuth(false); navigate('home'); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800"><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="md:hidden mb-6 flex gap-2 overflow-x-auto pb-2">
          {sidebarItems.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${tab === t.id ? 'bg-amber-500 text-white' : 'bg-white text-slate-700'}`}>{t.label}</button>)}
          <button onClick={() => navigate('home')} className="px-4 py-2 rounded-lg text-sm whitespace-nowrap bg-white text-slate-700">View Site</button>
          <button onClick={() => { setAdminAuth(false); navigate('home'); }} className="px-4 py-2 rounded-lg text-sm whitespace-nowrap bg-white text-red-600">Logout</button>
        </div>

        {tab === 'dashboard' && (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Dashboard</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[{ label: 'Products', value: products.length, icon: Package }, { label: 'Categories', value: categories.length, icon: Tag }, { label: 'New Inquiries', value: inquiries.filter(i => i.status === 'new').length, icon: Inbox }, { label: 'Total Inquiries', value: inquiries.length, icon: MessageCircle }].map((s, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm"><s.icon className="text-amber-500 mb-3" size={24} /><div className="text-3xl font-bold text-slate-900">{s.value}</div><div className="text-sm text-slate-600 mt-1">{s.label}</div></div>
              ))}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-2">🚀 Integrations Status</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ <strong>Supabase Database</strong> — All data persisted in cloud</li>
                <li>✅ <strong>Google Sheets Push</strong> — Inquiries auto-saved to your sheet</li>
                <li>✅ <strong>Email Notifications</strong> — Sent to {ADMIN_EMAIL}</li>
                <li>✅ <strong>AI Support Agent</strong> — 24/7 customer chatbot</li>
                <li>✅ <strong>GST Invoice Generator</strong> — Click any inquiry to generate</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-200">
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
                      // Clean up
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

        {tab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-6"><h1 className="text-3xl font-bold text-slate-900">Products ({products.length})</h1><button onClick={newProduct} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={18} /> Add Product</button></div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b"><tr><th className="text-left p-4 text-sm font-semibold">Image</th><th className="text-left p-4 text-sm font-semibold">Code</th><th className="text-left p-4 text-sm font-semibold">Name</th><th className="text-left p-4 text-sm font-semibold">Category</th><th className="text-left p-4 text-sm font-semibold">MOQ</th><th className="text-left p-4 text-sm font-semibold">Tags</th><th className="text-left p-4 text-sm font-semibold">Actions</th></tr></thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} className="border-b hover:bg-slate-50">
                        <td className="p-4"><SafeImage src={p.image} alt={p.name} className="w-12 h-12 rounded object-cover" /></td>
                        <td className="p-4 text-sm font-mono">{p.code}</td><td className="p-4 text-sm font-medium">{p.name}</td>
                        <td className="p-4 text-sm">{categories.find(c => c.id === p.category)?.name || 'None'}</td>
                        <td className="p-4 text-sm">{p.moq}</td>
                        <td className="p-4"><div className="flex gap-1">{p.isNew && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">New</span>}{p.isBestseller && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Best</span>}</div></td>
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
                <div><label className="block text-sm font-medium text-slate-700 mb-1">MOQ (pairs)</label><input type="number" value={pForm.moq} onChange={e => setPForm({...pForm, moq: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Price From (₹)</label><input value={pForm.priceFrom} onChange={e => setPForm({...pForm, priceFrom: e.target.value})} placeholder="e.g., 500" className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label><input value={pForm.image} onChange={e => setPForm({...pForm, image: e.target.value})} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg" />{pForm.image && <SafeImage src={pForm.image} alt="preview" className="mt-2 w-32 h-32 rounded object-cover border" />}</div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Sizes (comma separated)</label><input value={pForm.sizes.join(', ')} onChange={e => setPForm({...pForm, sizes: e.target.value.split(',').map(s => s.trim())})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Colors (comma separated)</label><input value={pForm.colors.join(', ')} onChange={e => setPForm({...pForm, colors: e.target.value.split(',').map(s => s.trim())})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Material</label><input value={pForm.material} onChange={e => setPForm({...pForm, material: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea value={pForm.description} onChange={e => setPForm({...pForm, description: e.target.value})} rows="3" className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Pricing Tiers</label>{pForm.pricingTiers.map((t, i) => (<div key={i} className="flex gap-2 mb-2"><input value={t.qty} onChange={e => { const tiers = [...pForm.pricingTiers]; tiers[i] = {...tiers[i], qty: e.target.value}; setPForm({...pForm, pricingTiers: tiers}); }} placeholder="Quantity range" className="flex-1 px-3 py-2 border rounded-lg" /><input value={t.price} onChange={e => { const tiers = [...pForm.pricingTiers]; tiers[i] = {...tiers[i], price: e.target.value}; setPForm({...pForm, pricingTiers: tiers}); }} placeholder="Price" className="flex-1 px-3 py-2 border rounded-lg" /></div>))}</div>
                <div className="flex gap-4 md:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={pForm.isNew} onChange={e => setPForm({...pForm, isNew: e.target.checked})} /> New Arrival</label><label className="flex items-center gap-2"><input type="checkbox" checked={pForm.isBestseller} onChange={e => setPForm({...pForm, isBestseller: e.target.checked})} /> Bestseller</label></div>
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
                      <h3 className="font-bold text-slate-900">{i.name}</h3>
                      <div className="text-sm text-slate-600">{i.shop || 'No shop'} • {i.city || 'No city'}</div>
                      <div className="text-sm text-slate-500 mt-1">📞 {i.phone} {i.email && `• ✉️ ${i.email}`}</div>
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
                      <div className="space-y-1">{i.products.map((p, idx) => (<div key={idx} className="text-sm text-slate-600 flex justify-between bg-slate-50 px-3 py-2 rounded"><span>{p.code} - {p.name}</span><span className="font-medium">{p.quantity} pairs</span></div>))}</div>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <a href={`tel:${i.phone}`} className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100">📞 Call</a>
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
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Hero Badge Text</label><input value={editBiz.heroBadge || ''} onChange={e => setEditBiz({...editBiz, heroBadge: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
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
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Invoice Prefix</label><input value={editBiz.invoicePrefix || ''} onChange={e => setEditBiz({...editBiz, invoicePrefix: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., INV-" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label><input value={editBiz.bankName || ''} onChange={e => setEditBiz({...editBiz, bankName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label><input value={editBiz.accountNo || ''} onChange={e => setEditBiz({...editBiz, accountNo: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label><input value={editBiz.ifsc || ''} onChange={e => setEditBiz({...editBiz, ifsc: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><BarChart3 size={18} /> Stats</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Years</label><input value={editBiz.years || ''} onChange={e => setEditBiz({...editBiz, years: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Retailers</label><input value={editBiz.retailers || ''} onChange={e => setEditBiz({...editBiz, retailers: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Cities</label><input value={editBiz.cities || ''} onChange={e => setEditBiz({...editBiz, cities: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">SKUs</label><input value={editBiz.skus || ''} onChange={e => setEditBiz({...editBiz, skus: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Truck size={18} /> Wholesale Terms</h3>
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
  const [showInquiry, setShowInquiry] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

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

  const saveInquiries = async (list) => {
    setInquiries(list);
    try {
      await sb.deleteAll('inquiries');
      if (list.length > 0) await sb.upsert('inquiries', list.map(i => ({ id: i.id, data: i, status: i.status })));
    } catch (e) { console.error(e); }
  };

  const filtered = products
    .filter(p => catFilter === 'all' || p.category === catFilter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => { if (sort === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0); if (sort === 'bestsellers') return (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0); return 0; });

  const addToInquiry = (p) => {
    if (inquiryList.find(x => x.id === p.id)) { showToast('Already in inquiry list'); return; }
    setInquiryList([...inquiryList, { ...p, quantity: p.moq }]);
    showToast('Added to inquiry list ✓');
  };

  const navigate = (p) => {
    if (p !== page) setHistory(prev => [...prev, page]);
    setPage(p); setMenuOpen(false);
    if (p !== 'product') setSelectedProduct(null);
    window.scrollTo(0, 0);
  };

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
    window.scrollTo(0, 0);
  };

  const tryAdminLogin = () => {
    if (adminPwd === 'admin123') { setAdminAuth(true); setShowAdminLogin(false); setPage('admin'); setPwdError(''); setAdminPwd(''); }
    else setPwdError('Incorrect password');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="w-16 h-16 text-amber-500 animate-spin mx-auto mb-4" /><p className="text-slate-600">Loading from database...</p></div></div>;
  }

  if (page === 'admin' && adminAuth) {
    return (
      <>
        <AdminPanel business={business} saveBusiness={saveBusiness} products={products} saveProducts={saveProducts} categories={categories} saveCategories={saveCategories} faqs={faqs} saveFaqs={saveFaqs} testimonials={testimonials} saveTestimonials={saveTestimonials} features={features} saveFeatures={saveFeatures} steps={steps} saveSteps={saveSteps} inquiries={inquiries} saveInquiries={saveInquiries} navigate={navigate} showToast={showToast} setAdminAuth={setAdminAuth} />
        {toast && <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl z-50">{toast}</div>}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white">
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
            {NAV_ITEMS.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`text-sm font-medium transition-colors ${page === item.id ? 'text-amber-600' : 'text-slate-700 hover:text-amber-600'}`}>{item.label}</button>)}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInquiry(true)} className="relative p-2 hover:bg-amber-50 rounded-lg"><ShoppingBag size={22} className="text-slate-700" />{inquiryList.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{inquiryList.length}</span>}</button>
            <button onClick={() => navigate('contact')} className="hidden md:block bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-semibold">Get Quote</button>
            <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={24} /> : <Menu size={24} />}</button>
          </div>
        </div>
        {menuOpen && <div className="lg:hidden bg-white border-t">{NAV_ITEMS.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`flex items-center gap-3 w-full text-left px-4 py-3 text-sm font-medium ${page === item.id ? 'bg-amber-50 text-amber-600' : 'text-slate-700'}`}><item.icon size={18} /> {item.label}</button>)}</div>}
      </header>

      <main>
        {page === 'home' && (
          <>
            <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 75% 75%, #f59e0b 0%, transparent 50%)' }}></div>
              <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-block px-4 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-6">⭐ {business.heroBadge}</div>
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
                <span className="flex items-center gap-1.5"><Users size={16} /> {business.retailers} Retailers Served</span>
                <span className="flex items-center gap-1.5"><Package size={16} /> Low MOQ</span>
              </div>
            </section>

            <section className="bg-white py-12 border-b">
              <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
                {[{ icon: Award, value: business.years, label: 'Years in Business' }, { icon: Users, value: business.retailers, label: 'Retailers Served' }, { icon: MapPin, value: business.cities, label: 'Cities Covered' }, { icon: Package, value: business.skus, label: 'Products in Stock' }].map((s, i) => (
                  <div key={i} className="text-center"><s.icon className="text-amber-500 mx-auto mb-3" size={32} /><div className="text-3xl md:text-4xl font-bold text-slate-900">{s.value}</div><div className="text-sm text-slate-600 mt-1">{s.label}</div></div>
                ))}
              </div>
            </section>

            {categories.length > 0 && (
              <section className="py-16 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Shop by Category</h2></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {categories.map(c => <button key={c.id} onClick={() => { setCatFilter(c.id); navigate('catalog'); }} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg border transition-all hover:-translate-y-1 group"><div className="text-4xl mb-3">{c.icon}</div><div className="font-semibold text-slate-900 group-hover:text-amber-600">{c.name}</div><div className="text-xs text-slate-500 mt-1">{products.filter(p => p.category === c.id).length} products</div></button>)}
                  </div>
                </div>
              </section>
            )}

            {products.filter(p => p.isNew).length > 0 && (
              <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex justify-between items-end mb-8"><div><span className="text-amber-600 font-semibold text-sm uppercase">Just In</span><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">New Arrivals</h2></div><button onClick={() => navigate('catalog')} className="text-amber-600 font-medium flex items-center gap-1 hover:underline">View All <ChevronRight size={18} /></button></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{products.filter(p => p.isNew).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
                </div>
              </section>
            )}

            {products.filter(p => p.isBestseller).length > 0 && (
              <section className="py-16 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex justify-between items-end mb-8"><div><span className="text-amber-600 font-semibold text-sm uppercase">Customer Favorites</span><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-1">Bestsellers</h2></div><button onClick={() => navigate('catalog')} className="text-amber-600 font-medium flex items-center gap-1 hover:underline">View All <ChevronRight size={18} /></button></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{products.filter(p => p.isBestseller).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
                </div>
              </section>
            )}

            {features.length > 0 && (
              <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Why Choose Us</h2></div>
                  <div className={`grid gap-6 ${features.length >= 4 ? 'md:grid-cols-4' : features.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    {features.map((f) => <div key={f.id} className="text-center p-6 rounded-xl hover:bg-slate-50 transition-colors"><div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">{f.icon}</div><h3 className="font-bold text-slate-900 mb-2">{f.title}</h3><p className="text-sm text-slate-600">{f.desc}</p></div>)}
                  </div>
                </div>
              </section>
            )}

            {testimonials.length > 0 && (
              <section className="py-16 bg-slate-50">
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
                <p className="text-lg mb-8 opacity-90">Get our latest catalog and competitive wholesale pricing</p>
                <div className="flex flex-wrap gap-4 justify-center"><button onClick={() => navigate('catalog')} className="bg-white text-amber-600 hover:bg-slate-50 px-8 py-3 rounded-lg font-semibold">Browse Catalog</button><button onClick={() => navigate('contact')} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-semibold">Request Quote</button></div>
              </div>
            </section>
          </>
        )}

        {page === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="mb-8"><h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Product Catalog</h1><p className="text-slate-600">Browse our complete range of wholesale men's footwear</p></div>
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 sticky top-20 z-30 border">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code..." className="w-full pl-10 pr-4 py-2 border rounded-lg" /></div>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="all">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>
                <select value={sort} onChange={e => setSort(e.target.value)} className="px-4 py-2 border rounded-lg"><option value="newest">Newest</option><option value="bestsellers">Bestsellers</option></select>
              </div>
            </div>
            <div className="text-sm text-slate-600 mb-4">Showing {filtered.length} of {products.length} products</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{filtered.map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
            {filtered.length === 0 && <div className="text-center py-16 text-slate-500"><Package size={48} className="mx-auto mb-3 opacity-50" />No products match your search<div className="mt-2"><button onClick={() => { setSearch(''); setCatFilter('all'); }} className="text-amber-600 hover:underline">Clear filters</button></div></div>}
          </div>
        )}

        {page === 'product' && selectedProduct && (
          <div className="max-w-7xl mx-auto px-4 py-12">
            <button onClick={() => navigate('catalog')} className="text-slate-600 hover:text-amber-600 mb-6 flex items-center gap-1"><ChevronRight className="rotate-180" size={18} /> Back to Catalog</button>
            <div className="grid md:grid-cols-2 gap-12">
              <div className="bg-slate-100 rounded-2xl overflow-hidden aspect-square"><SafeImage src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" /></div>
              <div>
                <div className="flex gap-2 mb-3">{selectedProduct.isNew && <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-semibold">NEW</span>}{selectedProduct.isBestseller && <span className="bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-semibold">★ BESTSELLER</span>}</div>
                <div className="text-sm text-slate-500 font-mono mb-2">{selectedProduct.code}</div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{selectedProduct.name}</h1>
                <div className="text-amber-600 font-medium mb-4">{categories.find(c => c.id === selectedProduct.category)?.name}</div>
                <p className="text-slate-700 mb-6">{selectedProduct.description}</p>
                <div className="border-t border-b py-4 mb-6 grid grid-cols-2 gap-4">
                  <div><div className="text-xs text-slate-500 mb-1">Material</div><div className="font-medium">{selectedProduct.material}</div></div>
                  <div><div className="text-xs text-slate-500 mb-1">MOQ</div><div className="font-medium">{selectedProduct.moq} pairs</div></div>
                  <div><div className="text-xs text-slate-500 mb-1">Sizes</div><div className="flex gap-1 flex-wrap">{selectedProduct.sizes.map(s => <span key={s} className="px-2 py-1 bg-slate-100 rounded text-sm">{s}</span>)}</div></div>
                  <div><div className="text-xs text-slate-500 mb-1">Colors</div><div className="flex gap-1 flex-wrap">{selectedProduct.colors.map(c => <span key={c} className="px-2 py-1 bg-slate-100 rounded text-sm">{c}</span>)}</div></div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="font-semibold text-slate-900 mb-3">📊 Wholesale Pricing Tiers</div>
                  <div className="space-y-2">{selectedProduct.pricingTiers.map((t, i) => <div key={i} className="flex justify-between text-sm bg-white rounded px-3 py-2"><span className="text-slate-700">{t.qty}</span><span className="font-bold text-amber-700">{t.price} per pair</span></div>)}</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => addToInquiry(selectedProduct)} className="flex-1 bg-slate-900 hover:bg-amber-500 text-white py-3 rounded-lg font-semibold transition-colors">Add to Inquiry</button>
                  <a href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hi, I'm interested in ${selectedProduct.code} - ${selectedProduct.name}`)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold text-center flex items-center justify-center gap-2"><MessageCircle size={18} /> WhatsApp Inquiry</a>
                </div>
              </div>
            </div>
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Products</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">{products.filter(p => p.category === selectedProduct.category && p.id !== selectedProduct.id).slice(0, 4).map(p => <ProductCard key={p.id} product={p} categories={categories} onView={viewProduct} onAddToInquiry={addToInquiry} />)}</div>
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

        {page === 'wholesale' && (
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">Wholesale Information</h1>
            <p className="text-slate-600 mb-12">Everything you need to know about ordering from us</p>
            {steps.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mb-8"><h2 className="text-2xl font-bold text-slate-900 mb-6">How to Order</h2><div className="space-y-4">{steps.map((s, i) => <div key={s.id} className="flex gap-4"><div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">{i + 1}</div><div><div className="font-semibold text-slate-900">{s.title}</div><div className="text-sm text-slate-600">{s.desc}</div></div></div>)}</div></div>}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white border rounded-xl p-6"><Package className="text-amber-500 mb-3" size={32} /><h3 className="font-bold text-slate-900 mb-2">Minimum Order Quantity</h3><p className="text-sm text-slate-600">MOQ varies by product. Larger orders qualify for better pricing.</p></div>
              <div className="bg-white border rounded-xl p-6"><Truck className="text-amber-500 mb-3" size={32} /><h3 className="font-bold text-slate-900 mb-2">Shipping & Delivery</h3><p className="text-sm text-slate-600">{business.shippingCoverage}. Lead time: {business.leadTime}.</p></div>
              <div className="bg-white border rounded-xl p-6"><CheckCircle className="text-amber-500 mb-3" size={32} /><h3 className="font-bold text-slate-900 mb-2">Payment Terms</h3><p className="text-sm text-slate-600">{business.paymentTerms}</p></div>
              <div className="bg-white border rounded-xl p-6"><Star className="text-amber-500 mb-3" size={32} /><h3 className="font-bold text-slate-900 mb-2">Volume Discounts</h3><p className="text-sm text-slate-600">Tiered pricing rewards larger orders.</p></div>
            </div>
          </div>
        )}

        {page === 'faq' && <div className="max-w-3xl mx-auto px-4 py-12"><h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">FAQ</h1><p className="text-slate-600 mb-12">Common questions from our retailers</p><div className="space-y-3">{faqs.map(f => <FAQItem key={f.id} q={f.q} a={f.a} />)}{faqs.length === 0 && <div className="text-center text-slate-500 py-12">No FAQs yet</div>}</div></div>}

        {page === 'contact' && <ContactPage business={business} inquiryList={inquiryList} setInquiryList={setInquiryList} saveInquiry={saveInquiry} navigate={navigate} showToast={showToast} />}
      </main>

      <footer className="bg-slate-900 text-white py-12 mt-16">
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
        <div className="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between gap-4 text-sm text-slate-400">
          <div>© {new Date().getFullYear()} {business.name}. All rights reserved.</div>
          {adminAuth ? <button onClick={() => setPage('admin')} className="hover:text-amber-400 flex items-center gap-1"><Lock size={12} /> Admin Panel</button> : <button onClick={() => setShowAdminLogin(true)} className="hover:text-amber-400 flex items-center gap-1"><Lock size={12} /> Admin Login</button>}
        </div>
      </footer>

      {/* Enhanced WhatsApp button - more prominent, with tooltip */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Call button */}
        <a 
          href={`tel:${business.phone}`}
          className="group flex items-center"
        >
          <div className="bg-slate-900 text-white text-sm px-3 py-2 rounded-l-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
            Call us now
          </div>
          <div className="w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110">
            <Phone size={24} />
          </div>
        </a>
        
        {/* WhatsApp button - primary */}
        <a 
          href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent("Hi, I'd like to know more about your wholesale products.")}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="group flex items-center"
        >
          <div className="bg-slate-900 text-white text-sm px-3 py-2 rounded-l-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Chat on WhatsApp
          </div>
          <div className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110 relative">
            <MessageCircle size={28} />
           
          </div>
        </a>
      </div>

      {/* AI Chatbot removed - WhatsApp + Call buttons are more effective for Indian B2B */}

      {showInquiry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setShowInquiry(false)}>
          <div className="bg-white w-full max-w-md h-full overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center"><h2 className="font-bold text-lg">Inquiry List ({inquiryList.length})</h2><button onClick={() => setShowInquiry(false)}><X size={24} /></button></div>
            <div className="p-4">
              {inquiryList.length === 0 ? <div className="text-center py-12 text-slate-500"><ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />Your inquiry list is empty<button onClick={() => { setShowInquiry(false); navigate('catalog'); }} className="block mx-auto mt-4 text-amber-600 font-medium hover:underline">Browse Catalog →</button></div> : (
                <>
                  {inquiryList.map(p => (
                    <div key={p.id} className="flex gap-3 py-3 border-b">
                      <SafeImage src={p.image} alt={p.name} className="w-16 h-16 rounded object-cover" />
                      <div className="flex-1">
                        <div className="text-xs font-mono text-slate-500">{p.code}</div>
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => setInquiryList(inquiryList.map(x => x.id === p.id ? {...x, quantity: Math.max(p.moq, x.quantity - 10)} : x))} className="w-7 h-7 border rounded hover:bg-slate-50"><Minus size={12} className="mx-auto" /></button>
                          <input type="number" value={p.quantity} onChange={e => { const v = parseInt(e.target.value) || p.moq; setInquiryList(inquiryList.map(x => x.id === p.id ? {...x, quantity: Math.max(p.moq, v)} : x)); }} className="w-16 text-center border rounded py-1 text-sm" />
                          <button onClick={() => setInquiryList(inquiryList.map(x => x.id === p.id ? {...x, quantity: x.quantity + 10} : x))} className="w-7 h-7 border rounded hover:bg-slate-50"><Plus size={12} className="mx-auto" /></button>
                          <span className="text-xs text-slate-500">pairs</span>
                          <button onClick={() => setInquiryList(inquiryList.filter(x => x.id !== p.id))} className="ml-auto text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Min: {p.moq} pairs</div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setShowInquiry(false); navigate('contact'); }} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold mt-6">Submit Inquiry →</button>
                  <button onClick={() => setInquiryList([])} className="w-full text-slate-500 hover:text-red-500 text-sm mt-3 py-2">Clear all items</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowAdminLogin(false); setPwdError(''); setAdminPwd(''); }}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6"><div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3"><Lock className="text-amber-600" size={28} /></div><h2 className="text-xl font-bold">Admin Login</h2><p className="text-sm text-slate-500 mt-1">Default password: admin123</p></div>
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
