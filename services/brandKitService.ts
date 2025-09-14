// Brand Kit service for Pro/Studio features
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
    getDocs,
    deleteDoc,
    updateDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { BrandKit } from '../types';
import { firebaseApp } from '../lib/firebase';
import { getCurrentUser } from './authService';
import { checkPlanGate } from './planGatingService';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const BRAND_KITS_COLLECTION = 'brandKits';

/**
 * Create a new brand kit
 */
export const createBrandKit = async (brandKitData: Omit<BrandKit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to create brand kits');
        }

        // Check if user has permission for custom branding
        const gateResult = await checkPlanGate({ feature: 'custom_branding' });
        if (!gateResult.allowed) {
            throw new Error(gateResult.reason || 'Custom branding requires Pro plan or higher');
        }

        const brandKit: Omit<BrandKit, 'id'> = {
            ...brandKitData,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const docRef = await addDoc(collection(db, BRAND_KITS_COLLECTION), {
            ...brandKit,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return docRef.id;
    } catch (error) {
        console.error('Error creating brand kit:', error);
        throw new Error('Failed to create brand kit');
    }
};

/**
 * Get all brand kits for the current user
 */
export const getUserBrandKits = async (): Promise<BrandKit[]> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to fetch brand kits');
        }

        const q = query(
            collection(db, BRAND_KITS_COLLECTION),
            where('userId', '==', currentUser.uid),
            orderBy('updatedAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const brandKits: BrandKit[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            brandKits.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            } as BrandKit);
        });

        return brandKits;
    } catch (error) {
        console.error('Error fetching brand kits:', error);
        throw new Error('Failed to fetch brand kits');
    }
};

/**
 * Get a specific brand kit by ID
 */
export const getBrandKit = async (brandKitId: string): Promise<BrandKit | null> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to fetch brand kit');
        }

        const docRef = doc(db, BRAND_KITS_COLLECTION, brandKitId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Check ownership
            if (data.userId !== currentUser.uid) {
                throw new Error('Access denied: You do not own this brand kit');
            }

            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
            } as BrandKit;
        }

        return null;
    } catch (error) {
        console.error('Error fetching brand kit:', error);
        throw new Error('Failed to fetch brand kit');
    }
};

/**
 * Update a brand kit
 */
export const updateBrandKit = async (brandKitId: string, updates: Partial<BrandKit>): Promise<void> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to update brand kit');
        }

        // Check if user has permission for custom branding
        const gateResult = await checkPlanGate({ feature: 'custom_branding' });
        if (!gateResult.allowed) {
            throw new Error(gateResult.reason || 'Custom branding requires Pro plan or higher');
        }

        const docRef = doc(db, BRAND_KITS_COLLECTION, brandKitId);
        
        // Check ownership before updating
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            throw new Error('Brand kit not found');
        }

        const data = docSnap.data();
        if (data.userId !== currentUser.uid) {
            throw new Error('Access denied: You do not own this brand kit');
        }

        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating brand kit:', error);
        throw new Error('Failed to update brand kit');
    }
};

/**
 * Delete a brand kit
 */
export const deleteBrandKit = async (brandKitId: string): Promise<void> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to delete brand kit');
        }

        const docRef = doc(db, BRAND_KITS_COLLECTION, brandKitId);
        
        // Check ownership before deleting
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            throw new Error('Brand kit not found');
        }

        const data = docSnap.data();
        if (data.userId !== currentUser.uid) {
            throw new Error('Access denied: You do not own this brand kit');
        }

        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting brand kit:', error);
        throw new Error('Failed to delete brand kit');
    }
};

/**
 * Upload brand kit logo
 */
export const uploadBrandKitLogo = async (file: File, brandKitId: string): Promise<string> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to upload logo');
        }

        // Check if user has permission for custom branding
        const gateResult = await checkPlanGate({ feature: 'custom_branding' });
        if (!gateResult.allowed) {
            throw new Error(gateResult.reason || 'Custom branding requires Pro plan or higher');
        }

        // Create a unique filename
        const timestamp = Date.now();
        const fileName = `brand-kits/${currentUser.uid}/${brandKitId}/logo-${timestamp}.${file.name.split('.').pop()}`;
        
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, file);
        
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading brand kit logo:', error);
        throw new Error('Failed to upload logo');
    }
};

/**
 * Get default brand kit for free users
 */
export const getDefaultBrandKit = (): BrandKit => {
    return {
        id: 'default',
        name: 'ReelBanana Default',
        description: 'Default branding for ReelBanana',
        primaryColor: '#F59E0B', // Amber
        secondaryColor: '#1F2937', // Gray
        accentColor: '#EF4444', // Red
        fontFamily: 'Inter',
        brandVoice: 'Professional, creative, and engaging',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
    };
};

/**
 * Apply brand kit to project
 */
export const applyBrandKitToProject = async (projectId: string, brandKitId: string): Promise<void> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to apply brand kit');
        }

        // Check if user has permission for custom branding
        const gateResult = await checkPlanGate({ feature: 'custom_branding' });
        if (!gateResult.allowed) {
            throw new Error(gateResult.reason || 'Custom branding requires Pro plan or higher');
        }

        // Get the brand kit
        const brandKit = await getBrandKit(brandKitId);
        if (!brandKit) {
            throw new Error('Brand kit not found');
        }

        // Update project with brand kit reference
        const { updateProject } = await import('./firebaseService');
        await updateProject(projectId, {
            brandKitId: brandKitId
        } as any);
    } catch (error) {
        console.error('Error applying brand kit to project:', error);
        throw new Error('Failed to apply brand kit to project');
    }
};
