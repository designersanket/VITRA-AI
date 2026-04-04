/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Setup from "./pages/Setup";
import DailyTracker from "./pages/DailyTracker";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { TutorialProvider } from "./context/TutorialContext";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AlertCircle, Loader2 } from "lucide-react";

function DatabaseWarning() {
  const { dbConnected } = useAuth();
  
  if (dbConnected) return null;
  
  return (
    <div className="bg-red-500/10 border-b border-red-500/20 p-2 text-center text-red-400 text-xs flex items-center justify-center gap-2">
      <AlertCircle size={14} />
      <span>
        Database not connected. Please ensure <strong>MONGODB_URI</strong> is set in Secrets AND your IP is whitelisted in MongoDB Atlas (allow <strong>0.0.0.0/0</strong> for dev).
      </span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from './constants';

export default function App() {
  const content = (
    <ToastProvider>
      <AuthProvider>
        <TutorialProvider>
          <Router>
            <div className="min-h-screen bg-background text-text">
              <DatabaseWarning />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
                <Route path="/tracker" element={<ProtectedRoute><DailyTracker /></ProtectedRoute>} />
                <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
              </Routes>
              <TutorialOverlay />
            </div>
          </Router>
        </TutorialProvider>
      </AuthProvider>
    </ToastProvider>
  );

  return (
    <ErrorBoundary>
      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          {content}
        </GoogleOAuthProvider>
      ) : (
        content
      )}
    </ErrorBoundary>
  );
}
