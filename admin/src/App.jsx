import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';

// Route-level code splitting: each page loads on demand so the login screen
// doesn't pay for Three.js / the studio. Login stays eager (it's the entry).
const ProjectsPage = lazy(() => import('./pages/ProjectsPage.jsx'));
const ClientsPage = lazy(() => import('./pages/ClientsPage.jsx'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage.jsx'));
const ProjectEditPage = lazy(() => import('./pages/ProjectEditPage.jsx'));
const StudioPage = lazy(() => import('./pages/StudioPage.jsx'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/projects" element={
              <ProtectedRoute><ProjectsPage /></ProtectedRoute>
            } />

            <Route path="/clients" element={
              <ProtectedRoute adminOnly><ClientsPage /></ProtectedRoute>
            } />

            <Route path="/employees" element={
              <ProtectedRoute adminOnly><EmployeesPage /></ProtectedRoute>
            } />

            <Route path="/projects/:projectId" element={
              <ProtectedRoute><ProjectEditPage /></ProtectedRoute>
            } />

            <Route path="/projects/:projectId/studio" element={
              <ProtectedRoute><StudioPage /></ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
