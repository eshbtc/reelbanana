import React, { useState, useEffect } from 'react';
import { BrandKit } from '../types';
import { 
    createBrandKit, 
    getUserBrandKits, 
    updateBrandKit, 
    deleteBrandKit, 
    uploadBrandKitLogo,
    getDefaultBrandKit 
} from '../services/brandKitService';
import { useUserPlan } from '../hooks/useUserPlan';
import { EnhancedUpgradePrompt } from './EnhancedUpgradePrompt';
import { checkPlanGate } from '../services/planGatingService';
import { Plus, Edit, Trash2, Upload, Palette, Type, MessageSquare, FileText } from 'lucide-react';

interface BrandKitManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect?: (brandKit: BrandKit) => void;
}

export const BrandKitManager: React.FC<BrandKitManagerProps> = ({
    isOpen,
    onClose,
    onSelect
}) => {
    const { planTier } = useUserPlan();
    const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingKit, setEditingKit] = useState<BrandKit | null>(null);
    const [gateResult, setGateResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        primaryColor: '#F59E0B',
        secondaryColor: '#1F2937',
        accentColor: '#EF4444',
        fontFamily: 'Inter',
        brandVoice: '',
        brandGuidelines: ''
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);

    useEffect(() => {
        if (isOpen) {
            checkPermissions();
            loadBrandKits();
        }
    }, [isOpen]);

    const checkPermissions = async () => {
        try {
            const result = await checkPlanGate({ feature: 'custom_branding' });
            setGateResult(result);
        } catch (error) {
            console.error('Error checking permissions:', error);
        }
    };

    const loadBrandKits = async () => {
        try {
            setIsLoading(true);
            const kits = await getUserBrandKits();
            setBrandKits(kits);
        } catch (error) {
            console.error('Error loading brand kits:', error);
            setError('Failed to load brand kits');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            setIsCreating(true);
            setError(null);

            let logoUrl = '';
            if (logoFile) {
                logoUrl = await uploadBrandKitLogo(logoFile, 'temp');
            }

            const brandKitData = {
                ...formData,
                logo: logoUrl || undefined
            };

            const brandKitId = await createBrandKit(brandKitData);
            
            // Reload brand kits
            await loadBrandKits();
            
            // Reset form
            setFormData({
                name: '',
                description: '',
                primaryColor: '#F59E0B',
                secondaryColor: '#1F2937',
                accentColor: '#EF4444',
                fontFamily: 'Inter',
                brandVoice: '',
                brandGuidelines: ''
            });
            setLogoFile(null);
            setIsCreating(false);
        } catch (error) {
            console.error('Error creating brand kit:', error);
            setError(error instanceof Error ? error.message : 'Failed to create brand kit');
            setIsCreating(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingKit) return;

        try {
            setIsCreating(true);
            setError(null);

            let logoUrl = editingKit.logo;
            if (logoFile) {
                logoUrl = await uploadBrandKitLogo(logoFile, editingKit.id);
            }

            const updates = {
                ...formData,
                logo: logoUrl || undefined
            };

            await updateBrandKit(editingKit.id, updates);
            
            // Reload brand kits
            await loadBrandKits();
            
            // Reset form
            setEditingKit(null);
            setFormData({
                name: '',
                description: '',
                primaryColor: '#F59E0B',
                secondaryColor: '#1F2937',
                accentColor: '#EF4444',
                fontFamily: 'Inter',
                brandVoice: '',
                brandGuidelines: ''
            });
            setLogoFile(null);
            setIsCreating(false);
        } catch (error) {
            console.error('Error updating brand kit:', error);
            setError(error instanceof Error ? error.message : 'Failed to update brand kit');
            setIsCreating(false);
        }
    };

    const handleDelete = async (brandKitId: string) => {
        if (!confirm('Are you sure you want to delete this brand kit?')) return;

        try {
            await deleteBrandKit(brandKitId);
            await loadBrandKits();
        } catch (error) {
            console.error('Error deleting brand kit:', error);
            setError(error instanceof Error ? error.message : 'Failed to delete brand kit');
        }
    };

    const handleEdit = (brandKit: BrandKit) => {
        setEditingKit(brandKit);
        setFormData({
            name: brandKit.name,
            description: brandKit.description || '',
            primaryColor: brandKit.primaryColor || '#F59E0B',
            secondaryColor: brandKit.secondaryColor || '#1F2937',
            accentColor: brandKit.accentColor || '#EF4444',
            fontFamily: brandKit.fontFamily || 'Inter',
            brandVoice: brandKit.brandVoice || '',
            brandGuidelines: brandKit.brandGuidelines || ''
        });
    };

    const handleSelect = (brandKit: BrandKit) => {
        onSelect?.(brandKit);
        onClose();
    };

    if (!isOpen) return null;

    const defaultBrandKit = getDefaultBrandKit();
    const allBrandKits = [defaultBrandKit, ...brandKits];

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h2 className="text-2xl font-bold text-white">Brand Kits</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    {/* Plan Gating */}
                    {gateResult && !gateResult.allowed && (
                        <EnhancedUpgradePrompt
                            gateResult={gateResult}
                            variant="banner"
                            className="mb-6"
                        />
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-500 text-red-300 p-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    {/* Brand Kits Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        {allBrandKits.map((kit) => (
                            <div
                                key={kit.id}
                                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-white">{kit.name}</h3>
                                    {!kit.isDefault && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(kit)}
                                                className="text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(kit.id)}
                                                className="text-gray-400 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {kit.description && (
                                    <p className="text-sm text-gray-300 mb-3">{kit.description}</p>
                                )}

                                {/* Color Palette */}
                                <div className="flex gap-2 mb-3">
                                    {kit.primaryColor && (
                                        <div
                                            className="w-6 h-6 rounded-full border border-gray-600"
                                            style={{ backgroundColor: kit.primaryColor }}
                                            title="Primary Color"
                                        />
                                    )}
                                    {kit.secondaryColor && (
                                        <div
                                            className="w-6 h-6 rounded-full border border-gray-600"
                                            style={{ backgroundColor: kit.secondaryColor }}
                                            title="Secondary Color"
                                        />
                                    )}
                                    {kit.accentColor && (
                                        <div
                                            className="w-6 h-6 rounded-full border border-gray-600"
                                            style={{ backgroundColor: kit.accentColor }}
                                            title="Accent Color"
                                        />
                                    )}
                                </div>

                                {/* Brand Details */}
                                <div className="space-y-2 text-sm text-gray-400">
                                    {kit.fontFamily && (
                                        <div className="flex items-center gap-2">
                                            <Type className="w-4 h-4" />
                                            <span>{kit.fontFamily}</span>
                                        </div>
                                    )}
                                    {kit.brandVoice && (
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4" />
                                            <span className="truncate">{kit.brandVoice}</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleSelect(kit)}
                                    className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg transition-colors"
                                >
                                    {kit.isDefault ? 'Use Default' : 'Select Kit'}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Create/Edit Form */}
                    {gateResult?.allowed && (
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">
                                {editingKit ? 'Edit Brand Kit' : 'Create New Brand Kit'}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                            placeholder="My Brand Kit"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                            rows={3}
                                            placeholder="Describe your brand..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Logo
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                        />
                                    </div>
                                </div>

                                {/* Colors */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Primary Color
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={formData.primaryColor}
                                                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                                className="w-12 h-10 rounded border border-gray-700"
                                            />
                                            <input
                                                type="text"
                                                value={formData.primaryColor}
                                                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Secondary Color
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={formData.secondaryColor}
                                                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                                className="w-12 h-10 rounded border border-gray-700"
                                            />
                                            <input
                                                type="text"
                                                value={formData.secondaryColor}
                                                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Accent Color
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={formData.accentColor}
                                                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                                                className="w-12 h-10 rounded border border-gray-700"
                                            />
                                            <input
                                                type="text"
                                                value={formData.accentColor}
                                                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Font Family
                                        </label>
                                        <select
                                            value={formData.fontFamily}
                                            onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                        >
                                            <option value="Inter">Inter</option>
                                            <option value="Roboto">Roboto</option>
                                            <option value="Open Sans">Open Sans</option>
                                            <option value="Lato">Lato</option>
                                            <option value="Montserrat">Montserrat</option>
                                            <option value="Poppins">Poppins</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Brand Voice */}
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Brand Voice
                                </label>
                                <textarea
                                    value={formData.brandVoice}
                                    onChange={(e) => setFormData({ ...formData, brandVoice: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                    rows={3}
                                    placeholder="Describe your brand's tone and personality..."
                                />
                            </div>

                            {/* Brand Guidelines */}
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Brand Guidelines
                                </label>
                                <textarea
                                    value={formData.brandGuidelines}
                                    onChange={(e) => setFormData({ ...formData, brandGuidelines: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                    rows={4}
                                    placeholder="Additional brand guidelines and usage rules..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={editingKit ? handleUpdate : handleCreate}
                                    disabled={isCreating || !formData.name.trim()}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
                                >
                                    {isCreating ? 'Saving...' : (editingKit ? 'Update Kit' : 'Create Kit')}
                                </button>
                                {editingKit && (
                                    <button
                                        onClick={() => {
                                            setEditingKit(null);
                                            setFormData({
                                                name: '',
                                                description: '',
                                                primaryColor: '#F59E0B',
                                                secondaryColor: '#1F2937',
                                                accentColor: '#EF4444',
                                                fontFamily: 'Inter',
                                                brandVoice: '',
                                                brandGuidelines: ''
                                            });
                                            setLogoFile(null);
                                        }}
                                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};




