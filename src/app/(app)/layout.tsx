import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={user} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
