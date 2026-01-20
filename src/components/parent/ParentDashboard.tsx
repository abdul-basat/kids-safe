import { useState, useCallback, useEffect } from 'react';
import {
  Video,
  Users,
  ListVideo,
  Settings,
  Plus,
  LogOut,
  Shield,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VideoList } from './VideoList';
import { ChannelList } from './ChannelList';
import { PlaylistManager } from './PlaylistManager';
import { AddContentModal } from './AddContentModal';
import { SettingsPanel } from './SettingsPanel';

type Tab = 'videos' | 'channels' | 'playlists' | 'settings';

export function ParentDashboard() {
  const { exitParentMode, refreshData } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('videos');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAddModalOpen) {
        exitParentMode();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [exitParentMode, isAddModalOpen]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    refreshData();
  }, [refreshData]);

  const tabs = [
    { id: 'videos' as Tab, label: 'Videos', icon: Video },
    { id: 'channels' as Tab, label: 'Channels', icon: Users },
    { id: 'playlists' as Tab, label: 'Playlists', icon: ListVideo },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h1 className="font-bold text-gray-800">Parent Dashboard</h1>
                <p className="text-xs text-gray-500">Manage your child's content</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeTab !== 'settings' && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Add Content</span>
                </button>
              )}

              <button
                onClick={exitParentMode}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>

          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.id
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'videos' && (
          <VideoList key={`videos-${refreshKey}`} onRefresh={handleRefresh} />
        )}
        {activeTab === 'channels' && (
          <ChannelList key={`channels-${refreshKey}`} onRefresh={handleRefresh} />
        )}
        {activeTab === 'playlists' && (
          <PlaylistManager key={`playlists-${refreshKey}`} onRefresh={handleRefresh} />
        )}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>

      <AddContentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
