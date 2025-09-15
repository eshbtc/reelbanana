import React, { useState, useEffect } from 'react';
import { ReviewLink, ReviewComment } from '../types';
import { getReviewLinkByToken, addReviewComment } from '../services/reviewLinkService';
import { getProject } from '../services/firebaseService';
import { ProjectData } from '../services/firebaseService';
import { MessageSquare, Send, CheckCircle, XCircle, Clock, Users } from 'lucide-react';

interface PublicReviewPageProps {
    reviewLinkId: string;
}

export const PublicReviewPage: React.FC<PublicReviewPageProps> = ({ reviewLinkId }) => {
    const [reviewLink, setReviewLink] = useState<ReviewLink | null>(null);
    const [project, setProject] = useState<ProjectData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [reviewerEmail, setReviewerEmail] = useState('');
    const [reviewerName, setReviewerName] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        loadReviewData();
    }, [reviewLinkId]);

    const loadReviewData = async () => {
        try {
            setIsLoading(true);
            const link = await getReviewLinkByToken(reviewLinkId);
            if (!link) {
                setError('Review link not found or has expired');
                return;
            }
            const projectData = await getProject(link.projectId);

            if (!link) {
                setError('Review link not found or has expired');
                return;
            }

            setReviewLink(link);
            setProject(projectData);
        } catch (error) {
            console.error('Error loading review data:', error);
            setError('Failed to load review data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailSubmit = () => {
        if (!reviewLink || !reviewerEmail.trim()) return;

        const authorized = reviewLink.reviewers.includes(reviewerEmail.trim());
        setIsAuthorized(authorized);

        if (!authorized) {
            setError('You are not authorized to review this project. Please check your email address.');
        }
    };

    const handleCommentSubmit = async () => {
        if (!reviewLink || !newComment.trim() || !reviewerEmail.trim()) return;

        try {
            setIsSubmitting(true);
            await addReviewComment({
                reviewLinkId,
                authorEmail: reviewerEmail.trim(),
                authorName: reviewerName.trim() || 'Anonymous',
                content: newComment.trim(),
                status: 'pending'
            });

            setNewComment('');
            await loadReviewData(); // Reload to get updated comments
        } catch (error) {
            console.error('Error submitting comment:', error);
            setError('Failed to submit comment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApproval = async (approved: boolean) => {
        if (!reviewLink || !reviewerEmail.trim()) return;

        try {
            setIsSubmitting(true);
            const comment = approved ? 
                '✅ Approved this project' : 
                '❌ Requested changes to this project';
            
            await addReviewComment({
                reviewLinkId,
                authorEmail: reviewerEmail.trim(),
                authorName: reviewerName.trim() || 'Anonymous',
                content: comment,
                status: 'pending'
            });

            await loadReviewData();
        } catch (error) {
            console.error('Error submitting approval:', error);
            setError('Failed to submit approval');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading review...</p>
                </div>
            </div>
        );
    }

    if (error || !reviewLink) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="text-red-400 text-6xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Review Not Available</h1>
                    <p className="text-gray-400">{error || 'This review link is not available'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">{reviewLink.title}</h1>
                    {reviewLink.description && (
                        <p className="text-gray-300 mb-4">{reviewLink.description}</p>
                    )}
                    
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{reviewLink.reviewers.length} reviewer{reviewLink.reviewers.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>{reviewLink.comments.length} comment{reviewLink.comments.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>
                                {reviewLink.expiresAt ? 
                                    `Expires ${reviewLink.expiresAt.toLocaleDateString()}` : 
                                    'No expiration'
                                }
                            </span>
                        </div>
                    </div>
                </div>

                {/* Email Verification */}
                {!isAuthorized && (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Verify Your Email</h2>
                        <p className="text-gray-300 mb-4">
                            Please enter your email address to access this review.
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    value={reviewerEmail}
                                    onChange={(e) => setReviewerEmail(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="your@email.com"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Your Name (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={reviewerName}
                                    onChange={(e) => setReviewerName(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="Your Name"
                                />
                            </div>
                            
                            <button
                                onClick={handleEmailSubmit}
                                disabled={!reviewerEmail.trim()}
                                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
                            >
                                Access Review
                            </button>
                        </div>
                    </div>
                )}

                {/* Project Content */}
                {isAuthorized && project && (
                    <>
                        {/* Project Video */}
                        {project.videoUrl && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Project Video</h2>
                                <video
                                    controls
                                    className="w-full max-w-2xl mx-auto rounded-lg"
                                    src={project.videoUrl}
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        )}

                        {/* Project Scenes */}
                        {project.scenes && project.scenes.length > 0 && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Project Scenes</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {project.scenes.map((scene, index) => (
                                        <div key={scene.id || index} className="bg-gray-900 rounded-lg p-4">
                                            <h3 className="text-lg font-medium text-white mb-2">
                                                Scene {index + 1}
                                            </h3>
                                            <p className="text-gray-300 mb-3">{scene.prompt}</p>
                                            {scene.narration && (
                                                <p className="text-sm text-gray-400 italic">
                                                    "{scene.narration}"
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Approval Actions */}
                        {reviewLink.allowApproval && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Your Decision</h2>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleApproval(true)}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg transition-colors"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleApproval(false)}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Request Changes
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Comments Section */}
                        {reviewLink.allowComments && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Comments</h2>
                                
                                {/* Existing Comments */}
                                <div className="space-y-4 mb-6">
                                    {reviewLink.comments.map((comment) => (
                                        <div key={comment.id} className="bg-gray-900 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white">
                                                        {comment.reviewerName || comment.reviewerEmail}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {comment.timestamp.toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {comment.resolved && (
                                                    <span className="text-xs bg-green-400/20 text-green-400 px-2 py-1 rounded">
                                                        Resolved
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-300">{comment.content}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* New Comment Form */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Add a Comment
                                        </label>
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                            rows={3}
                                            placeholder="Share your feedback..."
                                        />
                                    </div>
                                    
                                    <button
                                        onClick={handleCommentSubmit}
                                        disabled={isSubmitting || !newComment.trim()}
                                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                        {isSubmitting ? 'Submitting...' : 'Submit Comment'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
