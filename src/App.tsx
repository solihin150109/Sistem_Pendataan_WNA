import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import DataKategori from './pages/DataKategori';
import MapPage from './pages/MapPage';
import Profile from './pages/Profile';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="data/voa" element={<DataKategori type="VOA" />} />
            <Route path="data/itk" element={<DataKategori type="ITK" />} />
            <Route path="data/itas" element={<DataKategori type="ITAS" />} />
            <Route path="data/itap" element={<DataKategori type="ITAP" />} />
            <Route path="map" element={<MapPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
