import { PackageOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';

export default function Dashboard() {
  const { inventory } = useStore();

  if (inventory.length > 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-heading">Your Inventory</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{inventory.length} item{inventory.length !== 1 ? 's' : ''} tracked</p>
        <div className="grid gap-3">
          {inventory.slice(0, 6).map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm shrink-0">
                {item.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-xs text-gray-400">×{item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
        {inventory.length > 6 && (
          <Link to="/inventory" className="text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
            View all {inventory.length} items →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh] px-6">
      <div className="bg-emerald-50 dark:bg-emerald-950 p-5 rounded-2xl mb-5">
        <PackageOpen className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-xl font-bold font-heading mb-2">No items yet!</h2>
      <Link
        to="/add"
        className="group inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-5 rounded-xl shadow-sm hover:shadow-md active:scale-[0.97] transition-all mt-4 cursor-pointer"
      >
        Add to Inventory <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
