import { useState } from 'react';
import { ChevronDown, ChevronUp, ShoppingCart, Tag, Trash2, Package } from 'lucide-react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';

export default function Cart() {
  const { cart, removeFromCart, checkout, cartItemCount } = useStore();
  const [purpose, setPurpose] = useState('');
  const [comments, setComments] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const navigate = useNavigate();

  const allTags = Array.from(new Set(cart.flatMap(e => e.tags)));

  const handleCheckout = () => {
    if (!purpose.trim()) return;
    checkout(purpose.trim(), comments.trim() || undefined);
    setCheckoutSuccess(true);
    setTimeout(() => {
      setCheckoutSuccess(false);
      navigate('/history');
    }, 1500);
  };

  if (checkoutSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="bg-emerald-50 dark:bg-emerald-950 p-5 rounded-2xl mb-4">
          <ShoppingCart className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold font-heading mb-1">Checked out!</h2>
        <p className="text-sm text-gray-500">Redirecting to history…</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center min-h-[50vh]">
        <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Cart is empty</p>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Browse inventory and add items to your cart.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-heading">Checkout</h2>
        <span className="text-sm text-gray-500">{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {cart.map(entry => (
          <div key={entry.itemId} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {entry.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium truncate">{entry.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">×{entry.quantity}</span>
              <button
                onClick={() => removeFromCart(entry.itemId)}
                className="p-1 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
            Task / Project *
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Job Site 42, Kitchen Renovation…"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
          />
        </div>

        {allTags.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Inherited Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => (
                <span key={tag} className="inline-flex items-center text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md font-medium">
                  <Tag className="w-2.5 h-2.5 mr-1" />
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
          >
            Comments {showComments ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </button>
          {showComments && (
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Job notes…"
              className="w-full mt-2 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all min-h-[60px] resize-none"
            />
          )}
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={!purpose.trim()}
        className="w-full bg-emerald-600 text-white rounded-xl py-3 font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        Confirm Checkout
      </button>
    </div>
  );
}
