import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import CookieConsent from './components/CookieConsent';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import DriverVehiclePage from './pages/DriverVehiclePage';
import DriverRegistrationPage from './pages/DriverRegistrationPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminClientsPage from './pages/AdminClientsPage';
import AdminPromoCodesPage from './pages/AdminPromoCodesPage';
import AdminDriversPage from './pages/AdminDriversPage';
import AdminDriverValidationPage from './pages/AdminDriverValidationPage';
import AdminCancellationsPage from './pages/AdminCancellationsPage';
import AdminDriverPaymentsPage from './pages/AdminDriverPaymentsPage';
import RideHistory from './pages/RideHistory';
import ProfilePage from './pages/ProfilePage';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import ScheduledRidesPage from './pages/ScheduledRidesPage';
import PaymentsPage from './pages/PaymentsPage';
import WalletPage from './pages/WalletPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MentionsLegales from './pages/MentionsLegales';
import CGV from './pages/CGV';
import CGVDriver from './pages/CGVDriver';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite';
import './App.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to={user.role === 'driver' ? '/driver' : '/passenger'} replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to={user.role === 'driver' ? '/driver' : '/passenger'} replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
      <Route path="/devenir-chauffeur" element={<PublicRoute><DriverRegistrationPage /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forgot-password" element={<ResetPasswordPage />} />
      <Route path="/passenger" element={<ProtectedRoute allowedRoles={['passenger']}><PassengerDashboard /></ProtectedRoute>} />
      <Route path="/driver" element={<ProtectedRoute allowedRoles={['driver']}><DriverDashboard /></ProtectedRoute>} />
      <Route path="/driver/vehicle" element={<ProtectedRoute allowedRoles={['driver']}><DriverVehiclePage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/clients" element={<ProtectedRoute allowedRoles={['admin']}><AdminClientsPage /></ProtectedRoute>} />
      <Route path="/admin/promo-codes" element={<ProtectedRoute allowedRoles={['admin']}><AdminPromoCodesPage /></ProtectedRoute>} />
      <Route path="/admin/drivers" element={<ProtectedRoute allowedRoles={['admin']}><AdminDriversPage /></ProtectedRoute>} />
      <Route path="/admin/driver-validation" element={<ProtectedRoute allowedRoles={['admin']}><AdminDriverValidationPage /></ProtectedRoute>} />
      <Route path="/admin/cancellations" element={<ProtectedRoute allowedRoles={['admin']}><AdminCancellationsPage /></ProtectedRoute>} />
      <Route path="/admin/driver-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminDriverPaymentsPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><RideHistory /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/scheduled" element={<ProtectedRoute allowedRoles={['passenger']}><ScheduledRidesPage /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute allowedRoles={['passenger']}><PaymentsPage /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute allowedRoles={['passenger']}><WalletPage /></ProtectedRoute>} />
      <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
      <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      <Route path="/cgv" element={<CGV />} />
      <Route path="/cgv-chauffeur" element={<CGVDriver />} />
      <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <CookieConsent />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
