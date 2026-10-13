import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Logo } from '../components/Logo';
import api from '../services/api';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'owner' ? 'owner' : 'user';

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

  // Selected Portal: 'user' (Option A) vs 'owner' (Option B)
  const [selectedRole, setSelectedRole] = useState(initialRole);
  // Mode: 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState('login');

  // Customer Login & Register state
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRegForm, setUserRegForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
  });

  // Pharmacy Owner Login & Register state
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerRegForm, setOwnerRegForm] = useState({
    business_name: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    business_address: '',
  });

  // Password Recovery state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Enter email, 2: Set new password
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

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

  // ---------------------------------------------------------------------------
  // Option A: User / Customer Authentication Handlers
  // ---------------------------------------------------------------------------
  const handleUserLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    const res = await login(userEmail, userPassword);
    if (res.success) {
      navigate('/');
    }
  };

  const handleUserRegister = async (e) => {
    e.preventDefault();
    setAuthError(null);
    const res = await register({
      full_name: userRegForm.name,
      name: userRegForm.name,
      email: userRegForm.email,
      password: userRegForm.password,
      phone: userRegForm.phone,
      business_address: userRegForm.address,
      role: 'USER',
    });
    if (res.success) {
      navigate('/');
    }
  };

  // ---------------------------------------------------------------------------
  // Option B: Pharmacy Owner Authentication Handlers
  // ---------------------------------------------------------------------------
  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    const res = await login(ownerEmail, ownerPassword);
    if (res.success) {
      navigate('/owner/dashboard');
    }
  };

  const handleOwnerRegister = async (e) => {
    e.preventDefault();
    setAuthError(null);
    const res = await register({
      full_name: ownerRegForm.name,
      name: ownerRegForm.name,
      business_name: ownerRegForm.business_name,
      email: ownerRegForm.email,
      password: ownerRegForm.password,
      phone: ownerRegForm.phone,
      business_address: ownerRegForm.business_address,
      role: 'OWNER',
    });
    if (res.success) {
      navigate('/owner/dashboard');
    }
  };

  // ---------------------------------------------------------------------------
  // Password Recovery Handlers
  // ---------------------------------------------------------------------------
  const handleRequestRecovery = async (e) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.forgotPassword(recoveryEmail);
      if (res?.resetToken) {
        setRecoveryToken(res.resetToken);
        setRecoveryStep(2);
      } else {
        setRecoverySuccess(res?.message || 'Password reset instructions have been generated.');
      }
    } catch (err) {
      setAuthError(err.message || 'Failed to initiate password reset.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleCompleteReset = async (e) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.resetPassword({
        email: recoveryEmail,
        resetToken: recoveryToken,
        newPassword,
      });
      setRecoverySuccess(res.message || 'Password has been successfully updated.');
      setTimeout(() => {
        setAuthMode('login');
        setRecoveryStep(1);
        setRecoverySuccess('');
      }, 2500);
    } catch (err) {
      setAuthError(err.message || 'Failed to update password.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Profile Photo Upload Handlers
  // ---------------------------------------------------------------------------
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setPhotoFeedback({ type: 'error', message: 'Only JPEG, PNG, and WebP images are supported.' });
      return;
    }

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

  // ===========================================================================
  // VIEW A: LOGGED-IN ACCOUNT MANAGEMENT DASHBOARD
  // ===========================================================================
  if (user?.isLoggedIn) {
    const isOwner = user?.role === 'OWNER' || user?.role === 'PHARMACIST';

    return (
      <div className="flex flex-col w-full px-margin pb-10 pt-2 gap-4">
        {/* Profile Card */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center text-center gap-1.5 pt-1">
            <Logo size={44} showText={false} className="drop-shadow-sm" />
            <h1 className="font-headline-lg text-xl text-primary font-bold tracking-tight">
              PharmaCare Account
            </h1>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isOwner ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
              {isOwner ? 'Verified Pharmacy Owner' : 'Verified Patient / Customer'}
            </span>
          </div>

          {/* Profile Card */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative group shrink-0">
                <img
                  src={currentAvatar}
                  alt={user.name}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/30 shadow-sm bg-surface-container-low"
                  onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  title="Upload profile photo"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {isUploadingPhoto ? 'sync' : 'photo_camera'}
                  </span>
                </button>
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <h3 className="font-headline-md text-base font-bold text-on-surface truncate">
                  {user.name}
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant truncate">
                  {user.email}
                </p>
                {user.phone && (
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {user.phone}
                  </p>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {photoFeedback && (
              <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                photoFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <span className="material-symbols-outlined text-[16px]">
                  {photoFeedback.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{photoFeedback.message}</span>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-outline-variant/10">
              {isOwner ? (
                <button
                  onClick={() => navigate('/owner/dashboard')}
                  className="col-span-2 py-2.5 px-3 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-primary/90"
                >
                  <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  Open Pharmacy Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/medicines')}
                    className="py-2.5 px-3 rounded-xl bg-surface-container-low text-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-surface-container border border-outline-variant/15"
                  >
                    <span className="material-symbols-outlined text-[16px]">medication</span>
                    Browse Medicines
                  </button>
                  <button
                    onClick={() => navigate('/track-order')}
                    className="py-2.5 px-3 rounded-xl bg-surface-container-low text-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-surface-container border border-outline-variant/15"
                  >
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    Track Orders
                  </button>
                </>
              )}
            </div>

            {/* Edit Profile Form */}
            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 pt-2 border-t border-outline-variant/15">
                <span className="text-xs font-bold text-primary">Edit Account Information</span>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editProfileForm.name}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">Phone Number</label>
                  <input
                    type="tel"
                    value={editProfileForm.phone}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">Delivery / Business Address</label>
                  <textarea
                    rows={2}
                    value={editProfileForm.address}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, address: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-sm"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low text-on-surface-variant text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileForm({
                      name: user.name || '',
                      phone: user.phone || '',
                      address: user.address || '',
                      businessName: user.businessName || '',
                    });
                    setIsEditingProfile(true);
                  }}
                  className="text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  Edit Profile & Address
                </button>
                {user.profilePhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isUploadingPhoto}
                    className="text-error hover:underline text-[11px]"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full py-3 rounded-2xl bg-surface-container-low text-error hover:bg-error/10 border border-error/20 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign Out of PharmaCare
          </button>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // VIEW B: ROLE-BASED WELCOME & AUTHENTICATION PORTAL (VISITOR FIRST SCREEN)
  // ===========================================================================
  return (
    <div className="flex flex-col w-full px-margin pb-12 pt-2 gap-4">
      {/* Brand Hero Header */}
      <div className="flex flex-col items-center text-center gap-1 pt-1">
        <Logo size={48} showText={false} className="drop-shadow-sm" />
        <h1 className="font-headline-lg text-xl text-primary font-bold tracking-tight">
          PharmaCare AI
        </h1>
        <p className="font-body-sm text-xs text-on-surface-variant max-w-[300px]">
          Clinical Pharmacopeia, 11,621 National Medicines & Verified Pharmacy Network
        </p>
      </div>

      {/* Backend Connectivity Status */}
      {backendHealth && !backendHealth.connected && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-600 text-[18px]">cloud_off</span>
            <span>Database offline — checking connectivity</span>
          </div>
          <button
            onClick={() => checkBackendHealth()}
            className="text-amber-800 font-bold underline text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Role Selection Tabs: Option A vs Option B */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/15">
        <button
          type="button"
          onClick={() => {
            setSelectedRole('user');
            setAuthError(null);
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
            selectedRole === 'user'
              ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">person</span>
            <span>Option A</span>
          </div>
          <span className="text-[11px] font-semibold opacity-90">User / Patient</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedRole('owner');
            setAuthError(null);
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
            selectedRole === 'owner'
              ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            <span>Option B</span>
          </div>
          <span className="text-[11px] font-semibold opacity-90">Pharmacy Owner</span>
        </button>
      </div>

      {/* Auth Card Container */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm flex flex-col gap-4">
        {/* Card Header & Mode Switcher */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex flex-col">
            <h2 className="font-headline-sm text-sm font-bold text-on-surface">
              {selectedRole === 'user'
                ? authMode === 'login'
                  ? 'Patient Sign In'
                  : authMode === 'register'
                  ? 'New Patient Registration'
                  : 'Recover Account Password'
                : authMode === 'login'
                ? 'Pharmacy Partner Sign In'
                : authMode === 'register'
                ? 'Register New Pharmacy'
                : 'Recover Partner Password'}
            </h2>
            <span className="text-[10px] text-on-surface-variant">
              {selectedRole === 'user'
                ? 'Order verified medicines & clinical checks'
                : 'Manage store inventory, prices & orders'}
            </span>
          </div>

          {authMode !== 'forgot' && (
            <div className="flex items-center bg-surface-container-low rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`px-2 py-1 text-[11px] font-bold rounded ${
                  authMode === 'login' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className={`px-2 py-1 text-[11px] font-bold rounded ${
                  authMode === 'register' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant'
                }`}
              >
                Register
              </button>
            </div>
          )}
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-red-600 shrink-0 mt-0.5">error</span>
            <div className="flex-1 flex justify-between items-start">
              <span>{authError}</span>
              <button onClick={() => setAuthError(null)} className="text-red-500 hover:text-red-700 ml-1">✕</button>
            </div>
          </div>
        )}

        {/* Password Recovery Success Banner */}
        {recoverySuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            <span>{recoverySuccess}</span>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            OPTION A: USER FORMS
        --------------------------------------------------------------------- */}
        {selectedRole === 'user' && authMode === 'login' && (
          <form onSubmit={handleUserLogin} className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Email Address</label>
              <input
                type="email"
                required
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full mt-1 px-3 py-2.5 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Password</label>
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setAuthError(null); }}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-1 px-3 py-2.5 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="mt-2 w-full py-3 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  Verifying...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  Sign In as Patient
                </>
              )}
            </button>
          </form>
        )}

        {selectedRole === 'user' && authMode === 'register' && (
          <form onSubmit={handleUserRegister} className="flex flex-col gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Full Name</label>
              <input
                type="text"
                required
                value={userRegForm.name}
                onChange={(e) => setUserRegForm({ ...userRegForm, name: e.target.value })}
                placeholder="Rahul Sharma"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Email Address</label>
              <input
                type="email"
                required
                value={userRegForm.email}
                onChange={(e) => setUserRegForm({ ...userRegForm, email: e.target.value })}
                placeholder="rahul@example.com"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Password (min 6 characters)</label>
              <input
                type="password"
                required
                minLength={6}
                value={userRegForm.password}
                onChange={(e) => setUserRegForm({ ...userRegForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Phone Number</label>
              <input
                type="tel"
                value={userRegForm.phone}
                onChange={(e) => setUserRegForm({ ...userRegForm, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Delivery Address</label>
              <input
                type="text"
                value={userRegForm.address}
                onChange={(e) => setUserRegForm({ ...userRegForm, address: e.target.value })}
                placeholder="Indiranagar, Bangalore 560038"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="mt-2 w-full py-3 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {authLoading ? 'Creating Account...' : 'Complete Patient Registration'}
            </button>
          </form>
        )}

        {/* ---------------------------------------------------------------------
            OPTION B: PHARMACY OWNER FORMS
        --------------------------------------------------------------------- */}
        {selectedRole === 'owner' && authMode === 'login' && (
          <form onSubmit={handleOwnerLogin} className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Registered Pharmacy Email</label>
              <input
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="pharmacy@store.com"
                className="w-full mt-1 px-3 py-2.5 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Password</label>
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setAuthError(null); }}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-1 px-3 py-2.5 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="mt-2 w-full py-3 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  Verifying Credentials...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">store</span>
                  Sign In to Pharmacy Portal
                </>
              )}
            </button>
          </form>
        )}

        {selectedRole === 'owner' && authMode === 'register' && (
          <form onSubmit={handleOwnerRegister} className="flex flex-col gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Pharmacy / Store Name</label>
              <input
                type="text"
                required
                value={ownerRegForm.business_name}
                onChange={(e) => setOwnerRegForm({ ...ownerRegForm, business_name: e.target.value })}
                placeholder="MedPlus Pharmacy Indiranagar"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Owner / Registered Pharmacist Name</label>
              <input
                type="text"
                required
                value={ownerRegForm.name}
                onChange={(e) => setOwnerRegForm({ ...ownerRegForm, name: e.target.value })}
                placeholder="Dr. Ramesh Kumar"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Business Email</label>
              <input
                type="email"
                required
                value={ownerRegForm.email}
                onChange={(e) => setOwnerRegForm({ ...ownerRegForm, email: e.target.value })}
                placeholder="owner@medplus-blr.com"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Password (min 6 characters)</label>
              <input
                type="password"
                required
                minLength={6}
                value={ownerRegForm.password}
                onChange={(e) => setOwnerRegForm({ ...ownerRegForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Store Contact Phone</label>
              <input
                type="tel"
                required
                value={ownerRegForm.phone}
                onChange={(e) => setOwnerRegForm({ ...ownerRegForm, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Store Physical Address</label>
              <input
                type="text"
                required
                value={ownerRegForm.business_address}
                onChange={(e) => setOwnerRegForm({ ...ownerRegForm, business_address: e.target.value })}
                placeholder="100 Feet Road, Indiranagar, Bangalore 560038"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="mt-2 w-full py-3 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {authLoading ? 'Registering Pharmacy...' : 'Register Pharmacy Partner Account'}
            </button>
          </form>
        )}

        {/* ---------------------------------------------------------------------
            PASSWORD RECOVERY FORM (FOR BOTH ROLES)
        --------------------------------------------------------------------- */}
        {authMode === 'forgot' && (
          <div className="flex flex-col gap-3">
            {recoveryStep === 1 ? (
              <form onSubmit={handleRequestRecovery} className="flex flex-col gap-3">
                <p className="text-xs text-on-surface-variant">
                  Enter your registered email address to initiate password recovery:
                </p>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">Registered Email</label>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="account@domain.com"
                    className="w-full mt-1 px-3 py-2.5 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary/90 flex items-center justify-center gap-1"
                >
                  {recoveryLoading ? 'Generating Reset Token...' : 'Verify Email & Continue'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCompleteReset} className="flex flex-col gap-3">
                <p className="text-xs text-on-surface-variant">
                  Email verified. Please enter your new password:
                </p>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">New Password (min 6 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full mt-1 px-3 py-2.5 text-xs rounded-xl bg-surface-container-low border border-outline-variant/20 focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary/90 flex items-center justify-center gap-1"
                >
                  {recoveryLoading ? 'Updating Password...' : 'Save New Password & Log In'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => { setAuthMode('login'); setRecoveryStep(1); setAuthError(null); }}
              className="text-center text-xs font-bold text-on-surface-variant hover:text-primary pt-1"
            >
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>

      {/* Security & Provenance Footer */}
      <div className="p-3.5 rounded-2xl bg-surface-container-low/60 border border-outline-variant/10 flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-[24px]">verified_user</span>
        <div className="flex flex-col text-[11px] text-on-surface-variant">
          <span className="font-bold text-on-surface">Protected Clinical Architecture</span>
          <span>Role-based cryptographic authentication. Verified Indian formulary of 11,621 medicines.</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
