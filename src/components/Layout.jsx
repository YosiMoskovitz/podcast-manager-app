import { Link, useLocation } from 'react-router-dom';
import { Radio, List, BarChart3, Home, Settings } from 'lucide-react';

function Layout({ children }) {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/podcasts', icon: Radio, label: 'Podcasts' },
    { path: '/episodes', icon: List, label: 'Episodes' },
    { path: '/statistics', icon: BarChart3, label: 'Statistics' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];
  
  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Fixed positioning */}
      <aside className="w-64 min-w-64 fixed left-0 top-0 h-screen bg-gradient-to-b from-primary to-secondary text-white flex flex-col">
        {/* Header */}
        <div className="p-6 flex-shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Radio className="w-7 h-7 flex-shrink-0" />
            <span className="truncate">Podcast Manager</span>
          </h1>
        </div>
        
        {/* Navigation - Scrollable if needed */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-2">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === path
                  ? 'bg-white/20 font-semibold'
                  : 'hover:bg-white/10'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
        
        {/* Footer info */}
        <div className="p-6 flex-shrink-0">
          <div className="bg-white/10 rounded-lg p-4 text-sm">
            <p className="font-semibold mb-1 truncate">Podcast Manager</p>
            <p className="text-xs opacity-80 leading-relaxed">Automated RSS downloader with cloud storage</p>
          </div>
        </div>
      </aside>
      
      {/* Main content - Offset by sidebar width */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default Layout;
