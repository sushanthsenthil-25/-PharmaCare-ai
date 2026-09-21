import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, user, location: userLoc, alerts, unreadAlertsCount, markAlertRead, setAiState, backendHealth, checkBackendHealth, openCart } = useApp();
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  const totalCartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const displayAvatar = user?.profilePhoto || user?.avatar || 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w';

  return (
    <>
      {/* Offline connectivity banner if backend is unavailable */}
      {backendHealth && !backendHealth.connected && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-600 text-white text-[11px] font-semibold py-1 px-3 flex items-center justify-between shadow-md max-w-md mx-auto">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            <span className="truncate">Backend offline ({backendHealth.errorType || 'Connection Failed'})</span>
          </div>
          <button
            onClick={() => checkBackendHealth()}
            disabled={backendHealth.isChecking}
            className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ml-2 disabled:opacity-50"
          >
            {backendHealth.isChecking ? 'Checking...' : 'Retry connection'}
          </button>
        </div>
      )}

      <header className={`fixed top-0 left-0 right-0 z-50 pt-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] max-w-md mx-auto ${backendHealth && !backendHealth.connected ? 'mt-6' : ''}`}>
        <div className="h-28 px-margin flex flex-col justify-between py-space-sm">
          {/* Top bar: Brand & Action Icons */}
          <div className="flex items-center justify-between gap-space-sm">
            <div 
              className="flex items-center gap-space-xs cursor-pointer"
              onClick={() => navigate('/')}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                <span className="material-symbols-outlined text-primary text-[22px]">medication</span>
              </div>
              <span className="font-headline-sm text-headline-sm text-primary leading-tight tracking-tight font-bold">
                PharmaCare <span className="text-secondary font-bold">AI</span>
              </span>
            </div>

            <div className="flex items-center gap-space-xs">
              {/* Notifications Button */}
              <button 
                aria-label="Notifications" 
                onClick={() => setShowAlertsModal(!showAlertsModal)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors relative"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadAlertsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-error text-white rounded-full font-bold text-[9px] flex items-center justify-center ring-2 ring-surface-container-lowest">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Shopping Cart Button */}
              <button 
                aria-label="Shopping Cart" 
                onClick={() => openCart()}
                className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors relative"
              >
                <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                {totalCartCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-primary text-on-primary rounded-full font-label-sm text-label-sm flex items-center justify-center font-bold text-[10px]">
                    {totalCartCount}
                  </span>
                )}
              </button>

              {/* User Avatar */}
              <div 
                onClick={() => navigate('/login')}
                className="pl-space-xs cursor-pointer"
                title="View Profile & Account"
              >
                <img 
                  alt={user?.name || "Profile"} 
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 bg-surface-container-low" 
                  src={displayAvatar}
                  onError={(e) => {
                    e.target.src = 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Location & Search bar */}
          <div className="flex items-center justify-between gap-space-sm">
            <button className="flex items-center gap-1.5 text-left py-1 px-2.5 rounded-full bg-surface-container-low hover:bg-surface-container transition-colors max-w-[200px]">
              <span className="material-symbols-outlined text-primary text-[16px]">location_on</span>
              <span className="font-label-sm text-label-sm text-on-surface font-medium truncate">{userLoc}</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">expand_more</span>
            </button>

            <div className="flex-1 flex items-center h-9 px-3 rounded-xl bg-surface-container-low">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">search</span>
              <input 
                className="w-full bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none" 
                placeholder="Search medicines, tests..." 
                type="text" 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate('/medicines');
                }}
              />
              <button 
                aria-label="Voice Search" 
                onClick={() => {
                  setAiState('listening');
                  navigate('/');
                }}
                className="w-7 h-7 flex items-center justify-center text-primary hover:text-secondary transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">mic</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Real Alerts Modal Overlay */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-start pt-24 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                <h3 className="font-headline-sm text-sm font-bold text-primary">Live Clinical Alerts</h3>
              </div>
              <button 
                onClick={() => setShowAlertsModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => markAlertRead(alert.id)}
                    className={`p-3 rounded-xl border text-xs flex flex-col gap-1 transition-all cursor-pointer ${
                      alert.is_read
                        ? 'bg-surface-container-lowest border-outline-variant/10 opacity-70'
                        : 'bg-primary-container/10 border-primary/20 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">{alert.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800">
                        {alert.alert_type}
                      </span>
                    </div>
                    <p className="text-on-surface-variant text-[11px] leading-relaxed">{alert.message}</p>
                    {!alert.is_read && (
                      <span className="text-[10px] text-secondary font-semibold self-end">Tap to mark read</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-on-surface-variant">
                  No active clinical alerts at this time.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
