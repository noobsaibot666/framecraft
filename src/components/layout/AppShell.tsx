import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { CommandSearch } from "@/components/ui/CommandSearch";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useShortcut, registerShortcutLabel } from "@/lib/shortcuts";

registerShortcutLabel("cmd+k", "Open command search");

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen((open) => !open), []);
  useShortcut("cmd+k", openSearch);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black">
      <TopBar onSearchOpen={() => setSearchOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      {searchOpen && <CommandSearch onClose={() => setSearchOpen(false)} />}
      <ToastContainer />
    </div>
  );
}
