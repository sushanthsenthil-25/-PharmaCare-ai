import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { CartModal } from './components/CartModal';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { HealthProductsPage } from './pages/HealthProductsPage';
import { PersonalCarePage } from './pages/PersonalCarePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { OwnerDashboardPage } from './pages/OwnerDashboardPage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Root Route: Unauthenticated visitors see the professional login/welcome portal first
function RootRoute() {
  const { user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-on-surface-variant gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        <span>Verifying clinical session...</span>
      </div>
    );
  }

  if (!user?.isLoggedIn) {
    return <LoginPage />;
  }

  if (user?.role === 'OWNER' || user?.role === 'PHARMACIST') {
    return <OwnerDashboardPage />;
  }

  return <HomePage />;
}

// Protected Route for Role-Based Authorization
function ProtectedRoute({ children, allowedRoles }) {
  const { user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-on-surface-variant gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        <span>Verifying authorization...</span>
      </div>
    );
  }

  if (!user?.isLoggedIn) {
    return <Navigate to="/login?role=owner" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role?.toUpperCase())) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-slate-950 flex justify-center items-start antialiased selection:bg-secondary-container">
          {/* Main Mobile App Frame Container */}
          <div className="w-full max-w-md min-h-screen bg-surface relative shadow-2xl flex flex-col border-x border-slate-800/80">
            <Header />
            
            {/* Scrollable Main Area */}
            <main className="flex-1 w-full pt-[96px] pb-16">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<RootRoute />} />
                  <Route path="/dashboard" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/medicines" element={<MedicinesPage />} />
                  <Route path="/health" element={<HealthProductsPage />} />
                  <Route path="/personal-care" element={<PersonalCarePage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/track-order" element={<TrackOrderPage />} />
                  <Route
                    path="/owner/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['OWNER', 'PHARMACIST', 'ADMIN']}>
                        <OwnerDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </ErrorBoundary>
            </main>

            <BottomNav />
            <CartModal />
          </div>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
