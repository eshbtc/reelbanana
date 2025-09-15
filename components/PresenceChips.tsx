import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';

interface PresenceChipsProps {
  projectId: string;
}

const PresenceChips: React.FC<PresenceChipsProps> = ({ projectId }) => {
  const [people, setPeople] = useState<Array<{ userId: string; activeSceneId?: string | null }>>([]);
  useEffect(() => {
    const db = getFirestore(firebaseApp);
    const col = collection(db, 'presence');
    const qref = query(col, where('projectId','==', projectId), orderBy('lastSeen','desc'), limit(10));
    const unsub = onSnapshot(qref, (snap) => {
      const arr: any[] = [];
      snap.forEach(d => { const x: any = d.data(); arr.push({ userId: x.userId, activeSceneId: x.activeSceneId || null }); });
      setPeople(arr);
    }, (err: any) => {
      if (err?.code === 'permission-denied') {
        console.warn('Presence listener permission denied; hiding presence UI');
        setPeople([]);
      } else {
        console.error('Presence listener error:', err);
      }
    });
    return () => unsub();
  }, [projectId]);
  if (!people.length) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <div className="flex -space-x-2">
        {people.slice(0,5).map(p => (
          <div key={p.userId} className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center ring-2 ring-gray-900" title={p.userId}>
            {p.userId.slice(0,2).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-gray-400">{people.length} online</span>
    </div>
  );
};

export default PresenceChips;
