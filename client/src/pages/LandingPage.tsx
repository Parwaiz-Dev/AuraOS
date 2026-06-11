import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ContactModal from '../components/ContactModal';
import {
  ChartBarIcon,
  QrCodeIcon,
  CreditCardIcon,
  FireIcon,
  BoltIcon,
  CommandLineIcon,
  InboxStackIcon,
  BeakerIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  Bars3Icon,
  XMarkIcon,
  CheckBadgeIcon,
  SparklesIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

// --- Types ---

interface FAQItem {
  q: string;
  a: string;
}

interface PricingTier {
  name: string;
  tagline: string;
  price: string;
  period: string;
  featured: boolean;
  features: string[];
  cta: string;
}

interface Feature {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

interface TimelineStep {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

interface RestaurantTypeItem {
  icon: React.ReactNode;
  label: string;
  desc: string;
  features: string[];
}

// --- Data (NO fake metrics or testimonials) ---

const FEATURES: Feature[] = [
  {
    icon: <QrCodeIcon className="w-6 h-6" />,
    title: 'QR Order & Pay',
    desc: 'Customers scan, browse your menu, order, and pay — all from their phone. No app install required.',
  },
  {
    icon: <CommandLineIcon className="w-6 h-6" />,
    title: 'Kitchen Display',
    desc: 'Real-time KDS replaces paper tickets. Orders fire instantly to the kitchen with audible alerts.',
  },
  {
    icon: <ChartBarIcon className="w-6 h-6" />,
    title: 'Live Analytics',
    desc: 'Revenue, order trends, top items, and table turnover — all on one dashboard updated in real-time.',
  },
  {
    icon: <CreditCardIcon className="w-6 h-6" />,
    title: 'Integrated Payments',
    desc: 'Accept UPI, cards, and wallets. Settlements are automatic and reconciled daily.',
  },
  {
    icon: <InboxStackIcon className="w-6 h-6" />,
    title: 'Inventory Tracking',
    desc: 'Track raw ingredients and finished goods. Get low-stock alerts before you run out.',
  },
  {
    icon: <BeakerIcon className="w-6 h-6" />,
    title: 'Modifier Engine',
    desc: 'Build complex modifiers — toppings, add-ons, cooking preferences — without menu clutter.',
  },
];

const RESTAURANT_TYPES: RestaurantTypeItem[] = [
  {
    icon: <SparklesIcon className="w-5 h-5" />,
    label: 'Fine Dining',
    desc: 'White-glove service with multi-course menus, wine pairings, and reserved seating.',
    features: ['Table reservations', 'Multi-course menu', 'Section-wise billing', 'Captain assignments'],
  },
  {
    icon: <BoltIcon className="w-5 h-5" />,
    label: 'QSR / Fast Food',
    desc: 'Speed-optimized workflows for high-volume counter service and quick table turnover.',
    features: ['Token display', 'Parcel orders', 'Combo builder', 'Drive-thru support'],
  },
  {
    icon: <GlobeAltIcon className="w-5 h-5" />,
    label: 'Cloud Kitchen',
    desc: 'Delivery-first operations with Zomato/Swiggy integration and ONDC-ready architecture.',
    features: ['Aggregator sync', 'Auto accept', 'Menu mapping', 'Delivery tracking'],
  },
  {
    icon: <FireIcon className="w-5 h-5" />,
    label: 'Café & Bakery',
    desc: 'Handle self-service counters, daily specials, and pre-paid café models effortlessly.',
    features: ['Counter billing', 'Daily specials', 'Pre-paid model', 'Loyalty tracking'],
  },
];

const WORKFLOW: TimelineStep[] = [
  {
    icon: <QrCodeIcon className="w-5 h-5" />,
    title: 'Customer Scans QR',
    desc: 'Placed on every table, the QR takes them to an intelligent menu — no login, no app install.',
  },
  {
    icon: <FireIcon className="w-5 h-5" />,
    title: 'Order Fires to KDS',
    desc: 'Items appear instantly on the kitchen display with priority tagging for VIPs and timed orders.',
  },
  {
    icon: <CreditCardIcon className="w-5 h-5" />,
    title: 'Pay & Close',
    desc: 'Customer pays via UPI/card, the bill is generated automatically, and the table is freed.',
  },
];

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    tagline: 'For single-outlet restaurants getting started.',
    price: '₹999',
    period: '/mo',
    featured: false,
    features: ['1 outlet', 'QR ordering', 'Basic KDS', '5 staff accounts', 'Email support'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Growth',
    tagline: 'For growing restaurants that need automation.',
    price: '₹2,499',
    period: '/mo',
    featured: true,
    features: ['Up to 3 outlets', 'Advanced KDS', 'Inventory tracking', 'Payment integration', 'Analytics dashboard', 'Priority support'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    tagline: 'For multi-outlet chains with custom needs.',
    price: 'Custom',
    period: '',
    featured: false,
    features: ['Unlimited outlets', 'White-label menu', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee', '24×7 phone support'],
    cta: 'Contact Sales',
  },
];

const FAQ_ITEMS: FAQItem[] = [
  { q: 'How long does onboarding take?', a: 'Most restaurants go live within 24 hours. We provide a guided setup wizard and optional 1-on-1 onboarding call.' },
  { q: 'Do I need special hardware?', a: 'No. AuraOS runs on any modern browser. For the kitchen display, we recommend a tablet or a budget Android device mounted on the wall.' },
  { q: 'Can I try before committing?', a: 'Yes. Every plan includes a 14-day free trial with no credit card required. You can upgrade or cancel anytime.' },
  { q: 'Does it integrate with Zomato & Swiggy?', a: 'Growth and Enterprise plans include aggregator menu sync. Orders from Zomato/Swiggy flow directly into your KDS.' },
  { q: 'Is my data secure?', a: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We run daily encrypted backups with a 30-day retention window.' },
  { q: 'What support do you offer?', a: 'Starter includes email support. Growth adds priority chat. Enterprise includes a dedicated account manager and 24×7 phone support.' },
];

// --- Components ---

const FAQAccordion: React.FC<{ items: FAQItem[] }> = ({ items }) => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto divide-y divide-[#1e293b]">
      {items.map((item, i) => (
        <div key={i} className="py-5">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between text-left group"
          >
            <span className="text-base font-medium text-white group-hover:text-[#3b82f6] transition-colors">{item.q}</span>
            <span className={`ml-4 flex-shrink-0 text-xl text-slate-500 transition-transform duration-200 ${open === i ? 'rotate-45' : ''}`}>+</span>
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${open === i ? 'mt-3 max-h-48' : 'max-h-0'}`}>
            <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const SectionHeading: React.FC<{ overline?: string; title: string; subtitle: string; center?: boolean }> = ({ overline, title, subtitle, center = true }) => (
  <div className={`mb-14 ${center ? 'text-center' : ''}`}>
    {overline && <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#3b82f6] mb-3">{overline}</p>}
    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">{title}</h2>
    <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">{subtitle}</p>
  </div>
);

// --- Main Landing Page ---

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    } else {
      setAuthChecked(true);
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!authChecked || isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans selection:bg-[#3b82f6]/30">

      {/* ==================== NAVBAR ==================== */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#030712]/80 backdrop-blur-xl border-b border-white/[0.06]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-[#3b82f6]/25 group-hover:shadow-[#3b82f6]/40 transition-shadow">A</span>
              <span className="text-lg font-bold tracking-tight text-white">Aura<span className="text-[#3b82f6]">OS</span></span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-6">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={() => setShowContactModal(true)}
                className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2"
              >
                Book Demo
              </button>
              <Link
                to="/login"
                className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium px-5 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-all hover:shadow-lg hover:shadow-white/10"
              >
                Get Started →
              </Link>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors"
            >
              {navOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ${navOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className="bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/[0.06] px-4 py-4 space-y-3">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setNavOpen(false)}
                className="block text-sm text-slate-400 hover:text-white py-2 transition-colors"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 border-t border-white/[0.06] flex gap-2">
              <button onClick={() => { setShowContactModal(true); setNavOpen(false); }} className="flex-1 text-center text-sm py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-all">Book Demo</button>
              <Link to="/login" onClick={() => setNavOpen(false)} className="flex-1 text-center text-sm py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-all">Sign In</Link>
              <Link to="/register" onClick={() => setNavOpen(false)} className="flex-1 text-center text-sm font-medium py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-all">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ==================== HERO ==================== */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center pt-16 overflow-hidden"
      >
        {/* Floating gradient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-48 left-1/4 w-[600px] h-[600px] bg-[#3b82f6]/20 rounded-full blur-[140px] animate-float-blob" />
          <div className="absolute top-1/3 -right-24 w-[500px] h-[500px] bg-[#8b5cf6]/18 rounded-full blur-[130px] animate-float-blob-slow" />
          <div className="absolute -bottom-48 left-1/3 w-[450px] h-[450px] bg-[#ec4899]/12 rounded-full blur-[120px] animate-float-blob" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#06b6d4]/10 rounded-full blur-[100px]" />
        </div>

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIvPjxwYXRoIGQ9Ik0zNiAyNGMwLTMuMzE0IDIuNjg2LTYgNi02czYgMi42ODYgNiA2LTIuNjg2IDYtNiA2LTYtMi42ODYtNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-medium mb-6">
                <SparklesIcon className="w-3.5 h-3.5" />
                Now in Early Access
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
                <span className="text-white">The Operating System</span>
                <br />
                <span className="bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#ec4899] bg-clip-text text-transparent">
                  for Modern Restaurants
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
                QR ordering, kitchen display, inventory, payments, and analytics — one platform that runs every corner of your restaurant in real time.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => setShowContactModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#3b82f6]/30 transition-all hover:-translate-y-0.5"
                >
                  Book Demo
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-all font-semibold text-sm"
                >
                  Start Free Trial
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: Dashboard mockup with floating cards */}
            <div className="relative">
              {/* Main mockup card */}
              <div className="relative rounded-2xl border border-white/[0.08] bg-[#0f172a]/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40 animate-glow-pulse">
                {/* Mock title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <span className="ml-2 text-[10px] text-slate-500 font-mono">dashboard.auraos.io</span>
                </div>
                {/* Mock content */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Stat row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Today's Revenue", val: '₹24,580', color: '#3b82f6' },
                      { label: 'Orders', val: '142', color: '#8b5cf6' },
                      { label: 'Active Tables', val: '18/24', color: '#06b6d4' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                        <div className="text-[10px] text-slate-500 font-medium mb-1">{stat.label}</div>
                        <div className="text-sm font-bold text-white" style={{ color: stat.color }}>{stat.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Chart placeholder */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] h-32 flex items-end gap-1 p-3">
                    {[60, 35, 80, 45, 55, 90, 30, 70, 50, 85, 40, 95, 65, 75, 55, 88, 72, 48, 92, 38].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-[#3b82f6]/50 to-[#8b5cf6]/40" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  {/* Tab pills */}
                  <div className="flex gap-2">
                    {['Dashboard', 'Orders', 'Tables', 'Menu'].map((tab, i) => (
                      <span key={tab} className={`text-[10px] px-3 py-1.5 rounded-full font-medium ${i === 0 ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'text-slate-500'}`}>{tab}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating card 1 — top right */}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 rounded-xl bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/30 p-3 sm:p-4 animate-float-blob">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4 text-[#06b6d4]" />
                  <span className="text-xs font-medium text-white whitespace-nowrap">99.9% Uptime</span>
                </div>
              </div>

              {/* Floating card 2 — bottom left */}
              <div className="absolute -bottom-3 -left-3 sm:-bottom-5 sm:-left-5 rounded-xl bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/30 p-3 sm:p-4 animate-float-blob-slow">
                <div className="flex items-center gap-2">
                  <CheckBadgeIcon className="w-4 h-4 text-[#8b5cf6]" />
                  <span className="text-xs font-medium text-white whitespace-nowrap">SOC 2 Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section id="features" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            overline="Platform"
            title="Everything your restaurant needs"
            subtitle="A unified stack that replaces 5+ separate tools — from QR ordering to kitchen display to analytics."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 hover:border-white/[0.14] hover:bg-white/[0.04] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 flex items-center justify-center text-[#3b82f6] mb-4 group-hover:scale-110 transition-transform duration-300">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== RESTAURANT TYPES ==================== */}
      <section id="types" className="relative py-20 lg:py-28 scroll-mt-20 bg-[#0f172a]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            overline="Built for"
            title="Every type of restaurant"
            subtitle="Fine dining, QSR, cloud kitchens, and cafés — AuraOS adapts to your workflow, not the other way around."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {RESTAURANT_TYPES.map((rt) => (
              <div
                key={rt.label}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5 hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#8b5cf6]/20 to-[#ec4899]/20 flex items-center justify-center text-[#8b5cf6] mb-3">
                  {rt.icon}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{rt.label}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{rt.desc}</p>
                <ul className="space-y-1">
                  {rt.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="w-1 h-1 rounded-full bg-[#3b82f6]/60" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== WORKFLOW ==================== */}
      <section className="relative py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            overline="How it works"
            title="From scan to payment in seconds"
            subtitle="A frictionless flow designed for both your customers and your staff."
          />
          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {WORKFLOW.map((step, i) => (
              <div key={step.title} className="text-center relative">
                {/* Connector line */}
                {i < WORKFLOW.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-white/10 to-white/5" />
                )}
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/20 border border-white/[0.08] flex items-center justify-center text-[#3b82f6] mb-4">
                  {step.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== SCREENSHOTS ==================== */}
      <section className="relative py-20 lg:py-28 bg-[#0f172a]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            overline="Interface"
            title="Clean, intuitive, fast"
            subtitle="Every screen is designed for speed. Staff can be trained in under 30 minutes."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { label: 'Dashboard', desc: 'Real-time metrics & revenue charts' },
              { label: 'Order Management', desc: 'Drag-and-drop order workflow' },
              { label: 'Kitchen Display', desc: 'Color-coded priority lanes' },
              { label: 'Table Map', desc: 'Interactive floor plan view' },
              { label: 'Menu Builder', desc: 'Visual drag-and-drop editor' },
              { label: 'Reports', desc: 'Exportable sales & tax reports' },
            ].map((screen) => (
              <div
                key={screen.label}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="aspect-video bg-gradient-to-br from-[#0f172a] to-[#111827] flex items-center justify-center border-b border-white/[0.04]">
                  <span className="text-[#3b82f6]/40 text-sm font-semibold tracking-wide">{screen.label}</span>
                </div>
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-white mb-1">{screen.label}</h4>
                  <p className="text-xs text-slate-500">{screen.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section id="pricing" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            overline="Pricing"
            title="Simple, transparent pricing"
            subtitle="14-day free trial. No credit card required. Cancel anytime."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                  tier.featured
                    ? 'border-[#3b82f6]/30 bg-[#3b82f6]/5 shadow-lg shadow-[#3b82f6]/10'
                    : 'border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-white/[0.14]'
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white text-[11px] font-semibold">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-white mb-1">{tier.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{tier.tagline}</p>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-white">{tier.price}</span>
                  <span className="text-sm text-slate-500">{tier.period}</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                      <CheckBadgeIcon className="w-4 h-4 text-[#06b6d4] mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {tier.name === 'Enterprise' ? (
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="block w-full text-center text-sm font-semibold py-3 rounded-xl transition-all border border-white/10 text-white hover:bg-white/10"
                  >
                    {tier.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowContactModal(true)}
                    className={`block w-full text-center text-sm font-semibold py-3 rounded-xl transition-all ${
                      tier.featured
                        ? 'bg-white text-black hover:bg-white/90 hover:shadow-lg hover:shadow-white/10'
                        : 'border border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {tier.cta}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section id="faq" className="relative py-20 lg:py-28 bg-[#0f172a]/50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            overline="FAQ"
            title="Questions? We have answers."
            subtitle="Everything you need to know about AuraOS."
          />
          <FAQAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section className="relative py-20 lg:py-28">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-[#3b82f6]/15 via-[#8b5cf6]/15 to-[#ec4899]/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-10 sm:p-14">
            <SparklesIcon className="w-8 h-8 text-[#3b82f6] mx-auto mb-5" />
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4">
              Ready to transform your restaurant?
            </h2>
            <p className="text-base text-slate-400 max-w-lg mx-auto mb-8">
              Join hundreds of restaurants running on AuraOS. Start your free trial today — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setShowContactModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#3b82f6]/30 transition-all hover:-translate-y-0.5"
              >
                Book Demo
                <ArrowRightIcon className="w-4 h-4" />
              </button>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-white/[0.06] bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">A</span>
                <span className="text-lg font-bold tracking-tight text-white">Aura<span className="text-[#3b82f6]">OS</span></span>
              </Link>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">The operating system for modern restaurants. QR ordering, KDS, inventory, and analytics — all in one platform.</p>
              <p className="text-[11px] text-slate-600">© {new Date().getFullYear()} AuraOS. All rights reserved.</p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Platform</h4>
              <ul className="space-y-2.5">
                {['Features', 'Pricing', 'QR Ordering', 'Kitchen Display', 'Analytics'].map((l) => (
                  <li key={l}><a href="#" className="text-xs text-slate-500 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Solutions</h4>
              <ul className="space-y-2.5">
                {['Fine Dining', 'QSR / Fast Food', 'Cloud Kitchen', 'Café & Bakery', 'Multi-Outlet'].map((l) => (
                  <li key={l}><a href="#" className="text-xs text-slate-500 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2.5">
                {['About', 'Blog', 'Careers', 'Contact', 'Privacy Policy', 'Terms of Service'].map((l) => (
                  <li key={l}><a href="#" className="text-xs text-slate-500 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2.5">
                {['Help Center', 'Documentation', 'API Reference', 'System Status', 'Contact Support'].map((l) => (
                  <li key={l}><a href="#" className="text-xs text-slate-500 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  );
};

export default LandingPage;