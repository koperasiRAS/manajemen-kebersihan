'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const employeeNav = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/history', label: 'Riwayat Laporan', icon: ClockIcon },
];

const ownerNav = [
  { href: '/owner', label: 'Ringkasan', icon: HomeIcon },
  { href: '/owner/reports', label: 'Semua Laporan', icon: DocumentIcon },
  { href: '/owner/discipline', label: 'Disiplin', icon: ShieldIcon },
  { href: '/owner/employees', label: 'Karyawan', icon: UsersIcon },
  { href: '/owner/locations', label: 'Lokasi', icon: MapIcon },
  { href: '/owner/schedules', label: 'Jadwal Piket', icon: CalendarIcon },
  { href: '/owner/audit', label: 'Log Aktivitas', icon: EyeIcon },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const navItems = user?.role === 'owner' ? ownerNav : employeeNav;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Raya Abadi Saudara</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manajemen Kebersihan</p>
          </div>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
          <span className={cn(
            'inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full',
            user?.role === 'owner'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          )}>
            {user?.role === 'owner' ? 'Pemilik' : 'Karyawan'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            {isDark ? 'Mode Terang' : 'Mode Gelap'}
          </button>
          {/* Sign out */}
          <button onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <LogoutIcon className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}

// Icons
function HomeIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>);
}
function ClockIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
}
function DocumentIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>);
}
function ShieldIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>);
}
function UsersIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>);
}
function MapIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
}
function CalendarIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
}
function EyeIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
}
function LogoutIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>);
}
function SunIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>);
}
function MoonIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>);
}
