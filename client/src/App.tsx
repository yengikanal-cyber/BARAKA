import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { Catalog } from './pages/Catalog';
import { Contacts } from './pages/Contacts';
import { Chat } from './pages/Chat';
import { Reports } from './pages/Reports';

function Stub({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="card text-center py-10">
        <div className="font-display text-xl font-semibold mb-1">{t(titleKey)}</div>
        <div className="muted text-sm">{t('common.soon')}</div>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="muted text-sm">…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clients" element={<Contacts />} />
        <Route path="/sellers" element={<Contacts />} />
        <Route path="/chat/:otherId" element={<Chat />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/messages" element={<Stub titleKey="nav.messages" />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function PublicOnly({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
