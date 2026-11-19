import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Check,
  Minus,
  X,
  Lock,
  AlertCircle,
  Copy,
  CheckCheck,
  Shield,
} from 'lucide-react';
import { User, UserRole, PermissionCode } from '../types/auth';
import { HelpTooltip } from './HelpTooltip';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorState,
  DataTable,
  ConfirmDialog,
} from './ui';

interface RbacViewProps {
  users: User[];
  isLoading?: boolean;
  error?: string | null;
  hasViewPermission: boolean;
  canManageUsers: boolean;
  currentUserEmail?: string | null;
  onRetry?: () => void;
  onToggleUserActive: (userId: string) => Promise<void>;
  onCreateUser: (data: {
    email: string;
    fullName: string;
    role: UserRole;
    password?: string;
  }) => Promise<{ user: User; temporaryPassword?: string }>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  Administrator: 'Administrateur',
  Analyst: 'Analyste',
  Observer: 'Observateur',
};

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  Administrator:
    'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/60',
  Analyst:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  Observer:
    'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
};

export const RbacView: React.FC<RbacViewProps> = ({
  users,
  isLoading = false,
  error = null,
  hasViewPermission,
  canManageUsers,
  currentUserEmail = null,
  onRetry,
  onToggleUserActive,
  onCreateUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Analyst');
  const [customPassword, setCustomPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    tempPass: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [pendingToggleUser, setPendingToggleUser] = useState<User | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) setIsModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isModalOpen, isSubmitting]);

  const permissionMatrix: {
    code: PermissionCode;
    label: string;
    module: string;
    admin: boolean;
    analyst: boolean;
    observer: boolean;
  }[] = [
    {
      code: 'system:view',
      label: 'Consulter l\'état système et les métriques de capture',
      module: 'Système',
      admin: true,
      analyst: true,
      observer: true,
    },
    {
      code: 'system:manage',
      label: 'Administrer les services et paramètres plateforme',
      module: 'Système',
      admin: true,
      analyst: false,
      observer: false,
    },
    {
      code: 'interfaces:view',
      label: 'Consulter la configuration et la conformité réseau',
      module: 'Réseau',
      admin: true,
      analyst: true,
      observer: true,
    },
    {
      code: 'interfaces:manage',
      label: 'Piloter la capture et analyser des fichiers PCAP',
      module: 'Réseau',
      admin: true,
      analyst: false,
      observer: false,
    },
    {
      code: 'users:view',
      label: 'Consulter l\'annuaire des comptes et des rôles',
      module: 'Utilisateurs',
      admin: true,
      analyst: true,
      observer: false,
    },
    {
      code: 'users:manage',
      label: 'Créer, activer ou désactiver des comptes utilisateurs',
      module: 'Utilisateurs',
      admin: true,
      analyst: false,
      observer: false,
    },
    {
      code: 'audit:view',
      label: 'Consulter le journal d\'audit de sécurité',
      module: 'Audit',
      admin: true,
      analyst: true,
      observer: false,
    },
    {
      code: 'storage:manage',
      label: 'Modifier les politiques de rétention PCAP',
      module: 'Stockage',
      admin: true,
      analyst: false,
      observer: false,
    },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!newEmail.trim() || !newFullName.trim()) {
      setErrorMsg('Veuillez renseigner l\'adresse e-mail et le nom complet.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onCreateUser({
        email: newEmail.trim(),
        fullName: newFullName.trim(),
        role: newRole,
        password: customPassword ? customPassword.trim() : undefined,
      });

      setIsModalOpen(false);
      setNewEmail('');
      setNewFullName('');
      setCustomPassword('');

      if (res && res.temporaryPassword) {
        setCreatedCredentials({
          email: res.user.email,
          tempPass: res.temporaryPassword,
        });
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la création du compte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!pendingToggleUser) return;
    setIsToggling(true);
    try {
      await onToggleUserActive(pendingToggleUser.id);
    } finally {
      setIsToggling(false);
      setPendingToggleUser(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Utilisateurs et rôles"
        description="Gestion des comptes d'accès et matrice des autorisations RBAC vérifiée côté serveur."
        actions={
          canManageUsers && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Créer un compte</span>
            </button>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {/* One-time temporary password banner */}
      {createdCredentials && (
        <div
          role="status"
          className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 space-y-2 text-xs"
        >
          <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-200 font-semibold">
            <span>Compte créé avec succès</span>
            <button
              type="button"
              onClick={() => setCreatedCredentials(null)}
              aria-label="Fermer l'alerte de mot de passe temporaire"
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            Un mot de passe temporaire à usage unique a été généré pour{' '}
            <strong className="font-mono text-gray-900 dark:text-gray-100">
              {createdCredentials.email}
            </strong>
            . Copiez-le maintenant : il ne sera plus affiché après fermeture.
          </p>
          <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-[#111318] border border-gray-200 dark:border-[#2c313a] rounded-md font-mono text-gray-900 dark:text-gray-100">
            <span className="flex-1 font-semibold select-all">{createdCredentials.tempPass}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(createdCredentials.tempPass)}
              className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded border border-gray-200 dark:border-[#2c313a]"
              title="Copier le mot de passe temporaire"
            >
              {copied ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Annuaire des comptes */}
      <SectionCard
        title={
          <>
            <span>Annuaire des utilisateurs</span>
            <HelpTooltip
              title="Comptes enregistrés"
              description="Liste réelle des opérateurs enregistrés sur le serveur, leur rôle et leur état d'activation."
            />
          </>
        }
        description="Les privilèges sont contrôlés côté backend sur chaque route API."
        actions={
          hasViewPermission && (
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 tabular-nums">
              {users.length} compte(s)
            </span>
          )
        }
        noPadding
      >
        {!hasViewPermission ? (
          <EmptyState
            title="Accès restreint"
            description="Votre compte actuel ne dispose pas du privilège users:view requis pour consulter l'annuaire des utilisateurs."
          />
        ) : isLoading && users.length === 0 ? (
          <LoadingState message="Chargement de l'annuaire des utilisateurs..." />
        ) : users.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur retourné"
            description="Aucun compte n'a été remonté par le serveur."
          />
        ) : (
          <DataTable>
            <thead className="bg-gray-50 dark:bg-[#111318] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#2c313a]">
              <tr>
                <th className="px-4 py-3 font-medium">Nom et identifiant</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Dernière connexion</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2c313a]">
              {users.map((user) => {
                const isSelf =
                  currentUserEmail &&
                  user.email.toLowerCase() === currentUserEmail.toLowerCase();

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-[#1f2329] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {user.fullName}
                      </div>
                      <div className="font-mono text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${ROLE_BADGE_CLASSES[user.role]}`}
                      >
                        <Shield className="w-3 h-3 shrink-0" />
                        <span>{ROLE_LABELS[user.role]}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400 tabular-nums">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString('fr-FR')
                        : 'Jamais connecté'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        state={user.isActive ? 'operational' : 'stopped'}
                        label={user.isActive ? 'Actif' : 'Désactivé'}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManageUsers ? (
                        <button
                          type="button"
                          onClick={() => setPendingToggleUser(user)}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {user.isActive ? 'Désactiver' : 'Réactiver'}
                          {isSelf ? ' (session actuelle)' : ''}
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      {/* Matrice des autorisations */}
      <SectionCard
        title={
          <>
            <span>Matrice des autorisations par rôle</span>
            <HelpTooltip
              title="Référence des permissions"
              description="Tableau de référence indiquant les droits associés aux trois rôles prédéfinis de la plateforme."
            />
          </>
        }
        description="Répartition fixe des privilèges appliquée par le contrôleur d'accès."
        noPadding
      >
        <DataTable>
          <thead className="bg-gray-50 dark:bg-[#111318] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#2c313a]">
            <tr>
              <th className="px-4 py-3 font-medium">Permission</th>
              <th className="px-4 py-3 font-medium">Domaine</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium text-center">Administrateur</th>
              <th className="px-4 py-3 font-medium text-center">Analyste</th>
              <th className="px-4 py-3 font-medium text-center">Observateur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-[#2c313a]">
            {permissionMatrix.map((item) => (
              <tr key={item.code} className="hover:bg-gray-50 dark:hover:bg-[#1f2329]">
                <td className="px-4 py-2.5 font-mono text-gray-900 dark:text-gray-100">
                  {item.code}
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{item.module}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{item.label}</td>
                <td className="px-4 py-2.5 text-center">
                  {item.admin ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <Minus className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {item.analyst ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <Minus className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {item.observer ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <Minus className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </SectionCard>

      {/* Modale création utilisateur */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
        >
          <div className="bg-white dark:bg-[#181b20] border border-gray-200 dark:border-[#2c313a] rounded-lg max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-[#2c313a]">
              <h3
                id="create-user-title"
                className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Nouveau compte utilisateur</span>
              </h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
                aria-label="Fermer le formulaire de création"
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-300 text-xs rounded-md flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="rbac-new-email"
                  className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1.5 font-medium"
                >
                  <span>Adresse e-mail</span>
                  <HelpTooltip
                    title="Identifiant de connexion"
                    description="Adresse utilisée par l'opérateur pour s'authentifier auprès de l'API."
                    align="left"
                  />
                </label>
                <input
                  id="rbac-new-email"
                  type="email"
                  required
                  placeholder="operateur@domaine.local"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="rbac-new-name"
                  className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1.5 font-medium"
                >
                  <span>Nom complet</span>
                  <HelpTooltip
                    title="Nom affiché"
                    description="Nom lisible apparaissant dans l'annuaire et dans le journal d'audit."
                    align="left"
                  />
                </label>
                <input
                  id="rbac-new-name"
                  type="text"
                  required
                  placeholder="Ex. Camille Martin (Analyste SOC)"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="rbac-new-role"
                  className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1.5 font-medium"
                >
                  <span>Rôle et niveau de privilèges</span>
                  <HelpTooltip
                    title="Choix du rôle"
                    description="Administrateur : gestion complète. Analyste : investigation et audit. Observateur : lecture seule."
                    align="left"
                  />
                </label>
                <select
                  id="rbac-new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 text-xs"
                >
                  <option value="Administrator">Administrateur (Gestion complète)</option>
                  <option value="Analyst">Analyste (Investigation et audit)</option>
                  <option value="Observer">Observateur (Lecture seule)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="rbac-new-password"
                  className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1.5 font-medium"
                >
                  <span>Mot de passe (optionnel)</span>
                  <HelpTooltip
                    title="Mot de passe initial"
                    description="Laissez vide pour générer automatiquement un mot de passe temporaire aléatoire, ou saisissez au moins 12 caractères."
                    align="left"
                  />
                </label>
                <input
                  id="rbac-new-password"
                  type="password"
                  placeholder="Min. 12 caractères (ou laisser vide)"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#111318] border border-gray-200 dark:border-[#2c313a] rounded-md text-gray-600 dark:text-gray-400 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  Hachage Argon2id conforme. En l&apos;absence de saisie, un mot de passe temporaire
                  robuste sera généré côté serveur et affiché une seule fois.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-[#2c313a]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
                >
                  {isSubmitting ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation désactivation / réactivation */}
      <ConfirmDialog
        isOpen={Boolean(pendingToggleUser)}
        title={
          pendingToggleUser?.isActive
            ? 'Désactiver le compte utilisateur ?'
            : 'Réactiver le compte utilisateur ?'
        }
        message={
          pendingToggleUser?.isActive
            ? `L'utilisateur ${pendingToggleUser.email} ne pourra plus se connecter tant que son compte restera désactivé.`
            : `L'utilisateur ${pendingToggleUser?.email} retrouvera ses droits d'accès selon le rôle ${pendingToggleUser ? ROLE_LABELS[pendingToggleUser.role] : ''}.`
        }
        confirmLabel={pendingToggleUser?.isActive ? 'Désactiver' : 'Réactiver'}
        variant={pendingToggleUser?.isActive ? 'danger' : 'primary'}
        isBusy={isToggling}
        onConfirm={handleConfirmToggle}
        onCancel={() => setPendingToggleUser(null)}
      />
    </PageContainer>
  );
};
