// Firebase service using centralized Firebase app
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    addDoc,
    collection,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit as fsLimit,
    getDocs,
    deleteDoc,
    updateDoc
} from 'firebase/firestore';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import { Scene } from '../types';
import { firebaseApp } from '../lib/firebase';
import { getCurrentUser } from './authService';

// Use centralized Firebase app for consistency and App Check
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const PROJECTS_COLLECTION = 'projects';

interface ProjectData {
    topic: string;
    characterAndStyle: string;
    scenes: Scene[];
    characterRefs?: string[];
    characterOption?: {
        id: string;
        name: string;
        description: string;
        images: string[];
    };
}

/**
 * Creates a new project document in Firestore.
 * @param data The initial project data.
 * @returns The ID of the newly created project.
 */
export const createProject = async (data: ProjectData): Promise<string> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error("User must be authenticated to create projects");
        }

        const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
            ...data,
            userId: currentUser.uid, // Add userId for security rules
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating project in Firestore:", error);
        throw new Error("Could not create a new project.");
    }
};

/**
 * Restores multiple images from Google Cloud Storage for a project.
 * @param projectId The ID of the project.
 * @param scenes The scenes to restore images for.
 * @returns Scenes with restored image URLs.
 */
const restoreImagesFromGCS = async (projectId: string, scenes: Scene[]): Promise<Scene[]> => {
    try {
        console.log(`🔄 Restoring images from GCS for project: ${projectId}`);
        
        // Check if storage is properly initialized
        if (!storage) {
            console.warn('Firebase Storage not initialized, skipping image restoration');
            return scenes;
        }
        
        // Avoid listing (403). Synthesize up to 3 public URLs per scene based on naming convention.
        const exts = ['png','jpg','jpeg','webp'];
        const bucket = 'reel-banana-35a54.firebasestorage.app';
        const publicUrl = (sceneIdx: number, imgIdx: number, ext: string) =>
          `https://storage.googleapis.com/${bucket}/${projectId}/scene-${sceneIdx}-${imgIdx}.${ext}`;

        const restoredScenes = scenes.map((scene, index) => {
            if (Array.isArray(scene.imageUrls) && scene.imageUrls.length > 0) return scene;
            const urls: string[] = [];
            for (let i = 0; i < 3; i++) {
              // Prefer png (first ext)
              urls.push(publicUrl(index, i, exts[0]));
            }
            return { ...scene, imageUrls: urls };
        });

        console.log(`🔄 Image restoration (synthetic) complete for project: ${projectId}`);
        return restoredScenes;
        
    } catch (error) {
        console.error("Error restoring images from GCS:", error);
        // Return original scenes if restoration fails
        return scenes;
    }
};

/**
 * Retrieves a project document from Firestore and restores images from GCS.
 * @param projectId The ID of the project to fetch.
 * @returns The project data with restored images or null if not found.
 */
export const getProject = async (projectId: string): Promise<ProjectData | null> => {
    try {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const projectData = docSnap.data() as ProjectData;

            // Prefer scenes from subcollection (full carousel), fallback to stored scenes + GCS restore
            try {
                const scenesCol = collection(db, PROJECTS_COLLECTION, projectId, 'scenes');
                const scenesSnap = await getDocs(scenesCol);
                if (!scenesSnap.empty) {
                    const sceneMap: Record<number, any> = {};
                    scenesSnap.docs.forEach(d => {
                        const s: any = d.data() || {};
                        const idx = typeof s.index === 'number' ? s.index : parseInt(d.id, 10) || 0;
                        sceneMap[idx] = {
                            id: s.id || d.id,
                            prompt: s.prompt || '',
                            narration: s.narration || '',
                            status: s.status || 'ready',
                            duration: typeof s.duration === 'number' ? s.duration : 3,
                            backgroundImage: s.backgroundImage || '',
                            camera: s.camera || 'static',
                            transition: s.transition || 'fade',
                            imageUrls: Array.isArray(s.imageUrls) ? s.imageUrls.slice(0,3) : [],
                        };
                    });
                    const sortedIdx = Object.keys(sceneMap).map(n => parseInt(n,10)).sort((a,b)=>a-b);
                    projectData.scenes = sortedIdx.map(i => sceneMap[i]);
                } else if (projectData.scenes && projectData.scenes.length > 0) {
                    console.log(`🔄 Restoring images for project: ${projectId}`);
                    try {
                        projectData.scenes = await restoreImagesFromGCS(projectId, projectData.scenes);
                    } catch (restoreError) {
                        console.warn('Image restoration failed, using stored images:', restoreError);
                    }
                }
            } catch (e) {
                console.warn('Scenes subcollection load failed:', (e as any)?.message || e);
            }

            return projectData;
        } else {
            console.warn(`Project with ID "${projectId}" not found.`);
            return null;
        }
    } catch (error) {
        console.error("Error getting project from Firestore:", error);
        throw new Error("Could not load the project.");
    }
};

/**
 * Updates an existing project document in Firestore.
 * @param projectId The ID of the project to update.
 * @param data The data to update.
 */
// Helper function to recursively remove undefined values and clean data for Firestore
const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return null;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedValues).filter(item => {
            // Filter out null, undefined, and empty objects
            if (item === null || item === undefined) return false;
            if (typeof item === 'object' && Object.keys(item).length === 0) return false;
            return true;
        });
    }
    
    if (typeof obj === 'object') {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined && value !== null) {
                const cleanedValue = removeUndefinedValues(value);
                if (cleanedValue !== null && cleanedValue !== undefined) {
                    // Additional validation for Firestore
                    if (typeof cleanedValue === 'string' && cleanedValue.trim() === '') {
                        continue; // Skip empty strings
                    }
                    if (Array.isArray(cleanedValue) && cleanedValue.length === 0) {
                        continue; // Skip empty arrays
                    }
                    cleaned[key] = cleanedValue;
                }
            }
        }
        return cleaned;
    }
    
    // Ensure strings are not empty
    if (typeof obj === 'string' && obj.trim() === '') {
        return null;
    }
    
    return obj;
};

export const updateProject = async (projectId: string, data: ProjectData): Promise<void> => {
    try {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        
        // Build the data object with all possible fields
        const rawData: any = {
            topic: data.topic || 'Untitled',
            characterAndStyle: data.characterAndStyle || '',
            updatedAt: serverTimestamp()
        };
        
        // Only include characterRefs if it exists and is not empty
        if (data.characterRefs && data.characterRefs.length > 0) {
            rawData.characterRefs = data.characterRefs;
        }
        
        // Only include characterOption if it exists
        if (data.characterOption) {
            const co: any = {};
            if (data.characterOption.id) co.id = data.characterOption.id;
            if (data.characterOption.name) co.name = data.characterOption.name;
            if (data.characterOption.description) co.description = data.characterOption.description;
            if (Array.isArray(data.characterOption.images)) co.images = data.characterOption.images;
            rawData.characterOption = co;
        }
        
        // For scenes, we'll store a lightweight version to avoid size limits in the main doc
        // Store only essential scene data, not full image URLs
        if (data.scenes && data.scenes.length > 0) {
            rawData.scenes = data.scenes.map(scene => {
                const s: any = {};
                if (scene.id) s.id = scene.id;
                if (typeof scene.prompt === 'string') s.prompt = scene.prompt;
                if (typeof scene.narration === 'string') s.narration = scene.narration;
                // Keep a single thumbnail to avoid exceeding Firestore limits
                if (scene.imageUrls && Array.isArray(scene.imageUrls) && scene.imageUrls[0]) {
                    s.imageUrls = [scene.imageUrls[0]];
                }
                if (scene.status) s.status = scene.status;
                if (typeof scene.duration === 'number') s.duration = scene.duration;
                if (scene.backgroundImage) s.backgroundImage = scene.backgroundImage;
                if (scene.stylePreset) s.stylePreset = scene.stylePreset;
                if (scene.camera) s.camera = scene.camera;
                if (scene.transition) s.transition = scene.transition;
                return s;
            });
            rawData.sceneCount = data.scenes.length;
            rawData.thumbnailUrl = rawData.scenes[0]?.imageUrls?.[0] || null;

            // Also write full scenes to subcollection for full carousel restore (up to 3 images per scene)
            const scenesCol = collection(db, PROJECTS_COLLECTION, projectId, 'scenes');
            const writes = data.scenes.map((scene, index) => {
                const s: any = {
                    index,
                    id: scene.id || String(index),
                    prompt: scene.prompt || '',
                    narration: scene.narration || '',
                    status: scene.status || 'ready',
                    duration: typeof scene.duration === 'number' ? scene.duration : 3,
                    backgroundImage: scene.backgroundImage || '',
                    camera: scene.camera || 'static',
                    transition: scene.transition || 'fade',
                    imageUrls: Array.isArray(scene.imageUrls)
                        ? scene.imageUrls.filter((u: any)=>typeof u==='string' && u.trim()!=='').slice(0,3)
                        : [],
                    updatedAt: serverTimestamp(),
                };
                return setDoc(doc(scenesCol, String(index)), s, { merge: true });
            });
            await Promise.all(writes);
        }

        // Recursively remove all undefined values
        const cleanData = removeUndefinedValues(rawData);
        
        console.log('Saving to Firestore:', cleanData);
        console.log('Clean data scenes:', cleanData.scenes);
        
        // Additional validation for arrays and Firestore compatibility
        if (cleanData.scenes && Array.isArray(cleanData.scenes)) {
            cleanData.scenes = cleanData.scenes.map((scene: any, index: number) => {
                // Create a clean scene object with only valid Firestore types
                const cleanScene: any = {};
                
                // Copy only valid fields with proper types
                if (scene.id && typeof scene.id === 'string') cleanScene.id = scene.id;
                if (scene.prompt && typeof scene.prompt === 'string') cleanScene.prompt = scene.prompt;
                if (scene.narration && typeof scene.narration === 'string') cleanScene.narration = scene.narration;
                if (scene.status && typeof scene.status === 'string') cleanScene.status = scene.status;
                if (typeof scene.duration === 'number') cleanScene.duration = scene.duration;
                if (scene.backgroundImage && typeof scene.backgroundImage === 'string') cleanScene.backgroundImage = scene.backgroundImage;
                if (scene.stylePreset && typeof scene.stylePreset === 'string') cleanScene.stylePreset = scene.stylePreset;
                if (scene.camera && typeof scene.camera === 'string') cleanScene.camera = scene.camera;
                if (scene.transition && typeof scene.transition === 'string') cleanScene.transition = scene.transition;
                
                // Handle imageUrls array with strict validation
                if (scene.imageUrls && Array.isArray(scene.imageUrls)) {
                    cleanScene.imageUrls = scene.imageUrls
                        .filter((url: any) => url && typeof url === 'string' && url.trim() !== '')
                        .slice(0, 1); // Only keep first image URL to avoid size limits
                }
                
                return cleanScene;
            });
        }
        
        await setDoc(docRef, cleanData, { merge: true });
    } catch (error) {
        console.error("Error updating project in Firestore:", error);
        throw new Error("Could not save the project.");
    }
};

// --- Project Listing & Management ---

export interface ProjectSummary {
    id: string;
    topic: string;
    createdAt?: string;
    updatedAt?: string;
    sceneCount: number;
    thumbnailUrl?: string;
    thumbs?: string[];
}

/**
 * List the current user's projects, most recent first.
 */
export const listMyProjects = async (userId: string, limit: number = 20): Promise<ProjectSummary[]> => {
    try {
        console.log('🔍 listMyProjects: Fetching projects for user:', userId);
        const col = collection(db, PROJECTS_COLLECTION);
        // Use a simpler query that doesn't require a composite index
        // We'll sort in memory instead of using orderBy to avoid index requirement
        const q = query(
            col,
            where('userId', '==', userId),
            fsLimit(limit * 2) // Get more docs to sort in memory
        );
        console.log('🔍 listMyProjects: Executing query...');
        const snap = await getDocs(q);
        console.log('🔍 listMyProjects: Query successful, found', snap.docs.length, 'documents');
        const projects = await Promise.all(snap.docs.map(async d => {
            const data: any = d.data();
            const projectId = d.id;
            
            // Try to build up to 3 thumbs from the first images of the first few scenes
            const thumbs: string[] = [];
            if (Array.isArray(data.scenes)) {
                // For project listing, we'll try to restore a few images from GCS for better thumbnails
                try {
                    const restoredScenes = await restoreImagesFromGCS(projectId, data.scenes.slice(0, 3));
                    for (const scene of restoredScenes) {
                        if (scene.imageUrls && scene.imageUrls.length > 0 && thumbs.length < 3) {
                            thumbs.push(scene.imageUrls[0]);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to restore images for project ${projectId} in listing:`, error);
                    // Fallback to stored thumbnails
                    for (let i = 0; i < data.scenes.length && thumbs.length < 3; i++) {
                        const s = data.scenes[i];
                        if (s?.imageUrls?.[0]) thumbs.push(s.imageUrls[0]);
                    }
                }
            }
            
            return {
                id: projectId,
                topic: data.topic || 'Untitled',
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() || undefined,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || undefined,
                sceneCount: Array.isArray(data.scenes) ? data.scenes.length : 0,
                thumbnailUrl: thumbs[0] || (Array.isArray(data.scenes) && data.scenes[0]?.imageUrls?.[0] ? data.scenes[0].imageUrls[0] : undefined),
                thumbs,
            } as ProjectSummary;
        }));
        
        // Sort by updatedAt in memory (most recent first)
        projects.sort((a, b) => {
            const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bTime - aTime; // Descending order
        });
        
        // Return only the requested limit
        return projects.slice(0, limit);
    } catch (error) {
        console.error('❌ Error listing projects:', error);
        console.error('❌ Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code,
            userId: userId
        });
        throw new Error('Could not load your projects.');
    }
};

/**
 * Delete a project by id (owner-only in rules)
 */
export const deleteProject = async (projectId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
    } catch (error) {
        console.error('Error deleting project:', error);
        throw new Error('Could not delete the project.');
    }
};

/**
 * Rename a project (updates the topic field)
 */
export const renameProject = async (projectId: string, newTopic: string): Promise<void> => {
    try {
        const ref = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(ref, {
            topic: newTopic,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error renaming project:', error);
        throw new Error('Could not rename the project.');
    }
};

/**
 * Duplicate an existing project. Returns the new project id.
 */
export const duplicateProject = async (projectId: string): Promise<string> => {
    try {
        const srcRef = doc(db, PROJECTS_COLLECTION, projectId);
        const snap = await getDoc(srcRef);
        if (!snap.exists()) throw new Error('Source project not found');
        const data: any = snap.data();
        const newTopic = `Copy of ${data.topic || 'Untitled'}`;
        const currentUser = getCurrentUser();
        const dstRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
            ...data,
            topic: newTopic,
            userId: currentUser?.uid || data.userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return dstRef.id;
    } catch (error) {
        console.error('Error duplicating project:', error);
        throw new Error('Could not duplicate the project.');
    }
};

// --- Public Gallery ---

interface PublicMovie {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    createdAt: any;
    userId?: string;
}

export const publishMovie = async (movie: Omit<PublicMovie, 'createdAt'>): Promise<string> => {
    try {
        const currentUser = getCurrentUser();
        const docRef = await addDoc(collection(db, 'public_movies'), {
            ...movie,
            userId: currentUser?.uid,
            createdAt: serverTimestamp(),
            views: 0,
            likes: 0,
        } as any);
        console.log('Published movie with id', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error publishing movie:', error);
        // Non-fatal for user flow
        throw error;
    }
};

// Load pre-generated demo characters from Firestore
export const getDemoCharacters = async (templateId?: string): Promise<Array<{ id: string; name: string; description: string; images: string[] }>> => {
    const db = getFirestore(firebaseApp);
    const col = collection(db, 'demo_characters');
    const snap = await getDocs(col as any).catch(() => null as any);
    if (!snap) return [];
    const items: any[] = [];
    // @ts-ignore
    snap.forEach((doc: any) => {
        const data = doc.data();
        if (!templateId || data.templateId === templateId) {
            items.push({ id: doc.id, name: data.name, description: data.description, images: data.images || [] });
        }
    });
    return items;
};
