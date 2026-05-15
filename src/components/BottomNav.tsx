import { Link, useLocation } from "@tanstack/react-router";
import { Home, Package, Receipt } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  const items = [
    { to: "/", icon: Home, label: t.nav.dashboard },
    { to: "/inventory", icon: Package, label: t.nav.inventory },
    { to: "/fiado", icon: Receipt, label: t.nav.fiado },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors data-[active=true]:text-primary"
              data-active={active}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
