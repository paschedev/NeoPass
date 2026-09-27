'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getNavItems, showsAppNav } from '@/utils/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [showMenu, setShowMenu] = useState(false);

  useScrollLock(showMenu);
  useEffect(() => {
    if (!showMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMenu(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showMenu]);

  if (!showsAppNav(pathname)) return null;

  const navItems = getNavItems(user);
  const menu = navItems.find((item) => item.kind === 'menu');

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[90] bg-black/90 backdrop-blur-xl border-t border-white/10 pb-safe">
        <div className="flex items-end justify-around h-16 px-1 relative">
          {navItems.map((item) => {
            if (item.kind === 'menu') {
              const isMenuActive = item.items.some((mi) =>
                pathname.startsWith(mi.href),
              );
              return (
                <button
                  key={item.id}
                  onClick={() => setShowMenu(!showMenu)}
                  className={`relative flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                    isMenuActive
                      ? 'text-indigo-400'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {isMenuActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-indigo-500 rounded-b-md" />
                  )}
                  <item.icon
                    className={`w-5 h-5 transition-all mt-1 ${isMenuActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : ''}`}
                  />
                  <span className="text-[10px] font-medium leading-none mb-2">
                    {item.label}
                  </span>
                </button>
              );
            }

            if (item.kind === 'scanner') {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="relative flex flex-col items-center justify-end w-full h-full pb-2"
                >
                  <div
                    className={`absolute -top-4 w-12 h-12 flex items-center justify-center rounded-full border-4 border-[#0a0a0a] transition-all shadow-lg ${isActive ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-medium leading-none mt-7 transition-colors ${isActive ? 'text-indigo-400' : 'text-neutral-400'}`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            }

            const isActive =
              pathname === item.href ||
              (item.href !== '/panel' && pathname.startsWith(item.href)) ||
              (item.href === '/panel' && pathname === '/panel');
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`relative flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                  isActive
                    ? 'text-indigo-400'
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-indigo-500 rounded-b-md" />
                )}
                <item.icon
                  className={`w-5 h-5 transition-all mt-1 ${isActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : ''}`}
                />
                <span className="text-[10px] font-medium leading-none mb-2">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Más Menu Bottom Sheet */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[95]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-20 left-4 right-4 bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl z-[95] p-5 shadow-[0_10px_50px_rgba(0,0,0,0.8)]"
            >
              <div className="flex justify-between items-center mb-6 px-1">
                <h3 className="text-white font-bold text-lg font-outfit">
                  Más opciones
                </h3>
                <button
                  onClick={() => setShowMenu(false)}
                  className="bg-white/10 p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                {menu?.kind === 'menu' &&
                  menu.items.map((mi) => {
                    const isMiActive = pathname.startsWith(mi.href);
                    return (
                      <Link
                        key={mi.id}
                        href={mi.href}
                        onClick={() => setShowMenu(false)}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isMiActive ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10 hover:border-white/10 hover:text-white'}`}
                      >
                        <div
                          className={`p-2 rounded-xl ${isMiActive ? 'bg-indigo-500/20' : 'bg-white/5'}`}
                        >
                          <mi.icon className="w-5 h-5" />
                        </div>
                        <span className="font-semibold">{mi.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
