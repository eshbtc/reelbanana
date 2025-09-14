import React, { useEffect, useState } from 'react';
import { listProjectVersions, rollbackProjectToVersion } from '../services/firebaseService';

interface HistoryPanelProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onJumpScene?: (index: number) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ projectId, open, onClose, onJumpScene }) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try { setLoading(true); setError(null); setVersions(await listProjectVersions(projectId, 25)); }
      catch (e) { setError(e instanceof Error ? e.message : 'Failed to load history'); }
      finally { setLoading(false); }
    })();
  }, [open, projectId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">Version History</h3>
            <p className="text-xs text-gray-400">Project: {projectId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4">
          {loading && <div className="text-gray-300">Loading…</div>}
          {error && <div className="text-red-400">{error}</div>}
          {!loading && versions.length === 0 && <div className="text-gray-400 text-sm">No versions yet.</div>}
          <div className="space-y-3">
            {versions.map(v => (
              <div key={v.id} className="border border-gray-700 rounded p-3 bg-gray-800">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-200">
                    <div className="font-semibold">{v.reason || 'autosave'}</div>
                    <div className="text-xs text-gray-400">By {v.authorId || 'unknown'} • {(v.createdAt && v.createdAt.toDate) ? v.createdAt.toDate().toLocaleString() : 'pending'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => { try { await rollbackProjectToVersion(projectId, v.id); window.location.reload(); } catch (e) { alert('Rollback failed'); } }}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                    >Rollback</button>
                    <button
                      onClick={async () => {
                        try {
                          const { createProjectFromSnapshot } = await import('../services/firebaseService');
                          const newId = await createProjectFromSnapshot(v.snapshot as any, `${(v.snapshot?.topic || 'Project')} (Copy)`);
                          window.location.href = `/?projectId=${newId}`;
                        } catch (e) { alert('Restore as copy failed'); }
                      }}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded"
                    >Restore as Copy</button>
                  </div>
                </div>
                {!!v.diff && (
                  <details className="mt-2 text-xs text-gray-300">
                    <summary className="cursor-pointer text-gray-200">Changes • Scenes: +{v.diff.scenes?.added?.length || 0} / −{v.diff.scenes?.removed?.length || 0} / △{v.diff.scenes?.changed?.length || 0}</summary>
                    <div className="mt-2 space-y-1">
                      {v.diff.topic && <div>Topic: <span className="text-gray-400 line-through">{v.diff.topic.before}</span> → <span className="text-amber-300">{v.diff.topic.after}</span></div>}
                      {v.diff.characterAndStyle && <div>Style: <span className="text-gray-400 line-through">{v.diff.characterAndStyle.before}</span> → <span className="text-amber-300">{v.diff.characterAndStyle.after}</span></div>}
                      {Array.isArray(v.diff.scenes?.added) && v.diff.scenes.added.length > 0 && (
                        <div className="text-green-300">Added: {v.diff.scenes.added.map((s:any)=>s.prompt?.slice(0,30) || s.id).join('; ')}</div>
                      )}
                      {Array.isArray(v.diff.scenes?.removed) && v.diff.scenes.removed.length > 0 && (
                        <div className="text-red-300">Removed: {v.diff.scenes.removed.map((s:any)=>s.prompt?.slice(0,30) || s.id).join('; ')}</div>
                      )}
                      {Array.isArray(v.diff.scenes?.changed) && v.diff.scenes.changed.length > 0 && (
                        <div className="text-amber-300">
                          Changed:
                          <ul className="list-disc ml-4 mt-1">
                            {v.diff.scenes.changed.slice(0,5).map((c:any, idx:number)=> (
                              <li key={idx} className="flex items-center justify-between">
                                <span>Scene {c.index+1}: {Object.keys(c.fields).join(', ')}</span>
                                {onJumpScene && (
                                  <button onClick={() => onJumpScene(c.index)} className="ml-2 text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded">Focus</button>
                                )}
                              </li>
                            ))}
                            {v.diff.scenes.changed.length > 5 && <li className="text-gray-400">…and {v.diff.scenes.changed.length - 5} more</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
