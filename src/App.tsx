import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { InterfacesView } from './components/InterfacesView';
import { RbacView } from './components/RbacView';
import { AuditView } from './components/AuditView';
import { ValidationView } from './components/ValidationView';
import { DocsView } from './components/DocsView';
import { LoginModal } from './components/LoginModal';
import { apiService } from './services/api';
import { User, UserRole } from './types/auth';
import {
  SystemService,
  NetworkInterfaceConfig,
  StorageMetrics,
  AuditLogItem,
} from './types/system';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(apiService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [services, setServices] = useState<SystemService[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceConfig[]>([]);
  const [storage, setStorage] = useState<StorageMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synchronise les données depuis l'API FastAPI réelle
  const refreshData = useCallback(async () => {
    try {
      const statusData = await apiService.getSystemStatus();
      setServices(statusData.services || []);
    } catch {
      // Ignorer si le backend n'a pas encore répondu
    }

    try {
      const ifaces = await apiService.getInterfaces();
      setInterfaces(ifaces);
    } catch {
      // Ignorer si non disponible
    }

    try {
      const stor = await apiService.getStorageMetrics();
      setStorage(stor);
    } catch {
      // Ignorer si non disponible
    }

    if (apiService.hasPermission('users:view')) {
      try {
        const uList = await apiService.getUsers();
        setUsers(uList);
      } catch {
        setUsers([]);
      }
    } else {
      setUsers([]);
    }

    if (apiService.hasPermission('audit:view')) {
      try {
        const logs = await apiService.getAuditLogs(50, 0);
        setAuditLogs(logs);
      } catch {
        setAuditLogs([]);
      }
    } else {
      setAuditLogs([]);
    }
  }, []);

  useEffect(() => {
    // S'abonne aux changements d'authentification
    const unsubscribe = apiService.onAuthStateChange((user) => {
      setCurrentUser(user);
      refreshData();
    });

    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshData]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      await apiService.login(email, pass);
      await refreshData();
      showToast('success', 'Authentification SOC réussie');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur d'authentification";
      showToast('error', msg);
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      await refreshData();
      showToast('success', 'Session déconnectée et jeton JWT révoqué');
    } catch {
      showToast('success', 'Déconnexion effectuée');
    }
  };

  const handleToggleUserActive = async (userId: string) => {
    try {
      await apiService.toggleUserActive(userId);
      await refreshData();
      showToast('success', 'Statut du compte utilisateur mis à jour');
    } catch (err: unknown) {
      if (err instanceof Error) showToast('error', err.message);
    }
  };

  const handleCreateUser = async (data: {
    email: string;
    fullName: string;
    role: UserRole;
    password?: string;
  }) => {
    try {
      const res = await apiService.createUser({
        email: data.email,
        fullName: data.fullName,
        roleName: data.role,
        password: data.password,
      });
      await refreshData();
      showToast('success', `Compte ${data.email} créé avec succès`);
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de création de compte';
      showToast('error', msg);
      throw err;
    }
  };

  const hasViolation = interfaces.some((i) => i.role === 'CAPTURE_PASSIVE' && !i.isStealthCompliant);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans">
      {/* Toast notifications */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-lg border text-xs shadow-xl flex items-center gap-2.5 max-w-md ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-rose-500/50 text-rose-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Module Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          refreshData();
        }}
        hasViolation={hasViolation}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            services={services}
            interfaces={interfaces}
            storage={storage}
            canManageSystem={apiService.hasPermission('system:manage')}
            onNavigateToInterfaces={() => setActiveTab('interfaces')}
            onNavigateToValidation={() => setActiveTab('validation')}
          />
        )}

        {activeTab === 'interfaces' && (
          <InterfacesView
            interfaces={interfaces}
            canManageInterfaces={apiService.hasPermission('interfaces:manage')}
          />
        )}

        {activeTab === 'rbac' && (
          <RbacView
            users={users}
            canManageUsers={apiService.hasPermission('users:manage')}
            onToggleUserActive={handleToggleUserActive}
            onCreateUser={handleCreateUser}
          />
        )}

        {activeTab === 'audit' && <AuditView logs={auditLogs} />}

        {activeTab === 'validation' && <ValidationView />}

        {activeTab === 'docs' && <DocsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            OpenNDR v0.1.0 · Moteur Réseau Autonome sous licence AGPL-3.0
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Debian 13 (Trixie)</span>
            <span>·</span>
            <span>PostgreSQL & Alembic</span>
            <span>·</span>
            <span>Argon2id RBAC</span>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
      />
    </div>
  );
}
