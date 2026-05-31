import Link from 'next/link';
import { Home, TrendingUp, Cpu, Globe, Search } from 'lucide-react';

const bottomNavItems = [
  { href: '/', label: 'Brifing', icon: Home },
  { href: '/kategori/finans', label: 'Finans', icon: TrendingUp },
  { href: '/kategori/teknoloji', label: 'Teknoloji', icon: Cpu },
  { href: '/sohbet', label: 'Yorumcu', icon: Search },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 pb-safe">
      {bottomNavItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-2"
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
