import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { user, login, register, logout, authLoading, authError, setAuthError } = useApp();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'otp'
  
  // Login form state
  const [email, setEmail] = useState('owner@pharmacare.ai');
  const [password, setPassword] = useState('Password123!');

  // Register form state
  const [regForm, setRegForm] = useState({
    business_name: 'Apollo City Pharmacy',
    full_name: 'Dr. Ramesh Kumar',
    email: '',
    password: '',
    phone: '9876543210',
    business_gstin: '29ABCDE1234F1Z5',
    business_address: '100 Feet Road, Indiranagar, Bangalore',
    branch_name: 'Indiranagar Main Branch'
  });

  // OTP Demo state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '']);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    const res = await login(email, password);
    if (res.success) {
      navigate('/');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await register(regForm);
    if (res.success) {
      navigate('/');
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
    // Use demo login
    const res = await login('owner@pharmacare.ai', 'Password123!');
    if (res.success) {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex flex-col w-full px-margin pb-12 pt-4 min-h-[80vh] justify-between">
      <div className="flex flex-col gap-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center gap-2 pt-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-container/20 flex items-center justify-center text-primary shadow-sm border border-primary/20">
            <span className="material-symbols-outlined text-[36px]">health_and_safety</span>
          </div>
          <h1 className="font-headline-lg text-2xl text-primary font-bold tracking-tight">
            PharmaCare AI Account
          </h1>
          <p className="font-body-sm text-xs text-on-surface-variant max-w-[280px]">
            Enterprise Pharmacy Intelligence & Clinical Operations
          </p>
        </div>

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

        {/* User is Already Logged In */}
        {user.isLoggedIn ? (
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/15">
              <img
                src={user.avatar}
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-base font-bold text-primary">{user.name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                    {user.role}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">{user.email}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 py-1 text-xs text-on-surface-variant">
              <div className="flex justify-between py-1 border-b border-outline-variant/10">
                <span className="font-medium">Business:</span>
                <span className="font-bold text-primary">{user.businessName || 'PharmaCare Network'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/10">
                <span className="font-medium">Status:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active & Authenticated
                </span>
              </div>
            </div>

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
          /* Authentication Forms */
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
                      placeholder="owner@pharmacare.ai"
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
