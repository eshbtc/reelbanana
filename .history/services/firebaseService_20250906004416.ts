// New file: services/firebaseService.ts
import { initializeApp } from 'firebase/app';
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

// =================================================================================
// TODO: PASTE YOUR FIREBASE CONFIGURATION HERE
// =================================================================================
// You MUST replace these placeholder values with the actual configuration object
// from your Firebase project settings.
//
// How to get this:
// 1. Go to your Firebase project console.
// 2. Click the gear icon -> Project settings.
// 3. In the "General" tab, scroll down to "Your apps".
// 4. Click the web icon (</>) to register your app if you haven't already.
// 5. Copy the `firebaseConfig` object and paste it here.
// =================================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg",
    authDomain: "reel-banana-35a54.firebaseapp.com",
    projectId: "reel-banana-35a54",
    storageBucket: "reel-banana-35a54.firebasestorage.app",
    messagingSenderId: "223097908182",
    appId: "1:223097908182:web:982c634d6aaeb3c805d277"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
        const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
            ...data,
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
