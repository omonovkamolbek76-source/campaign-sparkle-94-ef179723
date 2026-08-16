import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { I18nProvider, LANGS, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/businessos")({
  component: BusinessOSLayout,
});

const SUB_NAV = [
  { to: "/businessos", key: "nav.command", exact: true },
  { to: "/businessos/market", key: "nav.market" },
  { to: "/businessos/sources", key: "nav.sources" },
  { to: "/businessos/finance", key: "nav.finance" },
  { to: "/businessos/actions", key: "nav.actions" },
  { to: "/businessos/profile", key: "nav.profile" },
] as const;

function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass/40 p-1">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={
            lang === l.code
              ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
              : "rounded-full px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          }
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Shell() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {SUB_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact ?? false }}
              activeProps={{ className: "border-primary/50 bg-primary/15 text-primary" }}
              inactiveProps={{ className: "border-glass-border bg-glass/40 text-muted-foreground hover:text-foreground" }}
              className="rounded-full border px-3.5 py-1.5 text-xs transition"
            >
              {t(n.key)}
            </Link>
          ))}
        </div>
        <LangSwitch />
      </div>
      <Outlet />
    </div>
  );
}

function BusinessOSLayout() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
