import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { ThemeToggle } from "@/components/ui-custom/ThemeToggle";
import { UserMenu } from "@/components/app/UserMenu";
import { RouteProgressBar } from "@/components/app/RouteProgressBar";
import { IconLogo, IconSpark, IconChart, IconBolt, IconCheck, IconSettings } from "@/components/ui-custom/CustomIcon";
import { I18nProvider, LANGS, useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

const NAV = [
  { to: "/businessos", key: "nav.command", Icon: IconSpark, exact: true },
  { to: "/businessos/market", key: "nav.market", Icon: IconChart, exact: false },
  { to: "/businessos/sources", key: "nav.sources", Icon: IconBolt, exact: false },
  { to: "/businessos/finance", key: "nav.finance", Icon: IconChart, exact: false },
  { to: "/businessos/actions", key: "nav.actions", Icon: IconCheck, exact: false },
  { to: "/businessos/profile", key: "nav.profile", Icon: IconSettings, exact: false },
] as const;

function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center rounded-full border border-glass-border bg-glass/50 p-0.5 backdrop-blur-xl">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={
            lang === l.code
              ? "rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
              : "rounded-full px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
          }
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Chrome() {
  const { t } = useI18n();
  return (
    <div className="relative min-h-dvh">
      <GradientMesh />
      <RouteProgressBar />

      <header className="sticky top-0 z-30 border-b border-glass-border bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/businessos" className="inline-flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/70 to-accent/70">
              <IconLogo size={16} className="text-primary-foreground" />
            </span>
            <span className="hidden font-display text-base tracking-tight sm:inline">{BRAND.name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LangSwitch />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2 sm:px-6">
          <div className="flex items-center gap-1.5">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.exact }}
                activeProps={{ className: "border-primary/50 bg-primary/15 text-primary" }}
                inactiveProps={{
                  className: "border-transparent text-muted-foreground hover:bg-glass/50 hover:text-foreground",
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition"
              >
                <n.Icon size={13} />
                {t(n.key)}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6"
      >
        <Outlet />
      </motion.main>
    </div>
  );
}

function AppShell() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const pathnameRef = useRef(typeof window === "undefined" ? "/businessos" : window.location.pathname);

  useEffect(() => {
    if (typeof window !== "undefined") pathnameRef.current = window.location.pathname;
  });

  useEffect(() => {
    if (!loading && !session) {
      nav({ to: "/login", search: { redirect: pathnameRef.current, mode: "signin" }, replace: true });
    }
  }, [loading, session, nav]);

  if (loading || !session) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden">
        <GradientMesh />
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10 flex size-14 items-center justify-center rounded-2xl bg-glass/60 ring-1 ring-glass-border backdrop-blur-xl"
        >
          <IconLogo size={26} className="text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <I18nProvider>
      <Chrome />
    </I18nProvider>
  );
}
