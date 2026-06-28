import { useState, useMemo } from 'react';
import { Minus, Plus, Package, Search } from 'lucide-react';
import { useStore } from '../lib/store';

export default function Browse() {
  const { inventory, cart, setCartQuantity } = useStore();
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    inventory.forEach(item => item.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [inventory]);

  // Filter items
  const filtered = useMemo(() => {
    let items = inventory;
    if (filterTag) items = items.filter(i => i.tags.includes(filterTag));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.tags.some(t => t.includes(q))
      );
    }
    return items;
  }, [inventory, filterTag, searchTerm]);

  const getCartQty = (itemId: string) => cart.find(c => c.itemId === itemId)?.quantity ?? 0;

  if (inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center min-h-[50vh]">
        <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">No inventory yet.</p>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Add items first, then browse them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold font-heading">Browse Inventory</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter items…"
          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
        />
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterTag(null)}
            className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              !filterTag
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterTag === tag
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No items match your filter.</p>
        ) : (
          filtered.map(item => {
            const cartQty = getCartQty(item.id);
            return (
              <div key={item.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3">
                {/* Thumbnail or letter */}
                <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                  {item.image ? (
                    <img src={item.image} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {item.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-400">×{item.quantity} in stock</span>
                    {item.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>
                    ))}
                  </div>
                </div>

                {/* Cart quantity selector */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setCartQuantity(item.id, item.name, cartQty - 1, item.tags, item.image)}
                    disabled={cartQty === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-gray-700 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className={`w-7 text-center text-sm font-semibold ${cartQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    {cartQty}
                  </span>
                  <button
                    onClick={() => setCartQuantity(item.id, item.name, cartQty + 1, item.tags, item.image)}
                    disabled={cartQty >= item.quantity}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm cursor-pointer hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
