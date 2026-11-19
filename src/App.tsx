import React, { useState, useEffect, useCallback, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Sidebar } from './components/Sidebar';
import { TopBar, BackendConnectionState } from './components/TopBar';
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
import { useTheme } from './hooks/useTheme';
import { apiService, ApiError } from './services/api';
import { NavSectionId, getNavItemById } from './config/navigation';
import { User, UserRole } from './types/auth';
import {
  PlatformHealth,
  SystemService,
  NetworkInterfaceConfig,
  IsolationCheckResult,
  StorageMetrics,
  AuditLogItem,
  EngineTelemetry,
  SystemUpdateState,
} from './types/system';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const LEGAL_ACCEPTED_KEY = 'openndr_legal_accepted_v1';
const SIDEBAR_COLLAPSED_KEY = 'openndr_sidebar_collapsed';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(apiService.getCurrentUser());
  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Connection & refresh metadata
  const [connectionState, setConnectionState] = useState<BackendConnectionState>('checking');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live backend domain states
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [services, setServices] = useState<SystemService[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceConfig[]>([]);
  const [isolationCheck, setIsolationCheck] = useState<IsolationCheckResult | null>(null);
  const [storage, setStorage] = useState<StorageMetrics | null>(null);
  const [telemetry, setTelemetry] = useState<EngineTelemetry | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [updateState, setUpdateState] = useState<SystemUpdateState | null>(null);

  // Explicit per-domain error states (never hidden behind fake defaults)
  const [statusError, setStatusError] = useState<string | null>(null);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [interfacesError, setInterfacesError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [updatesError, setUpdatesError] = useState<string | null>(null);

  // Modals & action busy flags
  const [isLoginOpen, setIsLoginOpen] = useState(false);
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

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ type, text });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const handleAcceptLegal = useCallback(() => {
    setLegalAccepted(true);
    setIsLegalModalOpen(false);
    try {
      localStorage.setItem(LEGAL_ACCEPTED_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    showToast('success', 'Mentions légales enregistrées.');
  }, [showToast]);

  const clearOperationalData = useCallback(() => {
    setServices([]);
    setInterfaces([]);
    setIsolationCheck(null);
    setStorage(null);
    setTelemetry(null);
    setUsers([]);
    setAuditLogs([]);
  }, []);

  const refreshUpdateState = useCallback(async () => {
    try {
      const state = await apiService.getUpdateStatus();
      setUpdateState(state);
      setUpdatesError(null);
    } catch (err: unknown) {
      setUpdateState(null);
      setUpdatesError(
        extractErrorMessage(err, 'Impossible de récupérer l\'état des mises à jour.')
      );
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const healthData = await apiService.getHealth();
      setHealth(healthData);
      setConnectionState('connected');
      setLastRefreshedAt(new Date().toISOString());
    } catch (err: unknown) {
      setHealth(null);
      setConnectionState('unavailable');
      clearOperationalData();
      setUpdateState(null);
      const msg = extractErrorMessage(err, 'Serveur backend inaccessible.');
      setStatusError(msg);
      setTelemetryError(msg);
      setInterfacesError(msg);
      setUsersError(msg);
      setAuditError(msg);
      setUpdatesError(msg);
      setIsRefreshing(false);
      return;
    }

    await refreshUpdateState();

    if (!apiService.isAuthenticated()) {
      clearOperationalData();
      setStatusError(null);
      setTelemetryError(null);
      setInterfacesError(null);
      setUsersError(null);
      setAuditError(null);
      setIsRefreshing(false);
      return;
    }

    const [statusRes, telemetryRes, interfacesRes, isolationRes, storageRes] = await Promise.allSettled([
      apiService.getSystemStatus(),
      apiService.getCaptureTelemetry(),
      apiService.getInterfaces(),
      apiService.getIsolationCheck(),
      apiService.getStorageMetrics(),
    ]);

    if (statusRes.status === 'fulfilled') {
      setServices(statusRes.value.services || []);
      if (statusRes.value.engine && telemetryRes.status !== 'fulfilled') {
        setTelemetry(statusRes.value.engine);
      }
      setStatusError(null);
    } else {
      setServices([]);
      setStatusError(
        extractErrorMessage(statusRes.reason, 'Impossible de lire l\'état des services.')
      );
    }

    if (telemetryRes.status === 'fulfilled') {
      setTelemetry(telemetryRes.value);
      setTelemetryError(null);
    } else {
      if (statusRes.status !== 'fulfilled') {
        setTelemetry(null);
      }
      setTelemetryError(
        extractErrorMessage(telemetryRes.reason, 'Télémétrie de capture indisponible.')
      );
    }

    if (interfacesRes.status === 'fulfilled') {
      setInterfaces(interfacesRes.value);
      setInterfacesError(null);
    } else {
      setInterfaces([]);
      setInterfacesError(
        extractErrorMessage(interfacesRes.reason, 'Impossible de charger les interfaces réseau.')
      );
    }

    if (isolationRes.status === 'fulfilled') {
      setIsolationCheck(isolationRes.value);
    } else {
      setIsolationCheck(null);
    }

    if (storageRes.status === 'fulfilled') {
      setStorage(storageRes.value);
    } else {
      setStorage(null);
    }

    if (apiService.hasPermission('users:view')) {
      try {
        const uList = await apiService.getUsers();
        setUsers(uList);
        setUsersError(null);
      } catch (err: unknown) {
        setUsers([]);
        setUsersError(extractErrorMessage(err, 'Impossible de charger les utilisateurs.'));
      }
    } else {
      setUsers([]);
      setUsersError(null);
    }

    if (apiService.hasPermission('audit:view')) {
      try {
        const logs = await apiService.getAuditLogs(50, 0);
        setAuditLogs(logs);
        setAuditError(null);
      } catch (err: unknown) {
        setAuditLogs([]);
        setAuditError(extractErrorMessage(err, 'Impossible de charger le journal d\'audit.'));
      }
    } else {
      setAuditLogs([]);
      setAuditError(null);
    }

    setIsRefreshing(false);
  }, [clearOperationalData, refreshUpdateState]);

  useEffect(() => {
    const unsubscribe = apiService.onAuthStateChange((user) => {
      setCurrentUser(user);
      refreshData();
    });

    const interval = setInterval(refreshData, 10000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshData]);

  // Enforce RBAC visibility on active section when logging out or changing role
  useEffect(() => {
    const item = getNavItemById(activeSection);
    const forbiddenByAuth = item.requiresAuth && !currentUser;
    const forbiddenByPerm =
      item.requiredPermission && !currentUser?.permissions.includes(item.requiredPermission);

    if (forbiddenByAuth || forbiddenByPerm) {
      setActiveSection('dashboard');
    }
  }, [activeSection, currentUser]);

  // Register PWA Service Worker with silent background updates
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
      });
    } catch {
      // Ignore SW registration in unsupported environments
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

  const handleSelectSection = useCallback(
    (section: NavSectionId) => {
      setActiveSection(section);
      setMobileMenuOpen(false);
      refreshData();
    },
    [refreshData]
  );

  const handleLogin = async (email: string, pass: string) => {
    try {
      await apiService.login(email, pass);
      await refreshData();
      showToast('success', 'Authentification réussie.');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Erreur d\'authentification.');
      showToast('error', msg);
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      await refreshData();
      showToast('success', 'Session fermée et jeton JWT révoqué.');
    } catch {
      showToast('success', 'Session fermée.');
    }
  };

  const handleToggleUserActive = async (userId: string) => {
    try {
      await apiService.toggleUserActive(userId);
      await refreshData();
      showToast('success', 'Statut du compte utilisateur mis à jour.');
    } catch (err: unknown) {
      showToast('error', extractErrorMessage(err, 'Erreur lors de la mise à jour du compte.'));
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
      showToast('success', `Compte ${data.email} créé avec succès.`);
      return res;
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Erreur lors de la création du compte.');
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
      showToast('error', extractErrorMessage(err, 'Échec de la vérification des mises à jour.'));
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
      showToast('error', extractErrorMessage(err, 'Échec de la mise à jour forcée.'));
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
      showToast('error', extractErrorMessage(err, 'Échec d\'enregistrement de la configuration.'));
    } finally {
      setIsSavingUpdateConfig(false);
    }
  };

  const hasInterfaceViolation = interfaces.some(
    (i) => i.role === 'CAPTURE_PASSIVE' && !i.isStealthCompliant
  );
  const platformVersion = updateState?.current_version || health?.version || null;

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111318] text-gray-900 dark:text-gray-100 flex font-sans">
      {/* Toast notifications */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50"
        >
          <div
            className={`px-4 py-3 rounded-md border text-xs shadow-lg flex items-center gap-2.5 max-w-md ${
              toastMessage.type === 'success'
                ? 'bg-white dark:bg-[#181b20] border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-white dark:bg-[#181b20] border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Single unified navigation sidebar (desktop persistent + mobile drawer) */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        currentUser={currentUser}
        platformVersion={platformVersion}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        hasInterfaceViolation={hasInterfaceViolation}
        updateAvailable={Boolean(updateState?.update_available)}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          currentUser={currentUser}
          connectionState={connectionState}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeSection === 'dashboard' && (
            <DashboardView
              isAuthenticated={Boolean(currentUser)}
              connectionState={connectionState}
              lastRefreshedAt={lastRefreshedAt}
              isRefreshing={isRefreshing}
              onRefresh={refreshData}
              health={health}
              services={services}
              interfaces={interfaces}
              storage={storage}
              telemetry={telemetry}
              auditLogs={auditLogs}
              updateState={updateState}
              statusError={statusError}
              onOpenLogin={() => setIsLoginOpen(true)}
              onNavigateToCapture={() => handleSelectSection('capture')}
              onNavigateToInterfaces={() => handleSelectSection('interfaces')}
              onNavigateToDiagnostics={() => handleSelectSection('diagnostics')}
            />
          )}

          {activeSection === 'capture' && (
            <CaptureView
              telemetry={telemetry}
              telemetryError={telemetryError}
              canManageCapture={apiService.hasPermission('interfaces:manage')}
              onRefreshTelemetry={refreshData}
              onNotify={showToast}
            />
          )}

          {activeSection === 'interfaces' && (
            <InterfacesView
              interfaces={interfaces}
              isolationCheck={isolationCheck}
              interfacesError={interfacesError}
              onRefresh={refreshData}
            />
          )}

          {activeSection === 'rbac' && (
            <RbacView
              users={users}
              isLoading={isRefreshing}
              error={usersError}
              hasViewPermission={apiService.hasPermission('users:view')}
              canManageUsers={apiService.hasPermission('users:manage')}
              currentUserEmail={currentUser?.email || null}
              onRetry={refreshData}
              onToggleUserActive={handleToggleUserActive}
              onCreateUser={handleCreateUser}
            />
          )}

          {activeSection === 'audit' && (
            <AuditView
              logs={auditLogs}
              isLoading={isRefreshing}
              error={auditError}
              hasViewPermission={apiService.hasPermission('audit:view')}
              onRetry={refreshData}
            />
          )}

          {activeSection === 'diagnostics' && (
            <ValidationView isAuthenticated={Boolean(currentUser)} />
          )}

          {activeSection === 'settings' && (
            <SystemSettingsView
              health={health}
              updateState={updateState}
              isAuthenticated={Boolean(currentUser)}
              canManageUpdates={apiService.hasPermission('system:manage')}
              isLoadingUpdates={isRefreshing}
              updatesError={updatesError}
              onRetryUpdates={refreshData}
              isCheckingUpdate={isCheckingUpdate}
              isForcingUpdate={isForcingUpdate}
              isSavingConfig={isSavingUpdateConfig}
              onCheckForUpdates={handleCheckForUpdates}
              onForceUpdate={handleForceUpdate}
              onUpdateAutoConfig={handleUpdateAutoConfig}
              theme={theme}
              onSetTheme={setTheme}
              onOpenLegalModal={() => setIsLegalModalOpen(true)}
              onNotify={showToast}
            />
          )}

          {activeSection === 'docs' && <DocsView />}
        </main>

        {/* Minimal sober footer */}
        <footer className="border-t border-gray-200 dark:border-[#2c313a] bg-white dark:bg-[#181b20] py-3.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                OpenNDR{platformVersion ? ` v${platformVersion}` : ''} · Licence AGPL-3.0
              </span>
              {health?.target_platform && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{health.target_platform}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsLegalModalOpen(true)}
              className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Mentions légales et non-responsabilité
            </button>
          </div>
        </footer>
      </div>

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
