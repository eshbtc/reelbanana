// Firebase service using centralized Firebase app
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    collection, 
    serverTimestamp 
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