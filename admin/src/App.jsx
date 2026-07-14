import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import ProjectEditPage from './pages/ProjectEditPage.jsx';
import StudioPage from './pages/StudioPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/projects" element={
            <ProtectedRoute><ProjectsPage /></ProtectedRoute>
          } />

          <Route path="/clients" element={
            <ProtectedRoute><ClientsPage /></ProtectedRoute>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
