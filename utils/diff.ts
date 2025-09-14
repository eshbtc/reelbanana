import type { Scene } from '../types';

export type ProjectSnapshot = {
  topic: string;
  characterAndStyle: string;
  scenes: Scene[];
  characterRefs?: string[];
};

export type SceneFieldDiff = Partial<Record<keyof Scene, { before: any; after: any }>>;
export type ScenesDiff = {
  added: Scene[];
  removed: Scene[];
  changed: Array<{ id: string; index: number; fields: SceneFieldDiff }>;
};

export type ProjectDiff = {
  topic?: { before: string; after: string };
  characterAndStyle?: { before: string; after: string };
  characterRefs?: { before: string[] | undefined; after: string[] | undefined };
  scenes: ScenesDiff;
};

export function computeProjectDiff(prev: ProjectSnapshot, curr: ProjectSnapshot): ProjectDiff {
  const diff: ProjectDiff = { scenes: { added: [], removed: [], changed: [] } } as any;

  if ((prev.topic || '') !== (curr.topic || '')) diff.topic = { before: prev.topic || '', after: curr.topic || '' };
  if ((prev.characterAndStyle || '') !== (curr.characterAndStyle || '')) diff.characterAndStyle = { before: prev.characterAndStyle || '', after: curr.characterAndStyle || '' };
  const prevRefs = prev.characterRefs || [];
  const currRefs = curr.characterRefs || [];
  if (JSON.stringify(prevRefs) !== JSON.stringify(currRefs)) diff.characterRefs = { before: prev.characterRefs, after: curr.characterRefs };

  // Scenes diff by index and id
  const prevById = new Map(prev.scenes.map((s, i) => [s.id, { s, i }]));
  const currById = new Map(curr.scenes.map((s, i) => [s.id, { s, i }]));

  // Added
  for (const [id, { s }] of currById.entries()) {
    if (!prevById.has(id)) diff.scenes.added.push(s);
  }
  // Removed
  for (const [id, { s }] of prevById.entries()) {
    if (!currById.has(id)) diff.scenes.removed.push(s);
  }
  // Changed
  for (const [id, { s: currScene, i }] of currById.entries()) {
    const prevEntry = prevById.get(id);
    if (!prevEntry) continue;
    const prevScene = prevEntry.s;
    const fields: SceneFieldDiff = {};
    const keys: (keyof Scene)[] = ['prompt','narration','camera','transition','duration','backgroundImage','stylePreset','voiceId','voiceName','videoModel','sceneDirection','location'];
    for (const k of keys) {
      if (JSON.stringify((prevScene as any)[k]) !== JSON.stringify((currScene as any)[k])) {
        (fields as any)[k] = { before: (prevScene as any)[k], after: (currScene as any)[k] };
      }
    }
    if (Object.keys(fields).length) diff.scenes.changed.push({ id, index: i, fields });
  }
  return diff;
}

export function isMeaningfulDiff(d: ProjectDiff): boolean {
  if (d.topic || d.characterAndStyle) return true;
  if (d.scenes.added.length || d.scenes.removed.length || d.scenes.changed.length) return true;
  if (d.characterRefs && JSON.stringify(d.characterRefs.before) !== JSON.stringify(d.characterRefs.after)) return true;
  return false;
}

