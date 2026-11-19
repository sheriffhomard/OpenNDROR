/**
 * OpenNDR V0.2 — Real HTTP API Client Layer
 *
 * Direct HTTP communication with the FastAPI backend (/api/v1).
 * No simulated data, no hardcoded demo accounts, strict JWT token handling,
 * and automatic logout on token invalidation.
 */
import { User, AuthSession, PermissionCode } from '../types/auth';
import {
  SystemService,
  NetworkInterfaceConfig,
  StorageMetrics,
  AuditLogItem,
  EngineTelemetry,
  PcapIngestionResult,
  SystemUpdateState,
} from '../types/system';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api/v1';
const TOKEN_KEY = 'openndr_jwt_token';
const USER_KEY = 'openndr_auth_user';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type AuthListener = (user: User | null) => void;

class ApiService {
  private token: string | null = null;
  private currentUser: User | null = null;
  private authListeners: Set<AuthListener> = new Set();

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        this.token = storedToken;
        this.currentUser = JSON.parse(storedUser);
      }
    } catch {
      this.clearSession();
    }
  }

  private saveSession(token: string, user: User) {
    this.token = token;
    this.currentUser = user;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage errors
    }
    this.notifyAuthListeners();
  }

  private clearSession() {
    this.token = null;
    this.currentUser = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Ignore storage errors
    }
    this.notifyAuthListeners();
  }

  public onAuthStateChange(listener: AuthListener): () => void {
    this.authListeners.add(listener);
    listener(this.currentUser);
    return () => {
      this.authListeners.delete(listener);
    };
  }

  private notifyAuthListeners() {
    for (const listener of this.authListeners) {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    }
  }

  public getCurrentSession(): AuthSession | null {
    if (!this.token || !this.currentUser) return null;
    return {
      token: this.token,
      user: this.currentUser,
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.token && this.currentUser);
  }

  public hasPermission(permission: PermissionCode): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.permissions.includes(permission);
  }

  /**
   * Client HTTP centralisé avec gestion des en-têtes et des erreurs
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkErr: unknown) {
      throw new ApiError(
        'Unable to reach the OpenNDR server. Ensure the backend service is running.',
        0,
        networkErr
      );
    }

    // Handle session expiration or invalidation
    if (response.status === 401) {
      this.clearSession();
      throw new ApiError(
        'Session expired or unauthorized. Please sign in again.',
        401
      );
    }

    if (response.status === 403) {
      throw new ApiError(
        'Access denied. Insufficient RBAC privileges to perform this operation.',
        403
      );
    }

    if (!response.ok) {
      let errDetail = `HTTP Error ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.detail) {
          errDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // Fallback generic error
      }
      throw new ApiError(errDetail, response.status);
    }

    // 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    try {
      return await response.json();
    } catch (jsonErr: unknown) {
      throw new ApiError('Invalid backend response format (expected JSON).', response.status, jsonErr);
    }
  }

  // ==========================================
  // Authentification
  // ==========================================

  public async login(email: string, password: string): Promise<User> {
    const data = await this.request<{
      access_token: string;
      token_type: string;
      email: string;
      full_name: string;
      role: 'Administrator' | 'Analyst' | 'Observer';
      permissions: PermissionCode[];
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const user: User = {
      id: email,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      permissions: data.permissions,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.saveSession(data.access_token, user);
    return user;
  }

  public async logout(): Promise<void> {
    try {
      if (this.token) {
        await this.request('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Ignorer l'erreur réseau lors du logout
    } finally {
      this.clearSession();
    }
  }

  public async getProfile(): Promise<User> {
    const data = await this.request<{
      id: string;
      email: string;
      full_name: string;
      role: 'Administrator' | 'Analyst' | 'Observer';
      permissions: PermissionCode[];
      is_active: boolean;
      created_at: string;
      last_login_at?: string;
    }>('/auth/me');

    const user: User = {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      permissions: data.permissions,
      isActive: data.is_active,
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at,
    };

    if (this.currentUser) {
      this.currentUser = user;
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {
        // Ignore
      }
    }
    return user;
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  // ==========================================
  // Gestion des Utilisateurs (RBAC)
  // ==========================================

  public async getUsers(): Promise<User[]> {
    const rawList = await this.request<
      Array<{
        id: string;
        email: string;
        full_name: string;
        role: 'Administrator' | 'Analyst' | 'Observer';
        permissions: PermissionCode[];
        is_active: boolean;
        created_at: string;
        last_login_at?: string;
      }>
    >('/users');

    return rawList.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      permissions: u.permissions,
      isActive: u.is_active,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
    }));
  }

  public async createUser(data: {
    email: string;
    fullName: string;
    roleName: 'Administrator' | 'Analyst' | 'Observer';
    password?: string;
  }): Promise<{ user: User; temporaryPassword?: string }> {
    const res = await this.request<{
      id: string;
      email: string;
      full_name: string;
      role: 'Administrator' | 'Analyst' | 'Observer';
      permissions: PermissionCode[];
      is_active: boolean;
      created_at: string;
      temporary_password?: string;
    }>('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        full_name: data.fullName,
        role_name: data.roleName,
        password: data.password || undefined,
      }),
    });

    return {
      user: {
        id: res.id,
        email: res.email,
        fullName: res.full_name,
        role: res.role,
        permissions: res.permissions,
        isActive: res.is_active,
        createdAt: res.created_at,
      },
      temporaryPassword: res.temporary_password,
    };
  }

  public async toggleUserActive(userId: string): Promise<User> {
    const res = await this.request<{
      id: string;
      email: string;
      full_name: string;
      role: 'Administrator' | 'Analyst' | 'Observer';
      permissions: PermissionCode[];
      is_active: boolean;
      created_at: string;
    }>(`/users/${userId}/toggle-active`, {
      method: 'POST',
    });

    return {
      id: res.id,
      email: res.email,
      fullName: res.full_name,
      role: res.role,
      permissions: res.permissions,
      isActive: res.is_active,
      createdAt: res.created_at,
    };
  }

  public async updateUserRole(
    userId: string,
    role: 'Administrator' | 'Analyst' | 'Observer'
  ): Promise<User> {
    const res = await this.request<{
      id: string;
      email: string;
      full_name: string;
      role: 'Administrator' | 'Analyst' | 'Observer';
      permissions: PermissionCode[];
      is_active: boolean;
      created_at: string;
    }>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role_name: role }),
    });

    return {
      id: res.id,
      email: res.email,
      fullName: res.full_name,
      role: res.role,
      permissions: res.permissions,
      isActive: res.is_active,
      createdAt: res.created_at,
    };
  }

  public async deleteUser(userId: string): Promise<void> {
    await this.request<void>(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // Supervision Système & Santé
  // ==========================================

  public async getSystemStatus(): Promise<{
    platform: { version: string; target_os: string; environment: string; engine_state?: string };
    engine?: EngineTelemetry;
    services: SystemService[];
    interfaces: {
      admin: { name: string; role: string; status: string };
      capture: {
        name: string;
        role: string;
        isolation: string;
        capture_engine_active: boolean;
        capture_mode?: string;
        notice: string;
      };
    };
    storage: {
      pcap_path: string;
      max_storage_gb: number;
      retention_days: number;
    };
  }> {
    return await this.request('/system/status');
  }

  public async getInterfaces(): Promise<NetworkInterfaceConfig[]> {
    const raw = await this.request<
      Array<{
        id: number;
        name: string;
        role: 'ADMINISTRATION' | 'CAPTURE_PASSIVE' | 'LOOPBACK';
        ip_address: string | null;
        mac_address: string;
        is_promiscuous: boolean;
        is_up: boolean;
        mtu: number;
        speed_mbps: number;
        rx_dropped: number;
        is_stealth_compliant: boolean;
      }>
    >('/system/interfaces');

    return raw.map((item) => ({
      name: item.name,
      role: item.role,
      ipAddress: item.ip_address,
      macAddress: item.mac_address,
      isPromiscuous: item.is_promiscuous,
      isUp: item.is_up,
      mtu: item.mtu,
      speedMbps: item.speed_mbps,
      rxDropped: item.rx_dropped,
      isStealthCompliant: item.is_stealth_compliant,
      complianceReason:
        item.role !== 'CAPTURE_PASSIVE'
          ? 'Interface non dédiée à la capture passive'
          : item.is_stealth_compliant
          ? 'Conforme : aucune adresse IP assignée et mode promiscuous actif'
          : 'Non conforme : une adresse IP est assignée sur l\'interface de capture passive',
    }));
  }

  public async getStorageMetrics(): Promise<StorageMetrics> {
    return await this.request<StorageMetrics>('/system/storage');
  }

  public async getStorage(): Promise<StorageMetrics> {
    return this.getStorageMetrics();
  }

  public async getAuditLogs(
    limit: number = 50,
    offset: number = 0,
    statusFilter?: string
  ): Promise<AuditLogItem[]> {
    let endpoint = `/system/audit?limit=${limit}&offset=${offset}`;
    if (statusFilter) {
      endpoint += `&status_filter=${encodeURIComponent(statusFilter)}`;
    }
    const raw = await this.request<
      Array<{
        id: number;
        timestamp: string;
        user_email: string;
        user_role?: string | null;
        ip_address: string;
        action: string;
        resource_type: string;
        resource_id?: string;
        details_json?: string;
        status: 'SUCCESS' | 'DENIED' | 'FAILURE';
      }>
    >(endpoint);

    return raw.map((entry) => {
      let parsedDetails: Record<string, unknown> = {};
      if (entry.details_json) {
        try {
          parsedDetails = JSON.parse(entry.details_json);
        } catch {
          parsedDetails = { raw: entry.details_json };
        }
      }

      return {
        id: String(entry.id),
        timestamp: entry.timestamp,
        userEmail: entry.user_email,
        userRole: entry.user_role || null,
        action: entry.action,
        resourceType: entry.resource_type,
        resourceId: entry.resource_id || '-',
        status: entry.status,
        details: parsedDetails,
        ipAddress: entry.ip_address,
      };
    });
  }

  public async getIsolationCheck(): Promise<{
    interface: string;
    status: string;
    is_isolated: boolean;
    has_ip: boolean;
    has_routes: boolean;
    is_promiscuous: boolean;
    details: string;
  }> {
    return await this.request('/system/interfaces/isolation-check');
  }

  public async getHealth(): Promise<{
    status: string;
    version: string;
    target_platform: string;
    database: { connected?: boolean; status: string };
    capture_engine: {
      version?: string;
      mode?: string;
      socket_ready?: boolean;
      socket_present?: boolean;
      capture_active?: boolean;
      packets_received?: number;
      status?: string;
      notice?: string;
    };
    timestamp: string;
  }> {
    return await this.request('/health');
  }

  public async getReadiness(): Promise<{
    status: string;
    database_connected: boolean;
    details?: string;
    timestamp: string;
  }> {
    return await this.request('/health/ready');
  }

  public async getLiveness(): Promise<{ status: string; timestamp: string }> {
    return await this.request('/health/live');
  }

  public async getCaptureTelemetry(): Promise<EngineTelemetry> {
    return await this.request<EngineTelemetry>('/system/capture/telemetry');
  }

  public async startCapture(): Promise<{ status: string; message?: string; capture_mode?: string }> {
    return await this.request('/system/capture/start', { method: 'POST' });
  }

  public async stopCapture(): Promise<{ status: string; message?: string; capture_mode?: string }> {
    return await this.request('/system/capture/stop', { method: 'POST' });
  }

  public async ingestPcap(filepath: string): Promise<PcapIngestionResult> {
    return await this.request<PcapIngestionResult>('/system/capture/ingest-pcap', {
      method: 'POST',
      body: JSON.stringify({ filepath }),
    });
  }

  public async uploadPcap(filename: string, contentBase64: string): Promise<PcapIngestionResult> {
    return await this.request<PcapIngestionResult>('/system/capture/upload-pcap', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        content_base64: contentBase64,
      }),
    });
  }

  // ==========================================
  // System Settings & Background Auto-Updater
  // ==========================================

  public async getUpdateStatus(): Promise<SystemUpdateState> {
    return await this.request<SystemUpdateState>('/system/updates');
  }

  public async checkForUpdates(): Promise<{ message: string; update_state: SystemUpdateState }> {
    return await this.request<{ message: string; update_state: SystemUpdateState }>('/system/updates/check', {
      method: 'POST',
    });
  }

  public async forceSystemUpdate(): Promise<{ message: string; update_state: SystemUpdateState }> {
    return await this.request<{ message: string; update_state: SystemUpdateState }>('/system/updates/force', {
      method: 'POST',
    });
  }

  public async updateAutoUpdateConfig(
    autoUpdateEnabled: boolean,
    checkIntervalMinutes: number
  ): Promise<{ message: string; update_state: SystemUpdateState }> {
    return await this.request<{ message: string; update_state: SystemUpdateState }>('/system/updates/config', {
      method: 'PUT',
      body: JSON.stringify({
        auto_update_enabled: autoUpdateEnabled,
        check_interval_minutes: checkIntervalMinutes,
      }),
    });
  }
}

export const apiService = new ApiService();
