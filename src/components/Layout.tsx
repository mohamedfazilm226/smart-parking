import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Car, LogOut, User, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isAuthenticated) return <>{children}</>;

  const navItems = user?.role === 'admin' 
    ? [{ label: 'Admin Panel', path: '/admin', icon: ShieldCheck }]
    : [{ label: 'Book Parking', path: '/dashboard', icon: LayoutDashboard }];

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <nav className="bg-white border-b border-zinc-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3 group">
            <div className="bg-emerald-500 p-2 rounded-xl group-hover:rotate-12 transition-transform">
              <Car className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-zinc-900 tracking-tight">SmartPark</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold transition-colors",
                  location.pathname === item.path ? "text-emerald-600" : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-zinc-900">{user?.email.split('@')[0]}</span>
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">{user?.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        {children}
      </main>
      <footer className="bg-white border-t border-zinc-100 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-zinc-400 text-sm">© 2026 Smart Parking System. Built for efficiency.</p>
        </div>
      </footer>
    </div>
  );
}
