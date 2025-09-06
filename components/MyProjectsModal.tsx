import React, { useEffect, useState } from 'react';
import { useConfirm } from './ConfirmProvider';
import { useToast } from './ToastProvider';
import Modal from './Modal';
import { getCurrentUser } from '../services/authService';
import { listMyProjects, deleteProject, ProjectSummary, renameProject, duplicateProject } from '../services/firebaseService';

interface MyProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MyProjectsModal: React.FC<MyProjectsModalProps> = ({ isOpen, onClose }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [filtered, setFiltered] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const { toast } = useToast();

  const load = async () => {
    const user = getCurrentUser();
    if (!user) {
      setError('Please sign in to view your projects.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await listMyProjects(user.uid, 30);
      setProjects(items);
      setFiltered(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (!filtered.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && focusedIndex >= 0) handleOpen(filtered[focusedIndex].id);
      if ((e.key === 'Delete' || e.key === 'Backspace') && focusedIndex >= 0) setConfirmDeleteId(filtered[focusedIndex].id);
      if (e.key === 'F2' && focusedIndex >= 0) startRename(filtered[focusedIndex].id, filtered[focusedIndex].topic);
      if (e.key.toLowerCase() === 'd' && focusedIndex >= 0) handleDuplicate(filtered[focusedIndex].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, filtered, focusedIndex]);

  const handleOpen = (id: string) => {
    // Reload the app with selected project; editor loads projectId on mount
    window.location.href = `/?projectId=${id}`;
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      setFiltered(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const startRename = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameText(currentTitle);
  };

  const saveRename = async (id: string) => {
    const name = renameText.trim();
    if (!name) { setRenamingId(null); return; }
    try {
      await renameProject(id, name);
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, topic: name } : p)));
      setFiltered(prev => prev.map(p => (p.id === id ? { ...p, topic: name } : p)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rename failed');
    } finally {
      setRenamingId(null);
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameText('');
  };

  const applyFilter = (value: string) => {
    setFilterText(value);
    const v = value.toLowerCase();
    setFiltered(projects.filter(p => (p.topic || '').toLowerCase().includes(v)));
    setFocusedIndex(-1);
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try {
      await duplicateProject(id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDuplicateAndOpen = async (id: string) => {
    setDuplicatingId(id);
    try {
      const newId = await duplicateProject(id);
      window.location.href = `/?projectId=${newId}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setDuplicatingId(null);
    }
  };

  const formatRelative = (iso?: string) => {
    if (!iso) return 'n/a';
    try {
      const d = new Date(iso);
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    } catch {
      return 'n/a';
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const confirm = useConfirm();
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: 'Delete Projects?',
      message: `Delete ${selectedIds.size} selected project(s)? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    for (const id of Array.from(selectedIds)) {
      await handleDelete(id);
    }
    setSelectedIds(new Set());
  };

  const bulkDuplicate = async () => {
    if (selectedIds.size === 0) return;
    for (const id of Array.from(selectedIds)) {
      await handleDuplicate(id);
    }
    setSelectedIds(new Set());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} panelClassName="bg-gray-850 bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl p-0 border border-gray-700">
      <div className="text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold">My Projects</h2>
            <p className="text-xs text-gray-400">Browse, rename, open or delete your saved projects</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/40 flex items-center gap-3">
          <input
            type="text"
            value={filterText}
            onChange={(e) => applyFilter(e.target.value)}
            placeholder="Search by title..."
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-amber-500 focus:border-amber-500"
          />
          <button onClick={load} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">Refresh</button>
          {filtered.length > 0 && (
            <>
              <button onClick={toggleSelectAll} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
                {selectedIds.size === filtered.length ? 'Clear All' : 'Select All'}
              </button>
              <button disabled={selectedIds.size === 0} onClick={bulkDuplicate} className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded text-sm">Duplicate Selected</button>
              <button disabled={selectedIds.size === 0} onClick={bulkDelete} className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded text-sm">Delete Selected</button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-auto divide-y divide-gray-800">
          {error && (
            <div className="px-6 py-3 bg-red-900/30 text-red-300 border-b border-red-700">{error}</div>
          )}
          {loading ? (
            <div className="px-6 py-6 text-gray-300 flex items-center gap-2">
              <div className="animate-spin h-5 w-5 border-b-2 border-amber-500 rounded-full"/> Loading projects…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">No projects found. Create a story to get started!</div>
          ) : (
            filtered.map((p, idx) => (
              <div key={p.id} className={`group px-6 py-4 flex items-center justify-between hover:bg-gray-900/30 transition-colors ${focusedIndex === idx ? 'bg-gray-900/40' : ''}`}>
                <div className="min-w-0 flex items-center gap-3">
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-amber-500" />
                  {/* Thumbnail mosaic */}
                  {p.thumbs && p.thumbs.length > 0 ? (
                    <div className="w-20 h-12 grid grid-cols-2 gap-[2px]">
                      {p.thumbs.slice(0, 3).map((t, i) => (
                        <img
                          key={i}
                          src={t}
                          alt="thumb"
                          className={`object-cover rounded border border-gray-700 transition-transform group-hover:scale-[1.03] ${i === 2 ? 'col-span-2' : ''}`}
                        />
                      ))}
                    </div>
                  ) : p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt="thumb" className="w-20 h-12 object-cover rounded border border-gray-700 transition-transform group-hover:scale-[1.03]" />
                  ) : null}
                  {renamingId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:ring-amber-500 focus:border-amber-500 w-64"
                      />
                      <button onClick={() => saveRename(p.id)} className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded">Save</button>
                      <button onClick={cancelRename} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded">Cancel</button>
                    </div>
                  ) : (
                    <div className="truncate font-semibold">{p.topic}</div>
                  )}
                  <div className="text-xs text-gray-500">Scenes: {p.sceneCount} • Updated: {formatRelative(p.updatedAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpen(p.id)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-sm">Open</button>
                  {renamingId === p.id ? null : (
                    <button onClick={() => startRename(p.id, p.topic)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm">Rename</button>
                  )}
                  <button disabled={duplicatingId === p.id} onClick={() => handleDuplicate(p.id)} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1 rounded text-sm">{duplicatingId === p.id ? 'Duplicating…' : 'Duplicate'}</button>
                  <button disabled={duplicatingId === p.id} onClick={() => handleDuplicateAndOpen(p.id)} className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1 rounded text-sm">{duplicatingId === p.id ? 'Opening…' : 'Duplicate & Open'}</button>
                  {confirmDeleteId === p.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300">Delete?</span>
                      <button disabled={deletingId === p.id} onClick={() => handleDelete(p.id)} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-2 py-1 rounded text-xs">Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(p.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm">Delete</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MyProjectsModal;
