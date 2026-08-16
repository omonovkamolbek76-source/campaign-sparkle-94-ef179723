import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { ThemeToggle } from "@/components/ui-custom/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";
import { I18nProvider, LANGS, useI18n } from "@/lib/i18n";
import { IconLogo, IconArrowRight, IconChart, IconScroll, IconSpark } from "@/components/ui-custom/CustomIcon";

export const Route = createFileRoute("/")({
  component: LandingRoute,
  head: () => ({
    meta: [
      { title: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "description", content: BRAND.description },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { property: "og:description", content: BRAND.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

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

function Landing() {
  const { t } = useI18n();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/businessos", replace: true });
  }, [session, loading, navigate]);

  const features = [
    { Icon: IconChart, title: t("land.f1t"), desc: t("land.f1d") },
    { Icon: IconScroll, title: t("land.f2t"), desc: t("land.f2d") },
    { Icon: IconSpark, title: t("land.f3t"), desc: t("land.f3d") },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <GradientMesh />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/70 to-accent/70">
            <IconLogo size={16} className="text-primary-foreground" />
          </span>
          <span className="font-display text-lg tracking-tight">{BRAND.name}</span>
        </span>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-10">
        <section className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t("land.badge")}</p>
          <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight sm:text-6xl">
            {t("land.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">{t("land.sub")}</p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              search={{ mode: "signup" }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {t("land.cta")} <IconArrowRight size={14} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full border border-glass-border bg-glass/40 px-6 py-3 text-sm transition hover:bg-glass/70"
            >
              {t("land.signin")}
            </Link>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <GlassPanel key={f.title} className="p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.Icon size={18} />
              </span>
              <h2 className="mt-3 font-display text-lg">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </GlassPanel>
          ))}
        </section>
      </main>
    </div>
  );
}

function LandingRoute() {
  return (
    <I18nProvider>
      <Landing />
    </I18nProvider>
  );
}
