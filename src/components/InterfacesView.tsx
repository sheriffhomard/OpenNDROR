import React, { useState, useEffect } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import { NetworkInterfaceConfig } from '../types/system';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  DataTable,
} from './ui';

interface InterfacesViewProps {
  interfaces: NetworkInterfaceConfig[];
  interfacesError: string | null;
  onRefresh: () => Promise<void>;
}

export const InterfacesView: React.FC<InterfacesViewProps> = ({
  interfaces,
  interfacesError,
  onRefresh,
}) => {
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    if (interfaces.length === 0) {
      setSelectedName(null);
      return;
    }
    if (!selectedName || !interfaces.some((i) => i.name === selectedName)) {
      const passive = interfaces.find((i) => i.role === 'CAPTURE_PASSIVE');
      setSelectedName((passive || interfaces[0]).name);
    }
  }, [interfaces, selectedName]);

  const adminIface = interfaces.find((i) => i.role === 'ADMINISTRATION') || null;
  const passiveIface = interfaces.find((i) => i.role === 'CAPTURE_PASSIVE') || null;
  const selectedIface = interfaces.find((i) => i.name === selectedName) || null;

  return (
    <PageContainer>
      <PageHeader
        title="Interfaces réseau"
        description="Séparation entre l'interface d'administration et l'interface de capture passive."
        actions={
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualiser</span>
          </button>
        }
      />

      {interfacesError && <ErrorState message={interfacesError} onRetry={onRefresh} />}

      {interfaces.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="Aucune interface réseau disponible"
            description="Aucune interface n'a été retournée par le serveur. Vérifiez votre connexion ou les droits d'accès."
          />
        </SectionCard>
      ) : (
        <>
          {/* Two primary role summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard
              title="Interface d'administration"
              description="Port dédié à l'accès HTTPS et à l'API REST"
              actions={
                <StatusBadge
                  state={
                    !adminIface
                      ? 'unconfigured'
                      : adminIface.isUp
                      ? 'operational'
                      : 'stopped'
                  }
                />
              }
            >
              {!adminIface ? (
                <EmptyState
                  title="Non configurée"
                  description="Aucune interface avec le rôle ADMINISTRATION n'a été détectée par le backend."
                />
              ) : (
                <dl className="divide-y divide-gray-200 dark:divide-[#2c313a] text-xs">
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Nom système</dt>
                    <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">{adminIface.name}</dd>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Adresse IP</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">{adminIface.ipAddress || 'Aucune'}</dd>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Adresse MAC</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">{adminIface.macAddress}</dd>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">État du lien / MTU</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">
                      {adminIface.isUp ? 'UP' : 'DOWN'} · {adminIface.mtu} octets
                    </dd>
                  </div>
                </dl>
              )}
            </SectionCard>

            <SectionCard
              title="Interface de capture passive"
              description="Port d'écoute SPAN/TAP devant rester sans adresse IP"
              actions={
                <StatusBadge
                  state={
                    !passiveIface
                      ? 'unconfigured'
                      : !passiveIface.isStealthCompliant
                      ? 'degraded'
                      : passiveIface.isUp
                      ? 'operational'
                      : 'stopped'
                  }
                  label={
                    !passiveIface
                      ? 'Non configuré'
                      : !passiveIface.isStealthCompliant
                      ? 'Non conforme'
                      : 'Conforme'
                  }
                />
              }
            >
              {!passiveIface ? (
                <EmptyState
                  title="Non configurée"
                  description="Aucune interface avec le rôle CAPTURE_PASSIVE n'est actuellement configurée sur cet hôte."
                />
              ) : (
                <dl className="divide-y divide-gray-200 dark:divide-[#2c313a] text-xs">
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Nom système</dt>
                    <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">{passiveIface.name}</dd>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Adresse IP détectée</dt>
                    <dd
                      className={`font-mono font-medium ${
                        passiveIface.ipAddress
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {passiveIface.ipAddress || 'Aucune (conforme)'}
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Mode promiscuous</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">
                      {passiveIface.isPromiscuous ? 'Activé' : 'Désactivé'}
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Observation</dt>
                    <dd className="text-gray-700 dark:text-gray-300 text-right">
                      {passiveIface.complianceReason}
                    </dd>
                  </div>
                </dl>
              )}
            </SectionCard>
          </div>

          {/* Complete Interfaces Table */}
          <SectionCard
            title="Inventaire des interfaces détectées"
            description="Cliquez sur une ligne pour consulter ses propriétés techniques et les paramètres sysctl associés"
            noPadding
          >
            <DataTable>
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318] text-gray-500 dark:text-gray-400">
                  <th className="py-2.5 px-4 font-medium">Interface</th>
                  <th className="py-2.5 px-4 font-medium">Rôle</th>
                  <th className="py-2.5 px-4 font-medium">Adresse IP</th>
                  <th className="py-2.5 px-4 font-medium">Adresse MAC</th>
                  <th className="py-2.5 px-4 font-medium">MTU</th>
                  <th className="py-2.5 px-4 font-medium">Débit lien</th>
                  <th className="py-2.5 px-4 font-medium">Pertes RX</th>
                  <th className="py-2.5 px-4 font-medium">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#2c313a] tabular-nums">
                {interfaces.map((iface) => {
                  const isSelected = selectedIface?.name === iface.name;
                  return (
                    <tr
                      key={iface.name}
                      onClick={() => setSelectedName(iface.name)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-gray-50 dark:hover:bg-[#1f2329]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-medium text-gray-900 dark:text-gray-100">
                        {iface.name}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {iface.role}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {iface.ipAddress || 'Aucune'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-600 dark:text-gray-400">
                        {iface.macAddress}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {iface.mtu}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {iface.speedMbps >= 1000 ? `${iface.speedMbps / 1000} Gbps` : `${iface.speedMbps} Mbps`}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {iface.rxDropped}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusBadge
                          state={
                            iface.role === 'CAPTURE_PASSIVE' && !iface.isStealthCompliant
                              ? 'degraded'
                              : iface.isUp
                              ? 'operational'
                              : 'stopped'
                          }
                          label={
                            iface.role === 'CAPTURE_PASSIVE' && !iface.isStealthCompliant
                              ? 'Non conforme'
                              : iface.isUp
                              ? 'Actif'
                              : 'Inactif'
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </SectionCard>

          {/* Technical hardening instructions for selected passive interface */}
          {selectedIface && selectedIface.role === 'CAPTURE_PASSIVE' && (
            <SectionCard
              title={
                <span className="inline-flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-gray-500" />
                  <span>Durcissement noyau recommandé sur Debian 13 ({selectedIface.name})</span>
                </span>
              }
              description="Commandes sysctl et iproute2 permettant de garantir l'absence totale d'émission sur le port de capture"
            >
              <pre className="font-mono text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-[#111318] p-4 rounded-md border border-gray-200 dark:border-[#2c313a] overflow-x-auto leading-relaxed">
{`net.ipv4.conf.${selectedIface.name}.arp_ignore = 8
net.ipv4.conf.${selectedIface.name}.arp_announce = 2
net.ipv6.conf.${selectedIface.name}.disable_ipv6 = 1
ip link set ${selectedIface.name} promisc on arp off up`}
              </pre>
            </SectionCard>
          )}
        </>
      )}
    </PageContainer>
  );
};
