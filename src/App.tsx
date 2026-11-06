import React, { useState, useEffect } from 'react';
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
import { SystemService, NetworkInterfaceConfig, StorageMetrics, AuditLogItem } from './types/system';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [services, setServices] = useState<SystemService[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceConfig[]>([]);
  const [storage, setStorage] = useState<StorageMetrics>(apiService.getStorageMetrics());
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Synchronise state from apiService
  const refreshData = () => {
    const session = apiService.getCurrentSession();
    setCurrentUser(session ? session.user : null);
    setServices(apiService.getServices());
    setInterfaces(apiService.getInterfaces());
    setStorage(apiService.getStorageMetrics());

    try {
      if (apiService.hasPermission('users:view')) {
        setUsers(apiService.getUsers());
      }
    } catch {
      setUsers([]);
    }

    try {
      if (apiService.hasPermission('audit:view')) {
        setAuditLogs(apiService.getAuditLogs());
      }
    } catch {
      setAuditLogs([]);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      setServices(apiService.getServices());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handlers
  const handleSwitchRole = (role: UserRole) => {
    try {
      apiService.switchRole(role);
      refreshData();
      showToast('success', `Session basculée sur le rôle ${role}`);
    } catch (err: unknown) {
      if (err instanceof Error) showToast('error', err.message);
    }
  };

  const handleLogin = (email: string, pass: string) => {
    try {
      apiService.login(email, pass);
      refreshData();
      showToast('success', 'Authentification SOC réussie');
    } catch (err: unknown) {
      if (err instanceof Error) {
        showToast('error', err.message);
        throw err;
      }
    }
  };

  const handleLogout = () => {
    apiService.logout();
    refreshData();
    showToast('success', 'Déconnexion effectuée');
  };

  const handleRestartService = (unit: string) => {
    try {
      apiService.restartService(unit);
      refreshData();
      showToast('success', `Ordre de redémarrage envoyé à systemd pour ${unit}`);
    } catch (err: unknown) {
      if (err instanceof Error) showToast('error', err.message);
    }
  };

  const handleSimulateViolation = (name: string, badIp: string) => {
    try {
      apiService.simulatePassiveInterfaceIpViolation(name, badIp);
      refreshData();
      showToast('error', `ALERTE : Assignation IP simulée sur l'interface passive ${name} !`);
    } catch (err: unknown) {
      if (err instanceof Error) showToast('error', err.message);
    }
  };

  const handleRectifyInterface = (name: string) => {
    try {
      apiService.rectifyPassiveInterface(name);
      refreshData();
      showToast('success', `Conformité furtive restaurée pour ${name} (IP révoquée)`);
    } catch (err: unknown) {
      if (err instanceof Error) showToast('error', err.message);
    }
  };

  const handleToggleUserActive = (userId: string) => {
    try {
      apiService.toggleUserActive(userId);
      refreshData();
      showToast('success', 'Statut du compte utilisateur mis à jour');
    } catch (err: unknown) {
      if (err instanceof Error) showToast('error', err.message);
    }
  };

  const handleCreateUser = (data: { email: string; fullName: string; role: UserRole }) => {
    try {
      apiService.createUser(data);
      refreshData();
      showToast('success', `Compte ${data.email} créé avec succès`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        showToast('error', err.message);
        throw err;
      }
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
        onSwitchRole={handleSwitchRole}
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
            onRestartService={handleRestartService}
            onNavigateToInterfaces={() => setActiveTab('interfaces')}
            onNavigateToValidation={() => setActiveTab('validation')}
          />
        )}

        {activeTab === 'interfaces' && (
          <InterfacesView
            interfaces={interfaces}
            canManageInterfaces={apiService.hasPermission('interfaces:manage')}
            onSimulateViolation={handleSimulateViolation}
            onRectifyInterface={handleRectifyInterface}
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
            <span>AF_PACKET Promisc</span>
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
