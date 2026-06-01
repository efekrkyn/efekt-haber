import Link from 'next/link';
import { Home, TrendingUp, Cpu, Globe, Search, Bookmark, History, LayoutList, MapPin } from 'lucide-react';
import { RefreshButton } from '@/components/RefreshButton';

const navItems = [
  { href: '/', label: 'Günün Brifingi', icon: Home },
  { href: '/kategori/finans', label: 'Finans', icon: TrendingUp },
  { href: '/kategori/teknoloji', label: 'Teknoloji', icon: Cpu },
  { href: '/kategori/dis-politika', label: 'Dış Politika', icon: Globe },
  { href: '/kategori/turkiye', label: 'Türkiye', icon: MapPin },
  { href: '/sohbet', label: 'AI Yorumcu', icon: Search },
  { href: '/arama', label: 'Akıllı Arama', icon: Search },
  { href: '/takip', label: 'İzleme Listesi', icon: LayoutList },
  { href: '/kaydedilenler', label: 'Kaydedilenler', icon: Bookmark },
  { href: '/haftalik', label: 'Haftalık Sentez', icon: History },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 h-screen border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center border-b border-border/40 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">H</div>
          Efekt Haber
        </Link>
      </div>
      <nav className="flex-1 overflow-auto py-4">
        <ul className="grid gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-border/40">
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 p-4 border border-blue-500/20">
          <p className="text-xs text-muted-foreground mb-2">Sistem Durumu</p>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
            AI Aktif
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Sürekli Güncel (Her Saat Başı)</p>
          <RefreshButton />
        </div>
      </div>
    </aside>
  );
}
