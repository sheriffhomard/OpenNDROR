-- Données initiales : Rôles et Permissions V0.1

INSERT INTO roles (id, name, description) VALUES
(1, 'Administrator', 'Administration complète du système, gestion des utilisateurs, interfaces et politiques'),
(2, 'Analyst', 'Investigation de sécurité, consultation des journaux, métriques et alertes'),
(3, 'Observer', 'Consultation en lecture seule des indicateurs de la plateforme')
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions (id, code, description, module) VALUES
(1, 'system:view', 'Consulter l''état général et les métriques de la sonde', 'system'),
(2, 'system:manage', 'Configurer les paramètres système et services', 'system'),
(3, 'interfaces:view', 'Voir la configuration des interfaces réseau', 'network'),
(4, 'interfaces:manage', 'Valider et assigner les interfaces de capture/admin', 'network'),
(5, 'users:view', 'Consulter la liste des comptes utilisateurs', 'users'),
(6, 'users:manage', 'Créer, modifier ou désactiver des utilisateurs', 'users'),
(7, 'audit:view', 'Consulter le journal d''audit de sécurité', 'audit'),
(8, 'storage:manage', 'Gérer les quotas et la rétention des captures PCAP', 'storage')
ON CONFLICT (id) DO NOTHING;

-- Rôle Administrator : toutes les permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8)
ON CONFLICT DO NOTHING;

-- Rôle Analyst : permissions d'investigation et consultation
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1), (2, 3), (2, 5), (2, 7)
ON CONFLICT DO NOTHING;

-- Rôle Observer : consultation élémentaire
INSERT INTO role_permissions (role_id, permission_id) VALUES
(3, 1), (3, 3)
ON CONFLICT DO NOTHING;
