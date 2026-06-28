import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  tags: string[];
  description?: string;
  price?: number;
  image?: string; // base64 data URL or storage path
  boundingBox?: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1)
  addedAt: number; // timestamp
  source: 'camera' | 'text' | 'voice';
}

export interface CartEntry {
  itemId: string;
  name: string;
  quantity: number;
  tags: string[];
  image?: string;
}

export interface Transaction {
  id: string;
  type: 'inbound' | 'outbound';
  purpose: string;
  tags: string[];
  comments?: string;
  items: { name: string; qty: number; price?: number }[];
  totalCost?: number;
  date: number; // timestamp
}

interface StoreState {
  inventory: InventoryItem[];
  cart: CartEntry[];
  history: Transaction[];
  addToInventory: (items: InventoryItem[]) => void;
  removeFromInventory: (id: string) => void;
  setCartQuantity: (itemId: string, name: string, qty: number, tags: string[], image?: string) => void;
  removeFromCart: (itemId: string) => void;
  checkout: (purpose: string, comments?: string) => void;
  cartItemCount: number;
}

const StoreContext = createContext<StoreState | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);

  const addToInventory = useCallback((items: InventoryItem[]) => {
    setInventory(prev => [...items, ...prev]);
  }, []);

  const removeFromInventory = useCallback((id: string) => {
    setInventory(prev => prev.filter(item => item.id !== id));
  }, []);

  const setCartQuantity = useCallback((itemId: string, name: string, qty: number, tags: string[], image?: string) => {
    setCart(prev => {
      const existing = prev.find(e => e.itemId === itemId);
      if (qty <= 0) {
        return prev.filter(e => e.itemId !== itemId);
      }
      if (existing) {
        return prev.map(e => e.itemId === itemId ? { ...e, quantity: qty } : e);
      }
      return [...prev, { itemId, name, quantity: qty, tags, image }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(e => e.itemId !== itemId));
  }, []);

  const checkout = useCallback((purpose: string, comments?: string) => {
    if (cart.length === 0) return;

    // Aggregate all tags from checked-out items
    const allTags = Array.from(new Set(cart.flatMap(e => e.tags)));

    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'outbound',
      purpose,
      tags: allTags,
      comments,
      items: cart.map(e => ({ name: e.name, qty: e.quantity })),
      date: Date.now(),
    };

    setHistory(prev => [tx, ...prev]);

    // Deduct from inventory
    setInventory(prev => {
      const updated = [...prev];
      for (const cartItem of cart) {
        const idx = updated.findIndex(i => i.id === cartItem.itemId);
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            quantity: Math.max(0, updated[idx].quantity - cartItem.quantity),
          };
        }
      }
      return updated.filter(i => i.quantity > 0);
    });

    // Clear cart
    setCart([]);
  }, [cart]);

  const cartItemCount = cart.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <StoreContext.Provider value={{
      inventory, cart, history,
      addToInventory, removeFromInventory,
      setCartQuantity, removeFromCart,
      checkout, cartItemCount,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
