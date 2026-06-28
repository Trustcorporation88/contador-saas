import { Link, useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { canAccessPath } from '../../utils/access';

export default function CopilotFab() {
  const location = useLocation();
  const role = useAuthStore((s) => s.user?.role);

  if (location.pathname.startsWith('/copiloto')) return null;
  if (!canAccessPath(role, '/copiloto')) return null;

  return (
    <Link
      to="/copiloto"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 px-5 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-primary-500/35 transition hover:scale-[1.03] hover:shadow-primary-500/45"
      title="Abrir Copilot"
      aria-label="Abrir Copilot"
    >
      <Bot className="h-5 w-5 shrink-0" aria-hidden />
      <span>COPILOT</span>
    </Link>
  );
}
