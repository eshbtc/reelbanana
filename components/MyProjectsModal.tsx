import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { getCurrentUser } from '../services/authService';
import { listMyProjects, deleteProject, ProjectSummary, renameProject } from '../services/firebaseService';

interface MyProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MyProjectsModal: React.FC<MyProjectsModalProps> = ({ isOpen, onClose }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleOpen = (id: string) => {
    // Reload the app with selected project; editor loads projectId on mount
    window.location.href = `/?projectId=${id}`;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRename = async (id: string, currentTitle: string) => {
    const next = prompt('Rename project', currentTitle);
    if (next == null) return;
    const name = next.trim();
    if (!name) return;
    try {
      await renameProject(id, name);
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, topic: name } : p)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Rename failed');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">My Projects</h2>
        {error && <div className="text-red-400 mb-3">{error}</div>}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-300"><div className="animate-spin h-5 w-5 border-b-2 border-amber-500 rounded-full"/> Loading…</div>
        ) : projects.length === 0 ? (
          <div className="text-gray-400">No projects yet. Create a story to get started!</div>
        ) : (
          <div className="max-h-[60vh] overflow-auto divide-y divide-gray-700">
            {projects.map(p => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{p.topic}</div>
                  <div className="text-xs text-gray-400">Scenes: {p.sceneCount} • Updated: {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'n/a'}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpen(p.id)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded">Open</button>
                  <button onClick={() => handleRename(p.id, p.topic)} className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded">Rename</button>
                  <button disabled={deletingId === p.id} onClick={() => handleDelete(p.id)} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1 rounded">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MyProjectsModal;
