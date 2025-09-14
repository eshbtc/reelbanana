import React, { useEffect, useState } from 'react';
import { addComment, listComments } from '../services/firebaseService';

interface CommentsPanelProps {
  projectId: string;
  sceneId?: string | null;
  open: boolean;
  onClose: () => void;
}

const CommentsPanel: React.FC<CommentsPanelProps> = ({ projectId, sceneId, open, onClose }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');

  const load = async () => {
    setLoading(true);
    try { setComments(await listComments(projectId, sceneId || undefined)); } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open, projectId, sceneId]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">Comments</h3>
            <p className="text-xs text-gray-400">{sceneId ? `Scene: ${sceneId}` : 'Project‑wide'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <input value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment…" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
            <button
              onClick={async () => { if (!text.trim()) return; await addComment(projectId, sceneId || undefined, text.trim()); setText(''); await load(); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >Post</button>
          </div>
          {loading && <div className="text-gray-300 text-sm">Loading…</div>}
          <div className="space-y-2">
            {comments.map(c => (
              <div key={c.id} className="border border-gray-700 rounded p-2 bg-gray-800 text-sm text-gray-200">
                <div className="text-xs text-gray-400 mb-1">{c.userId} • {(c.createdAt && c.createdAt.toDate) ? c.createdAt.toDate().toLocaleString() : ''}</div>
                <div>{c.content}</div>
              </div>
            ))}
            {!loading && comments.length === 0 && <div className="text-gray-500 text-sm">No comments yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentsPanel;

