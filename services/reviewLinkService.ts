// Review Links Service for collaborative video review
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
    updateDoc,
    Timestamp,
    limit
} from 'firebase/firestore';
import { ReviewLink, ReviewComment, ReviewApproval } from '../types';
import { firebaseApp } from '../lib/firebase';
import { getCurrentUser } from './authService';
import { checkPlanGate } from './planGatingService';

const db = getFirestore(firebaseApp);

const REVIEW_LINKS_COLLECTION = 'reviewLinks';
const REVIEW_COMMENTS_COLLECTION = 'reviewComments';
const REVIEW_APPROVALS_COLLECTION = 'reviewApprovals';

/**
 * Generate a secure random token for review links
 */
const generateReviewToken = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Create a new review link
 */
export const createReviewLink = async (reviewLinkData: Omit<ReviewLink, 'id' | 'token' | 'createdAt' | 'createdBy' | 'accessCount'>): Promise<string> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to create review links');
        }

        // Check if user has permission for review links (Pro/Studio feature)
        const gateResult = await checkPlanGate({ feature: 'review_links' });
        if (!gateResult.allowed) {
            throw new Error(gateResult.reason || 'Review links require Pro plan or higher');
        }

        const token = generateReviewToken();
        const reviewLink: Omit<ReviewLink, 'id'> = {
            ...reviewLinkData,
            token,
            createdAt: new Date(),
            createdBy: currentUser.uid,
            accessCount: 0
        };

        const docRef = await addDoc(collection(db, REVIEW_LINKS_COLLECTION), {
            ...reviewLink,
            createdAt: serverTimestamp(),
            expiresAt: reviewLink.expiresAt ? Timestamp.fromDate(reviewLink.expiresAt) : null
        });

        return docRef.id;
    } catch (error) {
        console.error('Error creating review link:', error);
        throw new Error('Failed to create review link');
    }
};

/**
 * Get all review links for a project
 */
export const getProjectReviewLinks = async (projectId: string): Promise<ReviewLink[]> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to view review links');
        }

        const q = query(
            collection(db, REVIEW_LINKS_COLLECTION),
            where('projectId', '==', projectId),
            where('createdBy', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                expiresAt: data.expiresAt?.toDate() || undefined,
                lastAccessedAt: data.lastAccessedAt?.toDate() || undefined
            } as ReviewLink;
        });
    } catch (error) {
        console.error('Error fetching project review links:', error);
        throw new Error('Failed to fetch review links');
    }
};

/**
 * Get a review link by token (for public access)
 */
export const getReviewLinkByToken = async (token: string): Promise<ReviewLink | null> => {
    try {
        const q = query(
            collection(db, REVIEW_LINKS_COLLECTION),
            where('token', '==', token),
            where('status', '==', 'active')
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        // Check if link has expired
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
            // Mark as expired
            await updateDoc(doc.ref, { status: 'expired' });
            return null;
        }

        // Update access count and last accessed time
        await updateDoc(doc.ref, {
            accessCount: (data.accessCount || 0) + 1,
            lastAccessedAt: serverTimestamp()
        });

        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            expiresAt: data.expiresAt?.toDate() || undefined,
            lastAccessedAt: new Date()
        } as ReviewLink;
    } catch (error) {
        console.error('Error fetching review link by token:', error);
        throw new Error('Failed to fetch review link');
    }
};

/**
 * Update a review link
 */
export const updateReviewLink = async (reviewLinkId: string, updates: Partial<ReviewLink>): Promise<void> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to update review link');
        }

        const docRef = doc(db, REVIEW_LINKS_COLLECTION, reviewLinkId);
        
        // Check ownership before updating
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            throw new Error('Review link not found');
        }

        const data = docSnap.data();
        if (data.createdBy !== currentUser.uid) {
            throw new Error('Access denied: You do not own this review link');
        }

        const updateData: any = { ...updates };
        if (updates.expiresAt) {
            updateData.expiresAt = Timestamp.fromDate(updates.expiresAt);
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error('Error updating review link:', error);
        throw new Error('Failed to update review link');
    }
};

/**
 * Delete a review link
 */
export const deleteReviewLink = async (reviewLinkId: string): Promise<void> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated to delete review link');
        }

        const docRef = doc(db, REVIEW_LINKS_COLLECTION, reviewLinkId);
        
        // Check ownership before deleting
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            throw new Error('Review link not found');
        }

        const data = docSnap.data();
        if (data.createdBy !== currentUser.uid) {
            throw new Error('Access denied: You do not own this review link');
        }

        // Delete associated comments and approvals
        const commentsQuery = query(
            collection(db, REVIEW_COMMENTS_COLLECTION),
            where('reviewLinkId', '==', reviewLinkId)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        const deleteCommentsPromises = commentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteCommentsPromises);

        const approvalsQuery = query(
            collection(db, REVIEW_APPROVALS_COLLECTION),
            where('reviewLinkId', '==', reviewLinkId)
        );
        const approvalsSnapshot = await getDocs(approvalsQuery);
        const deleteApprovalsPromises = approvalsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteApprovalsPromises);

        // Delete the review link
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting review link:', error);
        throw new Error('Failed to delete review link');
    }
};

/**
 * Add a comment to a review link
 */
export const addReviewComment = async (commentData: Omit<ReviewComment, 'id' | 'timestamp'>): Promise<string> => {
    try {
        // Load linked review by document ID (public page passes doc id)
        const linkRef = doc(db, REVIEW_LINKS_COLLECTION, commentData.reviewLinkId);
        const linkSnap = await getDoc(linkRef);
        if (!linkSnap.exists()) {
            throw new Error('Review link not found or expired');
        }
        const reviewLink = linkSnap.data() as any;
        if (!(Array.isArray(reviewLink.permissions) && reviewLink.permissions.includes('comment'))) {
            throw new Error('Comments are not allowed on this review link');
        }

        const comment: Omit<ReviewComment, 'id'> = {
            ...commentData,
            timestamp: new Date()
        };

        const docRef = await addDoc(collection(db, REVIEW_COMMENTS_COLLECTION), {
            ...comment,
            timestamp: serverTimestamp()
        });

        // Send notification to review link owner (best-effort)
        await notifyReviewActivity(linkSnap.id, 'comment', {
            commentId: docRef.id,
            authorName: comment.authorName,
            content: comment.content
        });

        return docRef.id;
    } catch (error) {
        console.error('Error adding review comment:', error);
        throw new Error('Failed to add comment');
    }
};

/**
 * Get comments for a review link
 */
export const getReviewComments = async (reviewLinkId: string): Promise<ReviewComment[]> => {
    try {
        const q = query(
            collection(db, REVIEW_COMMENTS_COLLECTION),
            where('reviewLinkId', '==', reviewLinkId),
            orderBy('timestamp', 'asc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate() || new Date()
            } as ReviewComment;
        });
    } catch (error) {
        console.error('Error fetching review comments:', error);
        throw new Error('Failed to fetch comments');
    }
};

/**
 * Submit an approval for a review link
 */
export const submitReviewApproval = async (approvalData: Omit<ReviewApproval, 'id' | 'timestamp'>): Promise<string> => {
    try {
        // Load linked review by document ID
        const linkRef = doc(db, REVIEW_LINKS_COLLECTION, approvalData.reviewLinkId);
        const linkSnap = await getDoc(linkRef);
        if (!linkSnap.exists()) {
            throw new Error('Review link not found or expired');
        }
        const reviewLink = linkSnap.data() as any;
        if (!(Array.isArray(reviewLink.permissions) && reviewLink.permissions.includes('approve'))) {
            throw new Error('Approvals are not allowed on this review link');
        }

        const approval: Omit<ReviewApproval, 'id'> = {
            ...approvalData,
            timestamp: new Date()
        };

        const docRef = await addDoc(collection(db, REVIEW_APPROVALS_COLLECTION), {
            ...approval,
            timestamp: serverTimestamp()
        });

        // Send notification to review link owner (best-effort)
        await notifyReviewActivity(linkSnap.id, 'approval', {
            approvalId: docRef.id,
            reviewerName: approval.reviewerName,
            status: approval.status,
            feedback: approval.feedback
        });

        return docRef.id;
    } catch (error) {
        console.error('Error submitting review approval:', error);
        throw new Error('Failed to submit approval');
    }
};

/**
 * Get approvals for a review link
 */
export const getReviewApprovals = async (reviewLinkId: string): Promise<ReviewApproval[]> => {
    try {
        const q = query(
            collection(db, REVIEW_APPROVALS_COLLECTION),
            where('reviewLinkId', '==', reviewLinkId),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate() || new Date()
            } as ReviewApproval;
        });
    } catch (error) {
        console.error('Error fetching review approvals:', error);
        throw new Error('Failed to fetch approvals');
    }
};

/**
 * Verify review link password
 */
export const verifyReviewLinkPassword = async (token: string, password: string): Promise<boolean> => {
    try {
        const reviewLink = await getReviewLinkByToken(token);
        if (!reviewLink) {
            return false;
        }

        if (!reviewLink.password) {
            return true; // No password required
        }

        return reviewLink.password === password;
    } catch (error) {
        console.error('Error verifying review link password:', error);
        return false;
    }
};

/**
 * Send notification to review link owner about new activity
 */
export const notifyReviewActivity = async (reviewLinkId: string, activityType: 'comment' | 'approval', activityData: any): Promise<void> => {
    try {
        // Get the review link to find the owner
        const reviewLinkDoc = await getDoc(doc(db, REVIEW_LINKS_COLLECTION, reviewLinkId));
        if (!reviewLinkDoc.exists()) {
            return;
        }

        const reviewLinkData = reviewLinkDoc.data();
        const ownerId = reviewLinkData.createdBy;

        // Create notification document
        const notificationData = {
            userId: ownerId,
            type: 'review_activity',
            reviewLinkId,
            activityType,
            activityData,
            read: false,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'notifications'), notificationData);
        
        console.log(`Notification sent to user ${ownerId} for ${activityType} on review link ${reviewLinkId}`);
    } catch (error) {
        console.error('Error sending review notification:', error);
        // Don't throw - notifications are not critical
    }
};

/**
 * Get notifications for the current user
 */
export const getUserNotifications = async (): Promise<any[]> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            return [];
        }

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error('User must be authenticated');
        }

        const notificationRef = doc(db, 'notifications', notificationId);
        const notificationDoc = await getDoc(notificationRef);
        
        if (notificationDoc.exists() && notificationDoc.data().userId === currentUser.uid) {
            await updateDoc(notificationRef, { read: true });
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw new Error('Failed to mark notification as read');
    }
};
