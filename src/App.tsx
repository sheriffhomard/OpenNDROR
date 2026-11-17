import React, { useState, useEffect, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';
import { HamburgerMenu } from './components/HamburgerMenu';
import { DashboardView } from './components/DashboardView';
import { CaptureView } from './components/CaptureView';
import { InterfacesView } from './components/InterfacesView';
import { RbacView } from './components/RbacView';
import { AuditView } from './components/AuditView';
import { ValidationView } from './components/ValidationView';
import { SystemSettingsView } from './components/SystemSettingsView';
import { DocsView } from './components/DocsView';
import { LoginModal } from './components/LoginModal';
import { LegalOnboardingModal } from './components/LegalOnboardingModal';
import { ContextualOnboarding } from './components/ContextualOnboarding';
import { useTheme } from './hooks/useTheme';
import { apiService } from './services/api';
import { User, UserRole } from './types/auth';
import {
  SystemService,
  NetworkInterfaceConfig,
  StorageMetrics,
  AuditLogItem,
  EngineTelemetry,
  SystemUpdateState,
} from './types/system';
import { ShieldCheck, AlertCircle } from 'lucide-react';

const LEGAL_ACCEPTED_KEY = 'openndr_legal_accepted_v1';
const GUIDE_VISIBLE_KEY = 'openndr_show_guide_v1';

export default function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(apiService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [services, setServices] = useState<SystemService[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceConfig[]>([]);
  const [storage, setStorage] = useState<StorageMetrics | null>(null);
  const [telemetry, setTelemetry] = useState<EngineTelemetry | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [updateState, setUpdateState] = useState<SystemUpdateState | null>(null);

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isForcingUpdate, setIsForcingUpdate] = useState(false);
  const [isSavingUpdateConfig, setIsSavingUpdateConfig] = useState(false);

  const [legalAccepted, setLegalAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LEGAL_ACCEPTED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LEGAL_ACCEPTED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const [showGuide, setShowGuide] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(GUIDE_VISIBLE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleSetShowGuide = useCallback((visible: boolean) => {
    setShowGuide(visible);
    try {
      localStorage.setItem(GUIDE_VISIBLE_KEY, String(visible));
    } catch {
      // ignore
    }
  }, []);

  const handleAcceptLegal = useCallback(() => {
    setLegalAccepted(true);
    setIsLegalModalOpen(false);
    try {
      localStorage.setItem(LEGAL_ACCEPTED_KEY, 'true');
    } catch {
      // ignore
    }
    showToast('success', 'Legal notice acknowledged.');
  }, [showToast]);

  const refreshUpdateState = useCallback(async () => {
    try {
      const state = await apiService.getUpdateStatus();
      setUpdateState(state);
    } catch {
      // ignore temporary update fetch errors
    }
  }, []);

  // Synchronizes real telemetry & RBAC data from /api/v1
  const refreshData = useCallback(async () => {
    await refreshUpdateState();

    if (!apiService.isAuthenticated()) {
      setServices([]);
      setInterfaces([]);
      setStorage(null);
      setTelemetry(null);
      setUsers([]);
      setAuditLogs([]);
      return;
    }

    try {
      const statusData = await apiService.getSystemStatus();
      setServices(statusData.services || []);
      if (statusData.engine) {
        setTelemetry(statusData.engine);
      }
    } catch {
      // Ignore if backend is momentarily unavailable
    }

    try {
      const telem = await apiService.getCaptureTelemetry();
      setTelemetry(telem);
    } catch {
      // Ignore if unavailable
    }

    try {
      const ifaces = await apiService.getInterfaces();
      setInterfaces(ifaces);
    } catch {
      // Ignore if unavailable
    }

    try {
      const stor = await apiService.getStorageMetrics();
      setStorage(stor);
    } catch {
      // Ignore if unavailable
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
  }, [refreshUpdateState]);

  useEffect(() => {
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

  // Register PWA Service Worker with automatic background updates
  useEffect(() => {
    let swTimer: ReturnType<typeof setInterval> | null = null;
    try {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          if (registration) {
            swTimer = setInterval(() => {
              registration.update().catch(() => {
                // ignore offline SW update checks
              });
            }, 15 * 60 * 1000);
          }
        },
        onOfflineReady() {
          // Shell cached cleanly
        },
      });
    } catch {
      // Ignore SW registration in unsupported contexts
    }
    return () => {
      if (swTimer) clearInterval(swTimer);
    };
  }, []);

  // Client-side background sync for auto-update checks
  useEffect(() => {
    if (!updateState?.auto_update_enabled) return;
    const ms = Math.max(1, updateState.check_interval_minutes) * 60 * 1000;
    const timer = setInterval(() => {
      refreshUpdateState();
    }, ms);
    return () => clearInterval(timer);
  }, [updateState?.auto_update_enabled, updateState?.check_interval_minutes, refreshUpdateState]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      await apiService.login(email, pass);
      await refreshData();
      showToast('success', 'SOC authentication succeeded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication error';
      showToast('error', msg);
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      await refreshData();
      showToast('success', 'Session signed out and JWT token revoked');
    } catch {
      showToast('success', 'Signed out');
    }
  };

  const handleToggleUserActive = async (userId: string) => {
    try {
      await apiService.toggleUserActive(userId);
      await refreshData();
      showToast('success', 'User account status updated');
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
      showToast('success', `Account ${data.email} created successfully`);
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating account';
      showToast('error', msg);
      throw err;
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await apiService.checkForUpdates();
      setUpdateState(res.update_state);
      showToast('success', res.message);
      await refreshData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleForceUpdate = async () => {
    setIsForcingUpdate(true);
    try {
      const res = await apiService.forceSystemUpdate();
      setUpdateState(res.update_state);
      showToast('success', res.message);
      await refreshData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Force update failed');
    } finally {
      setIsForcingUpdate(false);
    }
  };

  const handleUpdateAutoConfig = async (enabled: boolean, intervalMinutes: number) => {
    setIsSavingUpdateConfig(true);
    try {
      const res = await apiService.updateAutoUpdateConfig(enabled, intervalMinutes);
      setUpdateState(res.update_state);
      showToast('success', res.message);
      await refreshData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save auto-update settings');
    } finally {
      setIsSavingUpdateConfig(false);
    }
  };

  const hasViolation = interfaces.some((i) => i.role === 'CAPTURE_PASSIVE' && !i.isStealthCompliant);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Toast notifications */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-lg border text-xs shadow-xl flex items-center gap-2.5 max-w-md ${
              toastMessage.type === 'success'
                ? 'bg-white dark:bg-slate-900 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-slate-900 border-rose-500/50 text-rose-700 dark:text-rose-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
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
        onOpenMenu={() => setIsMenuOpen(true)}
        onOpenSettings={() => {
          setActiveTab('settings');
          refreshUpdateState();
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        showGuide={showGuide}
        onToggleGuide={() => handleSetShowGuide(!showGuide)}
        updateAvailable={updateState?.update_available}
        onNotify={showToast}
      />

      {/* Categorized Hamburger Menu Drawer */}
      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          refreshData();
        }}
        hasViolation={hasViolation}
        theme={theme}
        onToggleTheme={toggleTheme}
        showGuide={showGuide}
        onToggleGuide={() => handleSetShowGuide(!showGuide)}
        onOpenLegal={() => setIsLegalModalOpen(true)}
        onNotify={showToast}
      />

      {/* Module Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          refreshData();
        }}
        hasViolation={hasViolation}
        updateAvailable={updateState?.update_available}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ContextualOnboarding
          activeTab={activeTab}
          isVisible={showGuide}
          isAuthenticated={Boolean(currentUser)}
          onDismiss={() => handleSetShowGuide(false)}
          onOpenLogin={() => setIsLoginOpen(true)}
        />

        {activeTab === 'dashboard' && (
          <DashboardView
            services={services}
            interfaces={interfaces}
            storage={storage}
            telemetry={telemetry}
            canManageSystem={apiService.hasPermission('system:manage')}
            onNavigateToCapture={() => setActiveTab('capture')}
            onNavigateToInterfaces={() => setActiveTab('interfaces')}
            onNavigateToValidation={() => setActiveTab('validation')}
          />
        )}

        {activeTab === 'capture' && (
          <CaptureView
            telemetry={telemetry}
            canManageCapture={apiService.hasPermission('interfaces:manage')}
            onRefreshTelemetry={refreshData}
            onNotify={showToast}
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

        {activeTab === 'settings' && (
          <SystemSettingsView
            updateState={updateState}
            isCheckingUpdate={isCheckingUpdate}
            isForcingUpdate={isForcingUpdate}
            isSavingConfig={isSavingUpdateConfig}
            onCheckForUpdates={handleCheckForUpdates}
            onForceUpdate={handleForceUpdate}
            onUpdateAutoConfig={handleUpdateAutoConfig}
            theme={theme}
            onSetTheme={setTheme}
            showGuide={showGuide}
            onSetShowGuide={handleSetShowGuide}
            onOpenLegalModal={() => setIsLegalModalOpen(true)}
            onNotify={showToast}
          />
        )}

        {activeTab === 'docs' && <DocsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>OpenNDR v0.2.0 · Autonomous Network Engine licensed under AGPL-3.0</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => setIsLegalModalOpen(true)}
              className="underline hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Legal Notice &amp; Data Disclaimer
            </button>
          </div>
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <span>Debian 13 (Trixie)</span>
            <span>·</span>
            <span>PostgreSQL &amp; Alembic</span>
            <span>·</span>
            <span>Argon2id RBAC</span>
          </div>
        </div>
      </footer>

      {/* Legal Onboarding & Liability Disclaimer Modal */}
      <LegalOnboardingModal
        isOpen={isLegalModalOpen}
        alreadyAccepted={legalAccepted}
        onAccept={handleAcceptLegal}
        onClose={() => setIsLegalModalOpen(false)}
      />

      {/* Authentication Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
      />
    </div>
  );
}
