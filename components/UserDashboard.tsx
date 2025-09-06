// User Dashboard component for managing profile, API keys, and usage
import React, { useState, useEffect } from 'react';
import { UserProfile, getUserProfile, updateUserApiKey, getUserUsageStats, resetCreditsForTesting } from '../services/authService';
import { getCurrentUser } from '../services/authService';
import { API_ENDPOINTS } from '../config/apiConfig';
import { authFetch } from '../lib/authFetch';

interface UserDashboardProps {
  onClose: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ onClose }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [usageStats, setUsageStats] = useState({
    freeCredits: 0,
    totalUsage: 0,
    hasCustomApiKey: false,
    tokenAnalytics: undefined as {
      totalTokens: number;
      totalCost: number;
      tokensByOperation: { [key: string]: number };
      costByOperation: { [key: string]: number };
      tokensByService: { [key: string]: number };
      costByService: { [key: string]: number };
    } | undefined,
  });
  const [customApiKey, setCustomApiKey] = useState('');
  const [falApiKey, setFalApiKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showFalApiKey, setShowFalApiKey] = useState(false);
  const [hasFalApiKey, setHasFalApiKey] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
      const [profile, stats] = await Promise.all([
        getUserProfile(currentUser.uid),
        getUserUsageStats(currentUser.uid),
      ]);

      setUserProfile(profile);
      setUsageStats(stats);
      // Don't load API keys for security - user must re-enter them
      setCustomApiKey('');
      setFalApiKey('');
      
      // Check if user has FAL API key
      try {
        const falKeyResponse = await authFetch(`${API_ENDPOINTS.apiKey.check}?keyType=fal`);
        const falKeyData = await falKeyResponse.json();
        setHasFalApiKey(falKeyData.hasApiKey || false);
      } catch (error) {
        console.error('Error checking FAL API key:', error);
        setHasFalApiKey(false);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleUpdateApiKey = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !customApiKey.trim()) return;

    setIsUpdating(true);
    try {
      // Securely store API key with encryption
      await updateUserApiKey(currentUser.uid, customApiKey.trim(), currentUser.email || '');
      setCustomApiKey(''); // Clear the input for security
      await loadUserData(); // Reload to get updated data
      alert('API key securely stored!');
    } catch (error) {
      console.error('Error updating API key:', error);
      alert('Failed to securely store API key. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearApiKey = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    if (!confirm('Are you sure you want to clear your API key? This action cannot be undone.')) return;

    setIsUpdating(true);
    try {
      // Securely clear API key
      await updateUserApiKey(currentUser.uid, '', currentUser.email || '');
      setCustomApiKey('');
      await loadUserData();
      alert('API key securely cleared!');
    } catch (error) {
      console.error('Error clearing API key:', error);
      alert('Failed to clear API key. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateFalApiKey = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !falApiKey.trim()) return;

    setIsUpdating(true);
    try {
      const response = await authFetch(API_ENDPOINTS.apiKey.store, {
        method: 'POST',
        body: {
          apiKey: falApiKey.trim(),
          keyType: 'fal'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to store FAL API key');
      }

      setFalApiKey('');
      setHasFalApiKey(true);
      alert('FAL API key stored securely! You can now use Pro Polish features.');
    } catch (error) {
      console.error('Error storing FAL API key:', error);
      alert('Failed to store FAL API key. Please check the format and try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearFalApiKey = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    if (!confirm('Are you sure you want to clear your FAL API key? This action cannot be undone.')) return;

    setIsUpdating(true);
    try {
      const response = await authFetch(API_ENDPOINTS.apiKey.remove, {
        method: 'DELETE',
        body: { keyType: 'fal' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear FAL API key');
      }

      setFalApiKey('');
      setHasFalApiKey(false);
      alert('FAL API key securely cleared!');
    } catch (error) {
      console.error('Error clearing FAL API key:', error);
      alert('Failed to clear FAL API key. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-gray-300 mt-4 text-lg">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">User Dashboard</h2>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Editor
          </button>
        </div>
      </div>

        {/* User Profile Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            Profile
          </h3>
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-6">
              {userProfile.photoURL && (
                <img
                  src={userProfile.photoURL}
                  alt="Profile"
                  className="w-20 h-20 rounded-full border-2 border-amber-500/30"
                />
              )}
              <div className="flex-1">
                <h4 className="text-white font-bold text-xl">{userProfile.displayName}</h4>
                <p className="text-gray-300 text-lg">{userProfile.email}</p>
                <p className="text-sm text-gray-400 mt-2">
                  Member since {new Date(userProfile.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Statistics Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            Usage Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-6 text-center border border-green-500/30">
              <div className="text-4xl font-bold text-green-400 mb-2">{usageStats.freeCredits}</div>
              <div className="text-gray-300 font-medium">Free Credits</div>
              <div className="text-sm text-gray-400 mt-1">Available for use</div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-6 text-center border border-blue-500/30">
              <div className="text-4xl font-bold text-blue-400 mb-2">{usageStats.totalUsage}</div>
              <div className="text-gray-300 font-medium">Total Usage</div>
              <div className="text-sm text-gray-400 mt-1">API calls made</div>
            </div>
            <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-xl p-6 text-center border border-amber-500/30">
              <div className="text-4xl font-bold text-amber-400 mb-2">
                {usageStats.hasCustomApiKey ? '✓' : '✗'}
              </div>
              <div className="text-gray-300 font-medium">Custom API Key</div>
              <div className="text-sm text-gray-400 mt-1">
                {usageStats.hasCustomApiKey ? 'Configured' : 'Not set'}
              </div>
            </div>
          </div>
          
          {/* Reset Credits Button for Testing */}
          <div className="mt-6 text-center">
            <button
              onClick={async () => {
                const currentUser = getCurrentUser();
                if (currentUser) {
                  try {
                    await resetCreditsForTesting(currentUser.uid);
                    await loadUserData(); // Reload data
                    alert('Credits reset to 10 for testing!');
                  } catch (error) {
                    console.error('Error resetting credits:', error);
                    alert('Failed to reset credits. Check console for details.');
                  }
                }
              }}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors duration-200 border border-orange-500/30"
            >
              🔄 Reset Credits for Testing
            </button>
            <p className="text-sm text-gray-400 mt-2">
              Development only - resets credits to 10 and usage to 0
            </p>
          </div>
        </div>

        {/* Token Analytics */}
        {usageStats.tokenAnalytics && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              Token Analytics
            </h3>
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-6 text-center border border-purple-500/30">
                  <div className="text-3xl font-bold text-purple-400 mb-2">
                    {usageStats.tokenAnalytics.totalTokens.toLocaleString()}
                  </div>
                  <div className="text-gray-300 font-medium">Total Tokens</div>
                  <div className="text-sm text-gray-400 mt-1">AI tokens consumed</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-900/30 to-indigo-800/20 rounded-xl p-6 text-center border border-indigo-500/30">
                  <div className="text-3xl font-bold text-indigo-400 mb-2">
                    ${usageStats.tokenAnalytics.totalCost.toFixed(4)}
                  </div>
                  <div className="text-gray-300 font-medium">Estimated Cost</div>
                  <div className="text-sm text-gray-400 mt-1">USD value consumed</div>
                </div>
              </div>
              
              {/* Breakdown by Operation */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-white mb-3">Usage by Operation</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(usageStats.tokenAnalytics.tokensByOperation).map(([operation, tokens]) => (
                    <div key={operation} className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 capitalize">{operation.replace('_', ' ')}</span>
                        <div className="text-right">
                          <div className="text-white font-semibold">{tokens.toLocaleString()} tokens</div>
                          <div className="text-sm text-gray-400">
                            ${usageStats.tokenAnalytics.costByOperation[operation]?.toFixed(4) || '0.0000'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown by Service */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Usage by Service</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(usageStats.tokenAnalytics.tokensByService).map(([service, tokens]) => (
                    <div key={service} className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 capitalize">{service === 'firebase' ? 'Firebase AI Logic' : 'Custom API'}</span>
                        <div className="text-right">
                          <div className="text-white font-semibold">{tokens.toLocaleString()} tokens</div>
                          <div className="text-sm text-gray-400">
                            ${usageStats.tokenAnalytics.costByService[service]?.toFixed(4) || '0.0000'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Key Management Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
              </svg>
            </div>
            API Key Management
          </h3>
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <p className="text-gray-300 mb-4">
              Add your own Gemini API key to use your quota after free credits expire. 
              Your API key is encrypted and stored securely. This allows unlimited usage with your own resources.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Gemini API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key (will be encrypted)..."
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateApiKey}
                  disabled={isUpdating || !customApiKey.trim()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
                >
                  {isUpdating ? 'Encrypting...' : 'Store Securely'}
                </button>
                
                {usageStats.hasCustomApiKey && (
                  <button
                    onClick={handleClearApiKey}
                    disabled={isUpdating}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
                  >
                    Clear API Key
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FAL API Key Management Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <svg className="w-6 h-6 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </div>
            FAL API Key Management
          </h3>
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <p className="text-gray-300 mb-4">
              Add your own FAL API key to use Pro Polish features (video upscaling and interpolation) with your own credits. 
              Your API key is encrypted and stored securely. This allows unlimited video enhancement with your own FAL resources.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  FAL API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type={showFalApiKey ? 'text' : 'password'}
                    value={falApiKey}
                    onChange={(e) => setFalApiKey(e.target.value)}
                    placeholder="Enter your FAL API key (will be encrypted)..."
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-orange-500 focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFalApiKey(!showFalApiKey)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  >
                    {showFalApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Format: Your FAL API key (e.g., 7126914c-9ee8-44f8-ba99-4620d2804af7:d6c4efbb379c2e6e7bfa1ee7aebfd46b)
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleUpdateFalApiKey}
                  disabled={isUpdating || !falApiKey.trim()}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
                >
                  {isUpdating ? 'Encrypting...' : 'Store FAL Key Securely'}
                </button>
                
                {hasFalApiKey && (
                  <button
                    onClick={handleClearFalApiKey}
                    disabled={isUpdating}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
                  >
                    Clear FAL Key
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Free Credits Info */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            Free Credits Information
          </h3>
          <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-cyan-300 text-lg mb-3">
                  <strong>Free Credits:</strong> You have {usageStats.freeCredits} free API calls remaining. 
                  Each movie creation uses approximately 3-5 credits (story + images + music + rendering).
                </p>
                <p className="text-cyan-300">
                  <strong>💡 Tip:</strong> Add your own Gemini API key above to use unlimited credits with your own quota!
                </p>
              </div>
            </div>
          </div>
        </div>

    </div>
  );
};

export default UserDashboard;
