import React, { useState } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  Check,
  X,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { User, UserRole, PermissionCode } from '../types/auth';

interface RbacViewProps {
  users: User[];
  canManageUsers: boolean;
  onToggleUserActive: (userId: string) => void;
  onCreateUser: (data: { email: string; fullName: string; role: UserRole }) => void;
}

export const RbacView: React.FC<RbacViewProps> = ({
  users,
  canManageUsers,
  onToggleUserActive,
  onCreateUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Analyst');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const permissionMatrix: { code: PermissionCode; label: string; module: string; admin: boolean; analyst: boolean; observer: boolean }[] = [
    { code: 'system:view', label: 'Consulter l’état système et les métriques', module: 'Système', admin: true, analyst: true, observer: true },
    { code: 'system:manage', label: 'Gérer les services et redémarrer les démons', module: 'Système', admin: true, analyst: false, observer: false },
    { code: 'interfaces:view', label: 'Consulter la configuration réseau', module: 'Réseau', admin: true, analyst: true, observer: true },
    { code: 'interfaces:manage', label: 'Assigner et configurer les interfaces de capture', module: 'Réseau', admin: true, analyst: false, observer: false },
    { code: 'users:view', label: 'Consulter l’annuaire des comptes et rôles', module: 'Utilisateurs', admin: true, analyst: true, observer: false },
    { code: 'users:manage', label: 'Créer, éditer ou révoquer des accès', module: 'Utilisateurs', admin: true, analyst: false, observer: false },
    { code: 'audit:view', label: 'Consulter le journal d’audit de sécurité', module: 'Audit', admin: true, analyst: true, observer: false },
    { code: 'storage:manage', label: 'Modifier les politiques de rétention PCAP', module: 'Stockage', admin: true, analyst: false, observer: false },
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (!newEmail || !newFullName) {
        throw new Error('Veuillez renseigner tous les champs obligatoires.');
      }
      onCreateUser({ email: newEmail, fullName: newFullName, role: newRole });
      setIsModalOpen(false);
      setNewEmail('');
      setNewFullName('');
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Contrôle d'Accès Basé sur les Rôles (RBAC)</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Séparation stricte des privilèges : Administrator, Analyst et Observer.
              Toutes les permissions sont validées côté serveur à chaque requête API.
            </p>
          </div>
          {canManageUsers && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Créer un Compte
            </button>
          )}
        </div>
      </div>

      {/* Users Directory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-200">Annuaire des Utilisateurs de la Sonde</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{users.length} comptes actifs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Nom & Identifiant</th>
                <th className="px-4 py-3 font-medium">Rôle Attribué</th>
                <th className="px-4 py-3 font-medium">Dernière Connexion</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">{user.fullName}</div>
                    <div className="font-mono text-slate-400">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded text-xs ${
                        user.role === 'Administrator'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800/40'
                          : user.role === 'Analyst'
                          ? 'bg-sky-950 text-sky-300 border border-sky-800/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        user.isActive
                          ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                          : 'text-slate-400 bg-slate-800'
                      }`}
                    >
                      {user.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManageUsers && user.email !== 'admin@openndr.local' ? (
                      <button
                        onClick={() => onToggleUserActive(user.id)}
                        className="text-xs text-slate-400 hover:text-slate-200 underline font-medium"
                      >
                        {user.isActive ? 'Désactiver' : 'Réactiver'}
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-semibold text-slate-200">Matrice Officielle des Privilèges RBAC</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Droit d'accès par rôle conformément aux exigences de sécurité du cahier des charges
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Code Permission</th>
                <th className="px-4 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-center">Administrator</th>
                <th className="px-4 py-3 font-medium text-center">Analyst</th>
                <th className="px-4 py-3 font-medium text-center">Observer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {permissionMatrix.map((item) => (
                <tr key={item.code} className="hover:bg-slate-850/50">
                  <td className="px-4 py-2.5 font-mono text-emerald-400">{item.code}</td>
                  <td className="px-4 py-2.5 text-slate-400">{item.module}</td>
                  <td className="px-4 py-2.5 text-slate-300">{item.label}</td>
                  <td className="px-4 py-2.5 text-center">
                    {item.admin ? (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {item.analyst ? (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {item.observer ? (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                Nouveau Compte Utilisateur
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Adresse E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="analyste@openndr.local"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nom complet</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont (SOC Analyst)"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Rôle et Niveau de Privilège</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="Administrator">Administrator (Gestion intégrale)</option>
                  <option value="Analyst">Analyst (Investigation & Audit)</option>
                  <option value="Observer">Observer (Lecture seule)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                <span>
                  Un mot de passe temporaire conforme aux exigences de sécurité (Argon2id) sera généré
                  pour ce compte.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                  Créer l'utilisateur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
