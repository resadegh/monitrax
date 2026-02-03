/**
 * Phase 32: Enterprise Portal Dashboard
 *
 * Main dashboard for organization portal users.
 * This is a placeholder that will be fully implemented in Phase 32.3.
 */

export default function PortalDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Portal Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Monitrax Portal</h1>
              <p className="text-xs text-slate-500">Enterprise Dashboard</p>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <a href="/portal/dashboard" className="text-sm font-medium text-blue-600">
              Dashboard
            </a>
            <a href="/portal/clients" className="text-sm text-slate-600 hover:text-slate-900">
              Clients
            </a>
            <a href="/portal/team" className="text-sm text-slate-600 hover:text-slate-900">
              Team
            </a>
            <a href="/portal/settings" className="text-sm text-slate-600 hover:text-slate-900">
              Settings
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Under Construction Notice */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <span className="text-3xl">🏗️</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Portal Dashboard Coming Soon
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            The Enterprise Portal dashboard is currently under development.
            This page will display your organization overview, client statistics,
            and recent activity.
          </p>
        </div>

        {/* Preview Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Clients Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600">👥</span>
              </div>
              <h3 className="font-medium text-slate-900">Clients</h3>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">--</div>
            <p className="text-sm text-slate-500">Active clients</p>
          </div>

          {/* Tasks Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <span className="text-amber-600">📋</span>
              </div>
              <h3 className="font-medium text-slate-900">Tasks</h3>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">--</div>
            <p className="text-sm text-slate-500">Pending tasks</p>
          </div>

          {/* Integrations Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600">🔗</span>
              </div>
              <h3 className="font-medium text-slate-900">Integrations</h3>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">--</div>
            <p className="text-sm text-slate-500">Active connections</p>
          </div>
        </div>
      </main>
    </div>
  );
}
