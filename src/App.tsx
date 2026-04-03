import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JobDetail } from './pages/JobDetail';
import { Proxies } from './pages/Proxies';
import { Emails } from './pages/Emails';

const AUTH_TOKEN = 'admin_token';

export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem(AUTH_TOKEN);
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem(AUTH_TOKEN, token);
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN);
}

export function logout(): void {
  sessionStorage.removeItem(AUTH_TOKEN);
  window.location.href = import.meta.env.BASE_URL;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated() ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proxies"
        element={
          <ProtectedRoute>
            <Proxies />
          </ProtectedRoute>
        }
      />
      <Route
        path="/emails"
        element={
          <ProtectedRoute>
            <Emails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id"
        element={
          <ProtectedRoute>
            <JobDetail />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
