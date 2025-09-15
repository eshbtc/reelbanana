import React, { useState, useEffect } from 'react';
import { ReviewLink } from '../types';
import { 
    createReviewLink, 
    getProjectReviewLinks, 
    updateReviewLink, 
    deleteReviewLink 
} from '../services/reviewLinkService';
import { useUserPlan } from '../hooks/useUserPlan';
import { EnhancedUpgradePrompt } from './EnhancedUpgradePrompt';
import { checkPlanGate } from '../services/planGatingService';
import { useToast } from './ToastProvider';
import { useConfirm } from './ConfirmProvider';
import { Plus, Edit, Trash2, Copy, ExternalLink, Clock, Users, MessageSquare, CheckCircle } from 'lucide-react';

interface ReviewLinkManagerProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    projectTitle?: string;
}

export const ReviewLinkManager: React.FC<ReviewLinkManagerProps> = ({
    isOpen,
    onClose,
    projectId,
    projectTitle = 'Untitled Project'
}) => {
    const { planTier } = useUserPlan();
    const [reviewLinks, setReviewLinks] = useState<ReviewLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingLink, setEditingLink] = useState<ReviewLink | null>(null);
    const [gateResult, setGateResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        expiresAt: '',
        password: '',
        permissions: ['view', 'comment'] as ('view' | 'comment' | 'approve')[]
    });

    let toast: any = null;
    let confirm: any = null;
    
    try {
        const toastContext = useToast();
        toast = toastContext.toast;
    } catch (error) {
        console.warn('Toast context not available:', error);
        toast = { info: () => {}, success: () => {}, error: () => {} };
    }

    try {
        const confirmContext = useConfirm();
        confirm = confirmContext.confirm;
    } catch (error) {
        console.warn('Confirm context not available:', error);
        confirm = async () => false;
    }

    useEffect(() => {
        if (isOpen) {
            checkPermissions();
            loadReviewLinks();
        }
    }, [isOpen, projectId]);

    const checkPermissions = async () => {
        try {
            const result = await checkPlanGate({ feature: 'review_links' });
            setGateResult(result);
        } catch (error) {
            console.error('Error checking permissions:', error);
            setGateResult({ allowed: false, reason: 'Failed to check permissions' });
        }
    };

    const loadReviewLinks = async () => {
        try {
            setIsLoading(true);
            const links = await getProjectReviewLinks(projectId);
            setReviewLinks(links);
        } catch (error) {
            console.error('Error loading review links:', error);
            setError('Failed to load review links');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateLink = async () => {
        if (!formData.title.trim()) {
            toast.error('Please enter a title for the review link');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const reviewLinkData = {
                projectId,
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
                password: formData.password.trim() || undefined,
                permissions: formData.permissions,
                status: 'active' as const
            };

            const linkId = await createReviewLink({
                ...reviewLinkData,
                reviewers: []
            });
            
            // Get the created link to display
            const newLink = await getProjectReviewLinks(projectId);
            setReviewLinks(newLink);
            
            // Reset form
            setFormData({
                title: '',
                description: '',
                expiresAt: '',
                password: '',
                permissions: ['view', 'comment']
            });

            toast.success('Review link created successfully!');
        } catch (error) {
            console.error('Error creating review link:', error);
            setError(error instanceof Error ? error.message : 'Failed to create review link');
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateLink = async (linkId: string, updates: Partial<ReviewLink>) => {
        try {
            await updateReviewLink(linkId, updates);
            await loadReviewLinks();
            toast.success('Review link updated successfully!');
        } catch (error) {
            console.error('Error updating review link:', error);
            toast.error('Failed to update review link');
        }
    };

    const handleDeleteLink = async (linkId: string) => {
        const ok = await confirm({
            title: 'Delete Review Link?',
            message: 'Are you sure you want to delete this review link? This action cannot be undone and will remove all associated comments and approvals.',
            confirmText: 'Delete',
            cancelText: 'Cancel'
        });

        if (!ok) return;

        try {
            await deleteReviewLink(linkId);
            await loadReviewLinks();
            toast.success('Review link deleted successfully!');
        } catch (error) {
            console.error('Error deleting review link:', error);
            toast.error('Failed to delete review link');
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Link copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            toast.error('Failed to copy link');
        }
    };

    const getReviewUrl = (token: string) => {
        return `${window.location.origin}/review/${token}`;
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-400 bg-green-400/10';
            case 'expired': return 'text-red-400 bg-red-400/10';
            case 'revoked': return 'text-gray-400 bg-gray-400/10';
            default: return 'text-gray-400 bg-gray-400/10';
        }
    };

    if (!isOpen) return null;

    if (!gateResult?.allowed) {
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
                    <h2 className="text-xl font-semibold text-white mb-4">Review Links</h2>
                    <EnhancedUpgradePrompt
                        gateResult={gateResult}
                        variant="modal"
                        onDismiss={onClose}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-white">Review Links</h2>
                            <p className="text-gray-400 text-sm mt-1">Share your project for review and feedback</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Create New Link Form */}
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            Create Review Link
                        </h3>
                        
                        <div className="bg-gray-900 rounded-lg p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g., Client Review - Final Cut"
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Optional description for reviewers..."
                                    rows={3}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Expires At
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.expiresAt}
                                        onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Password (Optional)
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        placeholder="Optional password protection"
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Permissions
                                </label>
                                <div className="space-y-2">
                                    {[
                                        { value: 'view', label: 'View', description: 'Can view the video' },
                                        { value: 'comment', label: 'Comment', description: 'Can add comments' },
                                        { value: 'approve', label: 'Approve', description: 'Can approve/reject' }
                                    ].map((permission) => (
                                        <label key={permission.value} className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={formData.permissions.includes(permission.value as any)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            permissions: [...prev.permissions, permission.value as any]
                                                        }));
                                                    } else {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            permissions: prev.permissions.filter(p => p !== permission.value)
                                                        }));
                                                    }
                                                }}
                                                className="rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                                            />
                                            <div>
                                                <span className="text-white text-sm font-medium">{permission.label}</span>
                                                <span className="text-gray-400 text-xs block">{permission.description}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleCreateLink}
                                disabled={isCreating || !formData.title.trim()}
                                className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                            >
                                {isCreating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Create Review Link
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Existing Review Links */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Existing Review Links ({reviewLinks.length})
                        </h3>

                        {isLoading ? (
                            <div className="text-center py-8">
                                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-gray-400">Loading review links...</p>
                            </div>
                        ) : reviewLinks.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No review links created yet</p>
                                <p className="text-sm">Create your first review link to share your project</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reviewLinks.map((link) => (
                                    <div key={link.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="text-white font-medium">{link.title}</h4>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(link.status)}`}>
                                                        {link.status}
                                                    </span>
                                                </div>
                                                {link.description && (
                                                    <p className="text-gray-400 text-sm mb-2">{link.description}</p>
                                                )}
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Created {formatDate(link.createdAt)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <ExternalLink className="w-3 h-3" />
                                                        {link.accessCount} views
                                                    </span>
                                                    {link.expiresAt && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Expires {formatDate(link.expiresAt)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => copyToClipboard(getReviewUrl(link.token))}
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                                                    title="Copy link"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLink(link.id)}
                                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                                                    title="Delete link"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500">Permissions:</span>
                                                <div className="flex items-center gap-1">
                                                    {link.permissions.map((permission) => (
                                                        <span
                                                            key={permission}
                                                            className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                                                        >
                                                            {permission}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {link.password && (
                                                <span className="text-gray-500">🔒 Password protected</span>
                                            )}
                                        </div>

                                        <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-700">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Review Link:</p>
                                                    <p className="text-sm text-gray-300 font-mono break-all">
                                                        {getReviewUrl(link.token)}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => window.open(getReviewUrl(link.token), '_blank')}
                                                    className="ml-4 p-2 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
                                                    title="Open in new tab"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
