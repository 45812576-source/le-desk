import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // TODO: Replace with real auth — for now use mock user
  const user = {
    display_name: "Admin",
    role: "super_admin",
  };

  return (
    <div className="flex h-screen bg-[#F0F4F8] overflow-hidden">
      <Sidebar user={user} taskPending={3} />
      <main className="flex-1 overflow-auto bg-[#F0F4F8]">{children}</main>
    </div>
  );
}
