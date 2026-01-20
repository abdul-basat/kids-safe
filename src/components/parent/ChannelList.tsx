import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, Users } from 'lucide-react';
import { getChannels, deleteChannel } from '../../lib/api/channels';
import type { ApprovedChannel } from '../../lib/database.types';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface ChannelListProps {
  onRefresh?: () => void;
}

export function ChannelList({ onRefresh }: ChannelListProps) {
  const [channels, setChannels] = useState<ApprovedChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ApprovedChannel | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await getChannels();
      setChannels(data);
    } catch (err) {
      console.error('Error loading channels:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    await deleteChannel(deleteTarget.id);
    setChannels((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    onRefresh?.();
  }, [deleteTarget, onRefresh]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Channels Yet</h3>
        <p className="text-gray-500">Add channels to import their playlists.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.channel_title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-800 truncate">
                  {channel.channel_title}
                </h4>
                <p className="text-sm text-gray-500 truncate">
                  {channel.auto_approve ? 'Auto-imported playlists' : 'Approved channel'}
                </p>
              </div>

              <button
                onClick={() => setDeleteTarget(channel)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Delete channel"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Channel"
        itemName={deleteTarget?.channel_title || ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
