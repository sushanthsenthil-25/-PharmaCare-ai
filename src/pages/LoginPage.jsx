import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w';

export const LoginPage = () => {
  const navigate = useNavigate();
  const {
    user,
    login,
    register,
    logout,
    authLoading,
    authError,
    setAuthError,
    uploadProfilePhoto,
    removeProfilePhoto,
    updateProfile,
    backendHealth,
    checkBackendHealth,
  } = useApp();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'otp'
  
  // Login form state
  const [email, setEmail] = useState('demo@pharmacare.ai');
  const [password, setPassword] = useState('Demo@123Password');

  // Register form state
  const [regForm, setRegForm] = useState({
    business_name: 'PharmaCare Central Pharmacy',
    full_name: 'Dr. Ramesh Kumar',
    email: '',
    password: '',
    phone: '9876543210',
    business_address: '100 Feet Road, Indiranagar, Bangalore 560038',
  });

  // OTP Demo state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '']);

  // Profile Edit & Photo Upload state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    businessName: user?.businessName || '',
  });

  const fileInputRef = useRef(null);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    const res = await login(email, password);
    if (res.success) {
      setPhotoFeedback(null);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await register(regForm);
    if (res.success) {
      setPhotoFeedback(null);
    }
  };

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (phoneNumber.length >= 10) {
      setOtpSent(true);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const res = await login('demo@pharmacare.ai', 'Demo@123Password');
    if (res.success) {
      setPhotoFeedback(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setPhotoFeedback(null);
  };

  // ---------------------------------------------------------------------------
  // Profile Photo Upload Handlers
  // ---------------------------------------------------------------------------
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setPhotoFeedback({ type: 'error', message: 'Only JPEG, PNG, and WebP images are supported.' });
      return;
    }

    // Validate size: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setPhotoFeedback({ type: 'error', message: 'File size must be under 5 MB.' });
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoFeedback(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        await uploadProfilePhoto(base64Data);
        setPhotoFeedback({ type: 'success', message: 'Profile photo updated and saved to account!' });
        setTimeout(() => setPhotoFeedback(null), 4000);
      } catch (err) {
        setPhotoFeedback({ type: 'error', message: err.message || 'Failed to upload profile photo.' });
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.onerror = () => {
      setIsUploadingPhoto(false);
      setPhotoFeedback({ type: 'error', message: 'Could not read image file.' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setIsUploadingPhoto(true);
    setPhotoFeedback(null);
    try {
      await removeProfilePhoto();
      setPhotoFeedback({ type: 'success', message: 'Profile photo removed.' });
      setTimeout(() => setPhotoFeedback(null), 3000);
    } catch (err) {
      setPhotoFeedback({ type: 'error', message: err.message || 'Failed to remove photo.' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(editProfileForm);
      setIsEditingProfile(false);
      setPhotoFeedback({ type: 'success', message: 'Account details updated successfully!' });
      setTimeout(() => setPhotoFeedback(null), 3000);
    } catch (err) {
      setPhotoFeedback({ type: 'error', message: err.message || 'Failed to update account.' });
    }
  };

  const currentAvatar = user?.profilePhoto || user?.avatar || DEFAULT_AVATAR;

  return (
    <div className="flex flex-col w-full px-margin pb-12 pt-4 min-h-[80vh] justify-between">
      <div className="flex flex-col gap-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center gap-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-primary-container/20 flex items-center justify-center text-primary shadow-sm border border-primary/20">
            <span className="material-symbols-outlined text-[32px]">health_and_safety</span>
          </div>
          <h1 className="font-headline-lg text-2xl text-primary font-bold tracking-tight">
            PharmaCare AI Account
          </h1>
          <p className="font-body-sm text-xs text-on-surface-variant max-w-[280px]">
            Certified Pharmaceutical Intelligence & Cloud Account
          </p>
        </div>

        {/* Backend Health Notice */}
        {backendHealth && !backendHealth.connected && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-700">wifi_off</span>
              <span>Backend server offline</span>
            </div>
            <button
              onClick={() => checkBackendHealth()}
              disabled={backendHealth.isChecking}
              className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 hover:bg-amber-300 text-[11px] font-bold"
            >
              {backendHealth.isChecking ? 'Checking...' : 'Retry'}
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {authError && (
          <div className="p-3.5 rounded-xl bg-error/10 border border-error/20 flex items-center gap-2.5 text-error text-xs font-semibold">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span className="flex-1">{authError}</span>
            <button onClick={() => setAuthError(null)} className="text-error/80 hover:text-error">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Photo Action Feedback Message */}
        {photoFeedback && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            photoFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <span className="material-symbols-outlined text-[16px]">
              {photoFeedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="flex-1">{photoFeedback.message}</span>
            <button onClick={() => setPhotoFeedback(null)} className="text-xs font-bold ml-1">✕</button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* LOGGED IN USER PROFILE & AVATAR MANAGEMENT                         */}
        {/* ------------------------------------------------------------------ */}
        {user.isLoggedIn ? (
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-4">
            {/* Top Profile Card with Avatar & Upload Controls */}
            <div className="flex flex-col gap-3 pb-3 border-b border-outline-variant/15">
              <div className="flex items-center gap-3.5">
                <div className="relative group shrink-0">
                  <img
                    src={currentAvatar}
                    alt={user.name}
                    onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/30 shadow-sm bg-surface-container-low"
                  />
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline-sm text-base font-bold text-primary truncate">{user.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold shrink-0 uppercase">
                      {user.role}
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant truncate">{user.email}</span>
                </div>
              </div>

              {/* Profile Photo Controls (Upload / Change / Remove) */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="py-1.5 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                  {user.profilePhoto ? 'Change Photo' : 'Upload Photo'}
                </button>

                {user.profilePhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isUploadingPhoto}
                    className="py-1.5 px-2.5 rounded-lg bg-surface-container-low text-error hover:bg-error/10 text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Profile Info & Edit Toggle */}
            {!isEditingProfile ? (
              <div className="flex flex-col gap-2 py-1 text-xs text-on-surface-variant">
                <div className="flex justify-between py-1 border-b border-outline-variant/10">
                  <span className="font-medium">Business / Pharmacy:</span>
                  <span className="font-bold text-primary">{user.businessName || 'PharmaCare Network'}</span>
                </div>
                {user.phone && (
                  <div className="flex justify-between py-1 border-b border-outline-variant/10">
                    <span className="font-medium">Phone:</span>
                    <span className="font-bold text-primary">{user.phone}</span>
                  </div>
                )}
                {user.address && (
                  <div className="flex justify-between py-1 border-b border-outline-variant/10">
                    <span className="font-medium">Address:</span>
                    <span className="font-bold text-primary text-right max-w-[200px] truncate">{user.address}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-outline-variant/10">
                  <span className="font-medium">Account Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active & Authenticated
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-outline-variant/15">
                  <button
                    type="button"
                    onClick={() => navigate('/owner/dashboard')}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-xs shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">local_pharmacy</span>
                    <span>Open Owner Dashboard</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditProfileForm({
                        name: user.name || '',
                        phone: user.phone || '',
                        address: user.address || '',
                        businessName: user.businessName || '',
                      });
                      setIsEditingProfile(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-bold text-secondary hover:bg-surface-container-high transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 py-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-primary">Full Name</label>
                  <input
                    type="text"
                    value={editProfileForm.name}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, name: e.target.value })}
                    className="border border-outline-variant/40 rounded-xl p-2 bg-surface-container-low text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-primary">Phone Number</label>
                  <input
                    type="tel"
                    value={editProfileForm.phone}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                    className="border border-outline-variant/40 rounded-xl p-2 bg-surface-container-low text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-primary">Address</label>
                  <input
                    type="text"
                    value={editProfileForm.address}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, address: e.target.value })}
                    className="border border-outline-variant/40 rounded-xl p-2 bg-surface-container-low text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-sm hover:bg-primary/90 transition-all"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="py-2 px-3 rounded-xl bg-surface-container-low text-on-surface-variant font-bold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Navigation & Logout */}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">home</span>
                Go to Pharmacy Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-surface-container-low text-error border border-error/20 font-label-sm text-xs font-bold hover:bg-error/10 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* AUTHENTICATION FORMS (LOGIN / REGISTER / DEMO PRESETS)             */
          /* ------------------------------------------------------------------ */
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-5">
            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-surface-container-low p-1 gap-1">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  authMode === 'login'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Email Login
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  authMode === 'register'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setAuthError(null); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  authMode === 'otp'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Mobile OTP
              </button>
            </div>

            {/* Quick Demo Credentials Switcher */}
            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant/15">
              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Quick Demo Login</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('demo@pharmacare.ai');
                    setPassword('Demo@123Password');
                  }}
                  className="flex-1 py-1 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-[11px] font-bold text-primary hover:border-primary/40 transition-all text-left truncate"
                >
                  👤 Demo User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('owner@pharmacare.ai');
                    setPassword('Password123!');
                  }}
                  className="flex-1 py-1 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-[11px] font-bold text-primary hover:border-primary/40 transition-all text-left truncate"
                >
                  👑 Demo Owner
                </button>
              </div>
            </div>

            {/* Email Login Form */}
            {authMode === 'login' && (
              <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-xs text-primary font-semibold">Email Address</label>
                  <div className="flex items-center gap-2 border border-outline-variant/40 rounded-xl p-2.5 bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                    <span className="material-symbols-outlined text-primary text-[18px]">mail</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="demo@pharmacare.ai"
                      className="w-full bg-transparent text-sm font-medium focus:outline-none text-on-surface"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-label-sm text-xs text-primary font-semibold">Password</label>
                    <span className="text-[10px] text-secondary font-semibold cursor-pointer">Forgot?</span>
                  </div>
                  <div className="flex items-center gap-2 border border-outline-variant/40 rounded-xl p-2.5 bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                    <span className="material-symbols-outlined text-primary text-[18px]">lock</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-transparent text-sm font-medium focus:outline-none text-on-surface"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {authLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      Sign In
                      <span className="material-symbols-outlined text-[18px]">login</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Registration Form */}
            {authMode === 'register' && (
              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-primary">Business / Pharmacy Name</label>
                  <input
                    type="text"
                    value={regForm.business_name}
                    onChange={(e) => setRegForm({ ...regForm, business_name: e.target.value })}
                    placeholder="e.g. CareWell Pharmaceuticals"
                    className="border border-outline-variant/40 rounded-xl p-2 bg-surface-container-low text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-primary">Full Name</label>
                  <input
                    type="text"
                    value={regForm.full_name}
                    onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                    placeholder="Dr. Rajesh Patel"
                    className="border border-outline-variant/40 rounded-xl p-2 bg-surface-container-low text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-primary">Email</label>
                  <input
                    type="email"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="rajesh@carewell.com"
                    className="border border-outline-variant/40 rounded-xl p-2 bg-surface-container-low text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-primary">Password</label>
                  <input
                    type="password"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    placeholder="Min. 8 characters"
                    className="border border-outline-variant/40 rounded-xl p-2 bg-surface-container-low text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 mt-2 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {authLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      Register Pharmacy
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Mobile OTP Form */}
            {authMode === 'otp' && (
              !otpSent ? (
                <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-xs text-primary font-semibold">Mobile Number</label>
                    <div className="flex items-center gap-2 border border-outline-variant/40 rounded-xl p-2.5 bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                      <span className="font-bold text-sm text-primary border-r border-outline-variant/30 pr-2">+91</span>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 10-digit mobile number"
                        className="w-full bg-transparent text-sm font-medium focus:outline-none text-on-surface"
                        maxLength={10}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    Get Verification OTP
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-xs text-primary font-semibold">Enter 4-Digit OTP</label>
                      <button type="button" onClick={() => setOtpSent(false)} className="text-[11px] font-bold text-secondary">
                        Change Number
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant">Sent to +91 {phoneNumber}</p>

                    <div className="flex gap-2 justify-center py-2">
                      {otpCode.map((digit, idx) => (
                        <input
                          key={idx}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...otpCode];
                            updated[idx] = val;
                            setOtpCode(updated);
                          }}
                          className="w-12 h-12 rounded-xl border border-outline-variant/40 text-center text-lg font-bold text-primary bg-surface-container-low focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    Verify & Login
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  </button>
                </form>
              )
            )}
          </div>
        )}
      </div>

      <div className="text-center pt-6">
        <p className="font-body-sm text-[11px] text-on-surface-variant">
          By signing in, you agree to PharmaCare AI's{' '}
          <span className="text-primary font-bold underline cursor-pointer">Terms of Service</span> &{' '}
          <span className="text-primary font-bold underline cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
