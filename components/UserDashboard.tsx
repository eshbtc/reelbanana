// User Dashboard component for managing profile, API keys, and usage
import React, { useState, useEffect } from 'react';
import { UserProfile, getUserProfile, updateUserApiKey, getUserUsageStats } from '../services/authService';
import { getCurrentUser } from '../services/authService';

interface UserDashboardProps {
  onClose: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ onClose }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [usageStats, setUsageStats] = useState({
    freeCredits: 0,
    totalUsage: 0,
    hasCustomApiKey: false,
  });
  const [customApiKey, setCustomApiKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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
      setCustomApiKey(profile?.apiKey || '');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleUpdateApiKey = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !customApiKey.trim()) return;

    setIsUpdating(true);
    try {
      await updateUserApiKey(currentUser.uid, customApiKey.trim());
      await loadUserData(); // Reload to get updated data
      alert('API key updated successfully!');
    } catch (error) {
      console.error('Error updating API key:', error);
      alert('Failed to update API key. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearApiKey = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    setIsUpdating(true);
    try {
      await updateUserApiKey(currentUser.uid, '');
      setCustomApiKey('');
      await loadUserData();
      alert('API key cleared successfully!');
    } catch (error) {
      console.error('Error clearing API key:', error);
      alert('Failed to clear API key. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-center text-gray-300 mt-4">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">User Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Profile Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Profile
          </h3>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center gap-4 mb-4">
              {userProfile.photoURL && (
                <img
                  src={userProfile.photoURL}
                  alt="Profile"
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h4 className="text-white font-semibold">{userProfile.displayName}</h4>
                <p className="text-gray-400">{userProfile.email}</p>
                <p className="text-sm text-gray-500">
                  Member since {new Date(userProfile.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Statistics Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Usage Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{usageStats.freeCredits}</div>
              <div className="text-sm text-gray-400">Free Credits</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{usageStats.totalUsage}</div>
              <div className="text-sm text-gray-400">Total Usage</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {usageStats.hasCustomApiKey ? '✓' : '✗'}
              </div>
              <div className="text-sm text-gray-400">Custom API Key</div>
            </div>
          </div>
        </div>

        {/* API Key Management Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
            </svg>
            API Key Management
          </h3>
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-300 mb-4">
              Add your own Gemini API key to use your quota instead of our free credits. 
              This allows unlimited usage with your own resources.
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
                    placeholder="Enter your Gemini API key..."
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
                  {isUpdating ? 'Updating...' : 'Update API Key'}
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

        {/* Free Credits Info */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Free Credits
          </h3>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300">
              <strong>Free Credits:</strong> You have {usageStats.freeCredits} free API calls remaining. 
              Each movie creation uses approximately 3-5 credits (story + images + music + rendering).
            </p>
            <p className="text-blue-300 mt-2">
              <strong>Tip:</strong> Add your own Gemini API key above to use unlimited credits with your own quota!
            </p>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
