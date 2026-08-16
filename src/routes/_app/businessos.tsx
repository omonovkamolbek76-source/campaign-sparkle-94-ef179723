import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/businessos")({
  component: BusinessOSLayout,
});

function BusinessOSLayout() {
  return <Outlet />;
}
