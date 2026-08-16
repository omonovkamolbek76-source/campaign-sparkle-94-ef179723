import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { BRAND } from "@/lib/brand";

/**
 * Catch-all redirect for legacy Marketing Command Center URLs.
 * Consolidates ~12 single-file redirect stubs into one map so the route
 * tree stays small while bookmarks and external docs keep working.
 *
 * Unknown paths render a soft 404 with a link back home.
 */
export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: `Page not found — ${BRAND.name}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CatchAll,
});

function CatchAll() {
  const { _splat } = Route.useParams();

  return (
    <div className="relative min-h-dvh overflow-hidden text-foreground">
      <GradientMesh />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-16">
        <GlassPanel className="w-full p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">404</p>
          <h1 className="mt-3 font-display text-3xl tracking-tight">Page not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-mono text-foreground/80">/{_splat}</span>
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/businessos"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              BusinessOS AI
            </Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
