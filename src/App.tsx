import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './lib/store';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Add = lazy(() => import('./pages/Add'));
const Browse = lazy(() => import('./pages/Browse'));
const Cart = lazy(() => import('./pages/Cart'));
const History = lazy(() => import('./pages/History'));
const Finances = lazy(() => import('./pages/Finances'));

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-gray-950">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="add" element={<Add />} />
              <Route path="inventory" element={<Browse />} />
              <Route path="cart" element={<Cart />} />
              <Route path="history" element={<History />} />
              <Route path="ledger" element={<Finances />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
