import React, { useState, useEffect } from 'react';
import { getCreditHistory, CreditTransaction } from '../services/creditService';
import { useUserCredits } from '../hooks/useUserCredits';
import { formatCredits, formatPrice } from '../utils/costCalculator';
import { Spinner } from './Spinner';

interface AdminUsageDashboardProps {
  className?: string;
}

export const AdminUsageDashboard: React.FC<AdminUsageDashboardProps> = ({
  className = '',
}) => {
  const { isAdmin, isLoading } = useUserCredits();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  const loadTransactions = async () => {
    setIsLoadingTransactions(true);
    setError(null);
    
    try {
      const history = await getCreditHistory(undefined, 100);
      setTransactions(history);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load transactions');
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadTransactions();
    }
  }, [isAdmin, timeRange]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Spinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`bg-red-900/20 border border-red-500 text-red-300 p-4 rounded-lg ${className}`}>
        <h3 className="font-semibold mb-2">Access Denied</h3>
        <p>This dashboard is only available to administrators.</p>
      </div>
    );
  }

  // Calculate statistics
  const totalCreditsUsed = transactions
    .filter(t => t.type === 'usage' && t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const totalCreditsPurchased = transactions
    .filter(t => t.type === 'purchase' && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalRevenue = transactions
    .filter(t => t.type === 'purchase')
    .reduce((sum, t) => sum + (t.amount * 0.08), 0); // Assuming $0.08 per credit

  const recentTransactions = transactions.slice(0, 20);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Usage Dashboard</h2>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-1 text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={loadTransactions}
            disabled={isLoadingTransactions}
            className="bg-amber-500 hover:bg-amber-600 text-black px-3 py-1 rounded text-sm font-semibold disabled:opacity-50"
          >
            {isLoadingTransactions ? <Spinner size="sm" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Credits Used</h3>
          <div className="text-2xl font-bold text-red-400">
            {formatCredits(totalCreditsUsed)}
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Credits Purchased</h3>
          <div className="text-2xl font-bold text-green-400">
            {formatCredits(totalCreditsPurchased)}
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Estimated Revenue</h3>
          <div className="text-2xl font-bold text-amber-400">
            {formatPrice(totalRevenue)}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-300 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left p-3 text-sm font-semibold text-gray-300">Type</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-300">Amount</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-300">Description</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-300">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-gray-700">
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      transaction.type === 'purchase' ? 'bg-green-900 text-green-300' :
                      transaction.type === 'usage' ? 'bg-red-900 text-red-300' :
                      transaction.type === 'bonus' ? 'bg-blue-900 text-blue-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`font-semibold ${
                      transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}{formatCredits(transaction.amount)}
                    </span>
                  </td>
                  <td className="p-3 text-gray-300 text-sm">
                    {transaction.description}
                  </td>
                  <td className="p-3 text-gray-400 text-sm">
                    {transaction.timestamp.toLocaleDateString()} {transaction.timestamp.toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {recentTransactions.length === 0 && !isLoadingTransactions && (
          <div className="p-8 text-center text-gray-400">
            No transactions found for the selected time range.
          </div>
        )}
      </div>
    </div>
  );
};
