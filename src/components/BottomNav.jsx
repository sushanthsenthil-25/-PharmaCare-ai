import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Home', path: '/', icon: 'home' },
    { label: 'Medicines', path: '/medicines', icon: 'medication' },
    { label: 'Personal Care', path: '/personal-care', icon: 'spa' },
    { label: 'Track Order', path: '/track-order', icon: 'local_shipping' },
    { label: 'Account', path: '/login', icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/20 max-w-md mx-auto">
      <div className="flex items-center justify-around h-16 px-2 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-all ${
                isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <div className={`p-1 rounded-full transition-all ${isActive ? 'bg-secondary-container/60 text-on-secondary-container' : ''}`}>
                <span className={`material-symbols-outlined text-[22px] ${isActive ? 'font-bold' : ''}`}>
                  {item.icon}
                </span>
              </div>
              <span className={`font-label-sm text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-primary' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
