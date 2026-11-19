import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Network,
  Users,
  FileText,
  Stethoscope,
  Settings,
  BookOpen,
} from 'lucide-react';
import { PermissionCode } from '../types/auth';

export type NavSectionId =
  | 'dashboard'
  | 'capture'
  | 'interfaces'
  | 'rbac'
  | 'audit'
  | 'diagnostics'
  | 'settings'
  | 'docs';

export interface NavItemConfig {
  id: NavSectionId;
  label: string;
  section: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: PermissionCode;
  requiresAuth?: boolean;
}

export interface NavGroupConfig {
  id: string;
  title: string;
  items: NavItemConfig[];
}

export const NAVIGATION_GROUPS: NavGroupConfig[] = [
  {
    id: 'principal',
    title: 'Principal',
    items: [
      {
        id: 'dashboard',
        label: 'Vue d\'ensemble',
        section: 'Principal',
        description: 'État général du capteur et de ses composants.',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'surveillance',
    title: 'Surveillance',
    items: [
      {
        id: 'capture',
        label: 'Capture réseau',
        section: 'Surveillance',
        description: 'Pilotage de la capture passive, import PCAP et exploration des paquets.',
        icon: Activity,
        requiredPermission: 'system:view',
        requiresAuth: true,
      },
      {
        id: 'interfaces',
        label: 'Interfaces réseau',
        section: 'Surveillance',
        description: 'Configuration et vérification d\'isolation des interfaces réseau.',
        icon: Network,
        requiredPermission: 'interfaces:view',
        requiresAuth: true,
      },
    ],
  },
  {
    id: 'security',
    title: 'Sécurité',
    items: [
      {
        id: 'rbac',
        label: 'Utilisateurs et rôles',
        section: 'Sécurité',
        description: 'Gestion des comptes d\'accès et matrice des autorisations.',
        icon: Users,
        requiredPermission: 'users:view',
        requiresAuth: true,
      },
      {
        id: 'audit',
        label: 'Journal d\'audit',
        section: 'Sécurité',
        description: 'Traçabilité horodatée des actions et événements de sécurité.',
        icon: FileText,
        requiredPermission: 'audit:view',
        requiresAuth: true,
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    items: [
      {
        id: 'diagnostics',
        label: 'État et diagnostics',
        section: 'Administration',
        description: 'Vérification technique des composants système, base et API.',
        icon: Stethoscope,
      },
      {
        id: 'settings',
        label: 'Paramètres système',
        section: 'Administration',
        description: 'Système, mises à jour, affichage, préférences et informations légales.',
        icon: Settings,
      },
      {
        id: 'docs',
        label: 'Documentation',
        section: 'Administration',
        description: 'Architecture, installation Debian 13, API et feuille de route.',
        icon: BookOpen,
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItemConfig[] = NAVIGATION_GROUPS.flatMap((g) => g.items);

export function getNavItemById(id: NavSectionId): NavItemConfig {
  return ALL_NAV_ITEMS.find((item) => item.id === id) || ALL_NAV_ITEMS[0];
}
