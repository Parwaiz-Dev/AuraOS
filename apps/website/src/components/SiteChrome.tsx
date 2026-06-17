import type { SiteConfig } from '@/lib/api';

/** Days for opening-hours rendering, indexed 0=Sun..6=Sat. */
export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/menu', label: 'Menu' },
  { href: '/about', label: 'About' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/hours', label: 'Hours' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader({ config }: { config: SiteConfig }) {
  const { restaurant } = config;
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 shadow-sm"
      style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
    >
      <a href="/" className="flex items-center gap-3">
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logo_url} alt={restaurant.name} className="h-9 w-9 rounded-full object-cover" />
        ) : null}
        <span className="text-lg font-bold">{restaurant.name}</span>
      </a>
      <nav className="hidden gap-6 text-sm font-medium sm:flex">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} className="opacity-90 hover:opacity-100">
            {n.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter({ config }: { config: SiteConfig }) {
  const { restaurant } = config;
  const socials = restaurant.social_links || {};
  return (
    <footer
      className="mt-auto px-6 py-10 text-center text-sm"
      style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
    >
      {Object.keys(socials).length > 0 ? (
        <div className="mb-4 flex justify-center gap-4">
          {Object.entries(socials).map(([name, url]) => (
            <a key={name} href={url as string} target="_blank" rel="noreferrer" className="capitalize opacity-90 hover:opacity-100">
              {name}
            </a>
          ))}
        </div>
      ) : null}
      <p className="opacity-70">
        {restaurant.name} · Powered by AuraOS
      </p>
    </footer>
  );
}
