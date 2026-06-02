import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PokerEquityCalculator from './PokerEquityCalculator';
import Profiles from './components/config/Profiles';
import Situations from './components/config/Situations';
import Strategies from './components/config/Strategies';

function App() {
  console.log("App component rendering...");
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PokerEquityCalculator />} />
          <Route path="config/profiles" element={<Profiles />} />
          <Route path="config/situations" element={<Situations />} />
          <Route path="config/strategies" element={<Strategies />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
