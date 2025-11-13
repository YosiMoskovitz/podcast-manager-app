import { Link, useLocation } from 'react-router-dom';
import { Radio, List, BarChart3, Home, Settings, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

function Layout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  
  const navItems = [
    { path: '/', icon: Home, label: t('nav.dashboard') },
    { path: '/podcasts', icon: Radio, label: t('nav.podcasts') },
    { path: '/episodes', icon: List, label: t('nav.episodes') },
    { path: '/statistics', icon: BarChart3, label: t('nav.statistics') },
    { path: '/settings', icon: Settings, label: t('nav.settings') }
  ];
  
  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Fixed positioning */}
      <aside className="w-64 min-w-64 fixed start-0 top-0 h-screen bg-gradient-to-b from-primary to-secondary text-white flex flex-col">
        {/* Header */}
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Radio className="w-7 h-7 flex-shrink-0" />
              <span className="truncate">{t('common.appName')}</span>
            </h1>
          </div>
          <LanguageSwitcher />
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
        
        {/* User info and logout */}
        <div className="p-4 flex-shrink-0 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            {user?.picture ? (
              <img 
                src={user.picture} 
                alt={user.name} 
                className="w-10 h-10 rounded-full border-2 border-white/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
                {user?.name?.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.name}</p>
              <p className="text-xs opacity-80 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      </aside>
      
      {/* Main content - Offset by sidebar width */}
      <main className="flex-1 ms-64 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default Layout;
