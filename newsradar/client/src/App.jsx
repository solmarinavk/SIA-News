import React from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import { ToastProvider } from './components/Toast';

function Header() {
  const navigate = useNavigate();
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">N</div>
          NewsRadar
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Header />
        <main className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectView />} />
          </Routes>
        </main>
      </ToastProvider>
    </BrowserRouter>
  );
}
