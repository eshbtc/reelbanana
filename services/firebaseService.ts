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
import { Scene } from '../types';
import { firebaseApp } from '../lib/firebase';
import { getCurrentUser } from './authService';

// Use centralized Firebase app for consistency and App Check
const db = getFirestore(firebaseApp);

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
 * Retrieves a project document from Firestore.
 * @param projectId The ID of the project to fetch.
 * @returns The project data or null if not found.
 */
export const getProject = async (projectId: string): Promise<ProjectData | null> => {
    try {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // We cast here, assuming the data structure is correct.
            // Add validation here for more robustness.
            return docSnap.data() as ProjectData;
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
export const updateProject = async (projectId: string, data: ProjectData): Promise<void> => {
    try {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        await setDoc(docRef, { 
            ...data, 
            updatedAt: serverTimestamp() 
        }, { merge: true }); // Use merge to avoid overwriting createdAt
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
        const col = collection(db, PROJECTS_COLLECTION);
        const q = query(
            col,
            where('userId', '==', userId),
            orderBy('updatedAt', 'desc'),
            fsLimit(limit)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data: any = d.data();
            // Try to build up to 3 thumbs from the first images of the first few scenes
            const thumbs: string[] = [];
            if (Array.isArray(data.scenes)) {
                for (let i = 0; i < data.scenes.length && thumbs.length < 3; i++) {
                    const s = data.scenes[i];
                    if (s?.imageUrls?.[0]) thumbs.push(s.imageUrls[0]);
                }
            }
            return {
                id: d.id,
                topic: data.topic || 'Untitled',
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() || undefined,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || undefined,
                sceneCount: Array.isArray(data.scenes) ? data.scenes.length : 0,
                thumbnailUrl: Array.isArray(data.scenes) && data.scenes[0]?.imageUrls?.[0] ? data.scenes[0].imageUrls[0] : undefined,
                thumbs,
            } as ProjectSummary;
        });
    } catch (error) {
        console.error('Error listing projects:', error);
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
