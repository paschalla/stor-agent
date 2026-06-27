import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Browse from './pages/Browse';
import Finances from './pages/Finances';
import Summary from './pages/Summary';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="browse" element={<Browse />} />
          <Route path="finances" element={<Finances />} />
          <Route path="summary" element={<Summary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
