import { Outlet, NavLink } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Layout() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Stor Agent</h1>
        <div className="flex items-center space-x-4">
          {isOffline && (
            <div className="flex items-center text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full text-sm font-medium border border-rose-100">
              <CloudOff className="w-4 h-4 mr-2" />
              Offline Mode
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <nav className="flex-1 px-4 py-6 space-y-2">
            {[
              { name: 'Dashboard', path: '/' },
              { name: 'Scan Items', path: '/scan' },
              { name: 'Browse', path: '/browse' },
              { name: 'Finances', path: '/finances' },
              { name: 'Summary', path: '/summary' },
            ].map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
        </aside>
        
        <main className="flex-1 overflow-auto p-8 bg-gray-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
