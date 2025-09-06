import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '../services/authService';
import { listMyProjects, deleteProject, ProjectSummary, renameProject, duplicateProject } from '../services/firebaseService';

const MyProjectsPage: React.FC = () => {
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

  const load = async () => {
    const user = getCurrentUser();
    if (!user) {
      setError('Please sign in to view your projects.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userProjects = await listMyProjects(user.uid, 50);
      setProjects(userProjects);
      setFiltered(userProjects);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!filtered.length) return;
      if (e.key === 'ArrowDown') { 
        e.preventDefault(); 
        setFocusedIndex(i => Math.min(i + 1, filtered.length - 1)); 
      }
      if (e.key === 'ArrowUp') { 
        e.preventDefault(); 
        setFocusedIndex(i => Math.max(i - 1, 0)); 
      }
      if (e.key === 'Enter' && focusedIndex >= 0) handleOpen(filtered[focusedIndex].id);
      if ((e.key === 'Delete' || e.key === 'Backspace') && focusedIndex >= 0) setConfirmDeleteId(filtered[focusedIndex].id);
      if (e.key === 'F2' && focusedIndex >= 0) startRename(filtered[focusedIndex].id, filtered[focusedIndex].topic);
      if (e.key.toLowerCase() === 'd' && focusedIndex >= 0) handleDuplicate(filtered[focusedIndex].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, focusedIndex]);

  const handleOpen = (id: string) => {
    // Reload the app with selected project; editor loads projectId on mount
    window.location.href = `/?projectId=${id}`;
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProject(id);
      await load(); // Reload the list
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project. Please try again.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleRename = async (id: string, newTopic: string) => {
    if (!newTopic.trim()) return;
    try {
      await renameProject(id, newTopic.trim());
      await load(); // Reload the list
    } catch (err) {
      console.error('Error renaming project:', err);
      setError('Failed to rename project. Please try again.');
    } finally {
      setRenamingId(null);
      setRenameText('');
    }
  };

  const startRename = (id: string, currentTopic: string) => {
    setRenamingId(id);
    setRenameText(currentTopic);
  };

  const handleFilter = (value: string) => {
    setFilterText(value);
    const v = value.toLowerCase();
    setFiltered(projects.filter(p => (p.topic || '').toLowerCase().includes(v)));
    setFocusedIndex(-1);
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try {
      await duplicateProject(id);
      await load(); // Reload the list
    } catch (err) {
      console.error('Error duplicating project:', err);
      setError('Failed to duplicate project. Please try again.');
    } finally {
      setDuplicatingId(null);
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

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected project(s)?`)) return;
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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Projects</h1>
            <p className="text-gray-400 mt-1">Manage your AI-generated stories and movies</p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors duration-200"
          >
            ← Back to Home
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">⚠️</div>
              <div>
                <h3 className="font-medium text-red-200">Error</h3>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by title..."
            value={filterText}
            onChange={(e) => handleFilter(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-amber-500 focus:border-amber-500"
          />
          <button onClick={load} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
            Refresh
          </button>

          {filtered.length > 0 && (
            <>
              <button onClick={toggleSelectAll} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
                {selectedIds.size === filtered.length ? 'Clear All' : 'Select All'}
              </button>
              <button disabled={selectedIds.size === 0} onClick={bulkDuplicate} className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded text-sm">
                Duplicate Selected
              </button>
              <button disabled={selectedIds.size === 0} onClick={bulkDelete} className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded text-sm">
                Delete Selected
              </button>
            </>
          )}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
              <p className="text-gray-300 mt-4 text-lg">Loading your projects...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 text-lg mb-4">
              {projects.length === 0 ? 'No projects found. Create a story to get started!' : 'No projects match your search.'}
            </div>
            {projects.length === 0 && (
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors duration-200"
              >
                Create Your First Story
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p, idx) => (
              <div key={p.id} className={`group bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-all duration-200 ${focusedIndex === idx ? 'ring-2 ring-amber-500' : ''}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(p.id)} 
                        onChange={() => toggleSelect(p.id)} 
                        className="accent-amber-500" 
                      />
                      <span className="text-xs text-gray-400">{p.sceneCount} scenes</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startRename(p.id, p.topic)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Rename (F2)"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDuplicate(p.id)}
                        disabled={duplicatingId === p.id}
                        className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Duplicate (D)"
                      >
                        {duplicatingId === p.id ? '⏳' : '📋'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete (Del)"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail */}
                  {p.thumbnailUrl && (
                    <div className="mb-3">
                      <img 
                        src={p.thumbnailUrl} 
                        alt="Project thumbnail" 
                        className="w-full h-32 object-cover rounded border border-gray-700 transition-transform group-hover:scale-105" 
                      />
                    </div>
                  )}

                  {/* Project Info */}
                  <div className="mb-4">
                    {renamingId === p.id ? (
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={() => handleRename(p.id, renameText)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(p.id, renameText);
                          if (e.key === 'Escape') { setRenamingId(null); setRenameText(''); }
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:ring-amber-500 focus:border-amber-500"
                        autoFocus
                      />
                    ) : (
                      <h3 className="font-medium text-white mb-1 line-clamp-2">{p.topic}</h3>
                    )}
                    <p className="text-xs text-gray-400">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Recently created'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpen(p.id)}
                      className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm transition-colors duration-200"
                    >
                      Open Project
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Keyboard Shortcuts Help */}
        <div className="mt-12 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
            <div><kbd className="bg-gray-700 px-1 rounded">↑↓</kbd> Navigate</div>
            <div><kbd className="bg-gray-700 px-1 rounded">Enter</kbd> Open</div>
            <div><kbd className="bg-gray-700 px-1 rounded">F2</kbd> Rename</div>
            <div><kbd className="bg-gray-700 px-1 rounded">D</kbd> Duplicate</div>
            <div><kbd className="bg-gray-700 px-1 rounded">Del</kbd> Delete</div>
            <div><kbd className="bg-gray-700 px-1 rounded">Space</kbd> Select</div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-4 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-2">Delete Project</h3>
            <p className="text-gray-300 mb-4">Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDeleteId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProjectsPage;
