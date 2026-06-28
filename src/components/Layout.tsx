import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { CloudOff, Settings, PlusCircle, Home, Wallet, ShoppingCart, History as HistoryIcon, Moon, Sun, Monitor, X, Send, Bot, Search } from 'lucide-react';
import { useEffect, useState, Suspense, useRef } from 'react';
import { useStore } from '../lib/store';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

export default function Layout() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: string, text: string}[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { cartItemCount } = useStore();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [theme]);

  const handleChatCommand = async () => {
    if (!chatInput.trim()) return;
    const inputText = chatInput;
    setChatInput('');
    
    const newMsgs = [...chatMessages, { role: 'user', text: inputText }];
    setChatMessages(newMsgs);

    try {
      const functions = getFunctions(app);
      const agentCommand = httpsCallable(functions, 'agentCommand');
      
      const result = await agentCommand({ text: inputText }) as { data: { action: string, target?: string, payload?: any } };
      const { action, target } = result.data;
      
      let responseText = "Done.";
      if (action === 'NAVIGATE' && target) {
        responseText = `Taking you to ${target}…`;
        setChatMessages(prev => [...prev, { role: 'agent', text: responseText }]);
        setTimeout(() => {
          navigate(target);
          setIsChatOpen(false);
        }, 800);
      } else {
        responseText = "I'm not sure how to do that yet.";
        setChatMessages(prev => [...prev, { role: 'agent', text: responseText }]);
      }
      
    } catch (err) {
      console.error("Agent command error:", err);
      // Fallback
      const textLower = inputText.toLowerCase();
      let responseText = "I'll help you with that. Try being more specific, like 'add 5 tubes of caulk'.";
      let actionTarget: string | null = null;

      if (textLower.includes('add')) {
        responseText = "Taking you to Add to Inventory…";
        actionTarget = '/add';
      } else if (textLower.includes('cart') || textLower.includes('checkout')) {
        responseText = "Opening your cart…";
        actionTarget = '/cart';
      } else if (textLower.includes('history')) {
        responseText = "Showing transaction history…";
        actionTarget = '/history';
      } else if (textLower.includes('finance') || textLower.includes('ledger') || textLower.includes('money')) {
        responseText = "Opening the ledger…";
        actionTarget = '/ledger';
      } else if (textLower.includes('browse') || textLower.includes('inventory') || textLower.includes('find') || textLower.includes('search')) {
        responseText = "Opening inventory browser…";
        actionTarget = '/inventory';
      }

      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'agent', text: responseText }]);
        if (actionTarget) {
          setTimeout(() => {
            navigate(actionTarget!);
            setIsChatOpen(false);
          }, 800);
        }
      }, 400);
    }
  };

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Add', path: '/add', icon: PlusCircle },
    { name: 'Browse', path: '/inventory', icon: Search },
    { name: 'Cart', path: '/cart', icon: ShoppingCart, badge: cartItemCount },
    { name: 'History', path: '/history', icon: HistoryIcon },
    { name: 'Finance', path: '/ledger', icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="max-w-2xl mx-auto min-h-screen flex flex-col relative">

        {/* ── Top Bar ── */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Logo */}
            <button onClick={() => navigate('/')} className="flex items-baseline gap-0.5 select-none cursor-pointer">
              <span className="text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400 font-heading">Stor</span>
              <span className="text-lg font-bold tracking-tight text-gray-400 dark:text-gray-500 font-heading">-</span>
              <span className="text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400 font-heading">agent</span>
            </button>

            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
                {([
                  { key: 'light' as const, icon: Sun, label: 'Light' },
                  { key: 'system' as const, icon: Monitor, label: 'System' },
                  { key: 'dark' as const, icon: Moon, label: 'Dark' },
                ]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    aria-label={t.label}
                    className={`p-1.5 rounded-md transition-all ${
                      theme === t.key
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {isOffline && (
                <div className="flex items-center text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-1 rounded-md text-xs font-medium">
                  <CloudOff className="w-3 h-3 mr-1" />
                  Offline
                </div>
              )}

              <button
                onClick={() => setSettingsOpen(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Global Gemini Bar ── */}
          <div className="px-4 pb-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Bot className="h-4 w-4 text-amber-500" />
              </div>
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => setIsChatOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChatCommand(); }}
                className="w-full pl-9 pr-10 py-2 rounded-xl text-sm bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white outline-none transition-all font-body"
                placeholder='try: "Add 5 tubes of caulk", or ask anything…'
              />
              {chatInput && (
                <button
                  onClick={handleChatCommand}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Chat Popup */}
            {isChatOpen && (
              <div className="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-gray-900 rounded-xl shadow-2xl shadow-black/20 border border-gray-200 dark:border-gray-700 z-50 overflow-hidden max-h-72 flex flex-col">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Agent</span>
                  <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {chatMessages.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Ask me anything about your inventory.</p>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-sm ${
                          msg.role === 'user'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-auto px-4 py-5 pb-24">
          <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>

        {/* ── Bottom Navigation ── */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60">
          <div className="max-w-2xl mx-auto flex items-center justify-around px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `relative flex flex-col items-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">{item.name}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-0.5 right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full px-1">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* ── Settings Modal ── */}
        {settingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-80 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white">Settings</h3>
                <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Theme</label>
                  <div className="flex gap-2">
                    {(['light', 'system', 'dark'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all cursor-pointer ${
                          theme === t
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Sync Status</label>
                  <div className={`flex items-center gap-2 text-sm ${isOffline ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                    {isOffline ? 'Offline — changes will sync when reconnected' : 'Connected'}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400">Stor-agent v0.1.0</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
