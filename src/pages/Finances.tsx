import { useState, useMemo } from 'react';
import { Calendar, Tag, TrendingDown, Wallet } from 'lucide-react';
import { useStore } from '../lib/store';

export default function Finances() {
  const { history } = useStore();
  const [viewMode, setViewMode] = useState<'date' | 'project'>('date');

  // Aggregate financial data
  const totalExpenditure = useMemo(() => {
    return history.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => s + (item.price ?? 0) * item.qty, 0);
    }, 0);
  }, [history]);

  // Group by date (day)
  const byDate = useMemo(() => {
    const groups: Record<string, { label: string; total: number; items: { name: string; qty: number; price?: number }[] }> = {};
    history.forEach(tx => {
      const d = new Date(tx.date);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (!groups[key]) groups[key] = { label, total: 0, items: [] };
      tx.items.forEach(item => {
        const cost = (item.price ?? 0) * item.qty;
        groups[key].total += cost;
        groups[key].items.push(item);
      });
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [history]);

  // Group by project/purpose
  const byProject = useMemo(() => {
    const groups: Record<string, { total: number; count: number }> = {};
    history.forEach(tx => {
      const key = tx.purpose;
      if (!groups[key]) groups[key] = { total: 0, count: 0 };
      groups[key].count++;
      tx.items.forEach(item => {
        groups[key].total += (item.price ?? 0) * item.qty;
      });
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.total - a.total);
  }, [history]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold font-heading">Finances</h2>

      {/* Summary card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Expenditures</p>
        <div className="text-3xl font-bold mb-4">
          ${totalExpenditure.toFixed(2)}
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('date')}
            className={`flex-1 flex items-center justify-center py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
              viewMode === 'date'
                ? 'bg-white dark:bg-gray-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" /> By Date
          </button>
          <button
            onClick={() => setViewMode('project')}
            className={`flex-1 flex items-center justify-center py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
              viewMode === 'project'
                ? 'bg-white dark:bg-gray-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" /> By Project
          </button>
        </div>
      </div>

      {/* Data */}
      <div className="space-y-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <Wallet className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No financial data yet.</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Add prices when inputting items to track expenditures.</p>
          </div>
        ) : viewMode === 'date' ? (
          byDate.map(([key, group]) => (
            <div key={key} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-500">{group.label}</span>
                <span className="text-sm font-semibold">${group.total.toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{item.name} ×{item.qty}</span>
                    {item.price != null && <span>${(item.price * item.qty).toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          byProject.map(([name, data]) => (
            <div key={name} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-gray-400">{data.count} transaction{data.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                ${data.total.toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
