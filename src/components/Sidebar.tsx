import React, { useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
} from 'lucide-react';
import { NAVIGATION_GROUPS, NavSectionId } from '../config/navigation';
import { User } from '../types/auth';
import { AppLogo } from './AppLogo';

interface SidebarProps {
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  currentUser: User | null;
  platformVersion: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  hasInterfaceViolation: boolean;
  updateAvailable: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  currentUser,
  platformVersion,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  hasInterfaceViolation,
  updateAvailable,
}) => {
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const isItemVisible = (item: (typeof NAVIGATION_GROUPS)[number]['items'][number]) => {
    if (item.requiresAuth && !currentUser) return false;
    if (item.requiredPermission) {
      return Boolean(currentUser?.permissions.includes(item.requiredPermission));
    }
    return true;
  };

  const handleSelect = (id: NavSectionId) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const renderNavContent = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;

    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#181b20] border-r border-gray-200 dark:border-[#2c313a]">
        {/* Brand Identity */}
        <div
          className={`h-14 px-3.5 border-b border-gray-200 dark:border-[#2c313a] flex items-center justify-between shrink-0 ${
            isCompact ? 'justify-center px-2' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AppLogo className="w-7 h-7 shrink-0" />
            {!isCompact && (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                  OpenNDR
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">
                  {platformVersion ? `v${platformVersion}` : 'Console NDR'}
                </div>
              </div>
            )}
          </div>

          {isMobileDrawer && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fermer le menu latéral"
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#1f2329]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          aria-label="Navigation principale"
          className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5"
        >
          {NAVIGATION_GROUPS.map((group) => {
            const visibleItems = group.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-1">
                {!isCompact ? (
                  <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {group.title}
                  </div>
                ) : (
                  <div className="border-t border-gray-200 dark:border-[#2c313a] mx-2 my-1" />
                )}

                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    const showInterfaceAlert = item.id === 'interfaces' && hasInterfaceViolation;
                    const showUpdateAlert = item.id === 'settings' && updateAvailable;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          title={isCompact ? item.label : undefined}
                          className={`w-full flex items-center gap-2.5 rounded-md text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            isCompact ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2'
                          } ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1f2329] hover:text-gray-900 dark:hover:text-gray-100'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          />
                          {!isCompact && (
                            <span className="flex-1 text-left truncate">{item.label}</span>
                          )}
                          {!isCompact && showInterfaceAlert && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 dark:text-red-400"
                              title="Non-conformité d'isolation détectée"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {!isCompact && showUpdateAlert && (
                            <span
                              className="text-[10px] font-medium text-blue-700 dark:text-blue-300"
                              title="Mise à jour disponible"
                            >
                              MAJ
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Desktop Collapse Toggle */}
        {!isMobileDrawer && (
          <div className="p-2.5 border-t border-gray-200 dark:border-[#2c313a] shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Déplier le menu latéral' : 'Réduire le menu latéral'}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1f2329] hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 shrink-0" />
                  <span>Réduire le menu</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-150 ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderNavContent(false)}</div>
      </aside>

      {/* Mobile / Tablet Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation OpenNDR"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full shadow-xl">
            {renderNavContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
