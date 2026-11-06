export type UserRole = 'Administrator' | 'Analyst' | 'Observer';

export type PermissionCode =
  | 'system:view'
  | 'system:manage'
  | 'interfaces:view'
  | 'interfaces:manage'
  | 'users:view'
  | 'users:manage'
  | 'audit:view'
  | 'storage:manage';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: PermissionCode[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}
