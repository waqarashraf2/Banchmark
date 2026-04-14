import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { AlertCircle } from 'lucide-react';

/**
 * Fallback dashboard for roles without a dedicated dashboard.
 * All production roles are routed to specific dashboards (CEO/Director → CEODashboard,
 * OM → OperationsManagerDashboard, PM → ProjectManagerDashboard, Workers → WorkerDashboard).
 */
export default function Dashboard() {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <AlertCircle className="h-6 w-6 text-slate-400" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">
        Welcome, {user?.name || 'User'}
      </h1>
      <p className="text-sm text-slate-500 text-center max-w-md">
        Your role ({user?.role?.replace('_', ' ')}) does not have a dedicated dashboard.
        Please contact your administrator if you believe this is an error.
      </p>
    </div>
  );
}
