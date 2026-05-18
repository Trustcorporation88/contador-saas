import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-primary-200/30 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-8%] h-80 w-80 rounded-full bg-primary-300/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
          <main className="flex-1 overflow-y-auto animate-fade-in">
            <div className="mx-auto min-h-full w-full max-w-[1680px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
