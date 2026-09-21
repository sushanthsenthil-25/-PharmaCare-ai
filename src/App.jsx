import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
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

export function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-slate-950 flex justify-center items-start antialiased selection:bg-secondary-container">
          {/* Main Mobile App Frame Container */}
          <div className="w-full max-w-md min-h-screen bg-surface relative shadow-2xl flex flex-col border-x border-slate-800/80">
            <Header />
            
            {/* Scrollable Main Area */}
            <main className="flex-1 w-full pt-32 pb-20">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/medicines" element={<MedicinesPage />} />
                <Route path="/health" element={<HealthProductsPage />} />
                <Route path="/personal-care" element={<PersonalCarePage />} />
                <Route path="/product/:id" element={<ProductDetailPage />} />
                <Route path="/track-order" element={<TrackOrderPage />} />
              </Routes>
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
