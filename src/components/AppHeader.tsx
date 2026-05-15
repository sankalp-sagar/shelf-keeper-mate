import { useI18n, type Lang } from "@/lib/i18n";
import { BookMarked } from "lucide-react";

export function AppHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <header className="px-5 pt-6 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <BookMarked className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">{t.appName}</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-foreground">
            {title ?? t.dashboard.title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
          {(["en", "es"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              data-active={lang === l}
              className="rounded-full px-3 py-1 text-muted-foreground transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
