import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Search, ClipboardList } from 'lucide-react';
import { useStore } from '../lib/store';

export default function History() {
  const { history } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = searchTerm
    ? history.filter(tx =>
        tx.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tx.tags.some(t => t.includes(searchTerm.toLowerCase()))
      )
    : history;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold font-heading">History</h2>

      {history.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
          />
        </div>
      )}

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center min-h-[40vh]">
          <ClipboardList className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No transactions yet.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Checkout items from your cart to see them here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((tx) => (
            <div key={tx.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="p-3 flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${
                  tx.type === 'inbound'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                }`}>
                  {tx.type === 'inbound'
                    ? <ArrowUpFromLine className="w-4 h-4" />
                    : <ArrowDownToLine className="w-4 h-4" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-sm">{tx.purpose}</h3>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatDate(tx.date)}</span>
                  </div>
                  {tx.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tx.tags.map(t => (
                        <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                <ul className="space-y-1">
                  {tx.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 dark:text-gray-300">{item.name}</span>
                      <span className="font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                        ×{item.qty}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {tx.comments && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400 italic">{tx.comments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
