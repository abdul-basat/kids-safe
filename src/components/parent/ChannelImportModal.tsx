import { useState, useEffect } from 'react';
import { X, Loader2, ListVideo, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { PlaylistInfo, ChannelInfo } from '../../lib/youtubeApi';

interface ChannelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedPlaylists: PlaylistInfo[]) => void;
    channelInfo: ChannelInfo | null;
    playlists: PlaylistInfo[];
    isLoading: boolean;
}

export function ChannelImportModal({
    isOpen,
    onClose,
    onConfirm,
    channelInfo,
    playlists,
    isLoading,
}: ChannelImportModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [importMode, setImportMode] = useState<'all' | 'select'>('all');

    // Reset selection when playlists change
    useEffect(() => {
        if (playlists.length > 0) {
            // Pre-select all playlists
            setSelectedIds(new Set(playlists.map(p => p.playlistId)));
        }
    }, [playlists]);

    const togglePlaylist = (playlistId: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(playlistId)) {
            newSet.delete(playlistId);
        } else {
            newSet.add(playlistId);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        setSelectedIds(new Set(playlists.map(p => p.playlistId)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleConfirm = () => {
        if (importMode === 'all') {
            onConfirm(playlists);
        } else {
            const selected = playlists.filter(p => selectedIds.has(p.playlistId));
            onConfirm(selected);
        }
    };

    const totalVideos = importMode === 'all'
        ? playlists.reduce((sum, p) => sum + p.itemCount, 0)
        : playlists
            .filter(p => selectedIds.has(p.playlistId))
            .reduce((sum, p) => sum + p.itemCount, 0);

    const selectedCount = importMode === 'all' ? playlists.length : selectedIds.size;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">Import Channel</h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Channel Info */}
                    {channelInfo && (
                        <div className="flex items-center gap-3 mb-4 p-3 bg-sky-50 rounded-xl">
                            {channelInfo.thumbnail && (
                                <img
                                    src={channelInfo.thumbnail}
                                    alt={channelInfo.title}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                            )}
                            <div>
                                <h3 className="font-bold text-gray-800">{channelInfo.title}</h3>
                                <p className="text-sm text-gray-500">{playlists.length} playlists found</p>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                            <span className="ml-3 text-gray-600">Loading playlists...</span>
                        </div>
                    ) : playlists.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <ListVideo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No public playlists found for this channel.</p>
                        </div>
                    ) : (
                        <>
                            {/* Import Mode Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Import Options
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setImportMode('all')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-left transition-all ${importMode === 'all'
                                                ? 'border-sky-500 bg-sky-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="font-semibold text-gray-800">All Playlists</div>
                                        <div className="text-xs text-gray-500">
                                            {playlists.length} playlists, ~{playlists.reduce((s, p) => s + p.itemCount, 0)} videos
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setImportMode('select')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-left transition-all ${importMode === 'select'
                                                ? 'border-sky-500 bg-sky-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="font-semibold text-gray-800">Select Playlists</div>
                                        <div className="text-xs text-gray-500">Choose which to import</div>
                                    </button>
                                </div>
                            </div>

                            {/* Playlist Selection (only when Select mode) */}
                            {importMode === 'select' && (
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            Select Playlists ({selectedIds.size} / {playlists.length})
                                        </span>
                                        <div className="flex gap-2 text-xs">
                                            <button
                                                onClick={selectAll}
                                                className="text-sky-600 hover:text-sky-700"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={deselectAll}
                                                className="text-sky-600 hover:text-sky-700"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>

                                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y">
                                        {playlists.map((playlist) => (
                                            <label
                                                key={playlist.playlistId}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(playlist.playlistId)}
                                                    onChange={() => togglePlaylist(playlist.playlistId)}
                                                    className="w-5 h-5 rounded border-gray-300 text-sky-500 focus:ring-sky-500"
                                                />
                                                {playlist.thumbnail ? (
                                                    <img
                                                        src={playlist.thumbnail}
                                                        alt={playlist.title}
                                                        className="w-10 h-10 rounded object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                                                        <ListVideo className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-800 truncate">
                                                        {playlist.title}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {playlist.itemCount} videos
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* API Warning for large imports */}
                            {totalVideos > 200 && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-800">
                                        <p className="font-medium">Large Import Warning</p>
                                        <p className="text-xs mt-1">
                                            Importing ~{totalVideos} videos will use more API quota. Consider selecting fewer playlists if you're running low on quota.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Summary */}
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <span>
                                        Ready to import <strong>{selectedCount}</strong> playlists with approximately <strong>{totalVideos}</strong> videos
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading || (importMode === 'select' && selectedIds.size === 0)}
                        className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
                    >
                        Import
                    </button>
                </div>
            </div>
        </div>
    );
}
