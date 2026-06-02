import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { RangeSelector } from '../RangeSelector';

const categoryNames: Record<string, string> = {
  'StraightFlush': 'Quinte Flush',
  'FourOfAKind': 'Carré',
  'FullHouse': 'Full',
  'Flush': 'Couleur',
  'Straight': 'Quinte',
  'Set': 'Brelan (Set)',
  'Trips': 'Brelan (Trips)',
  'TwoPairBothHoleCards': 'Double Paire',
  'TwoPairOneHoleCard': 'Double Paire (1 carte board)',
  'Overpair': 'Overpair',
  'TopPair': 'Top Pair',
  'SecondPair': 'Seconde Paire',
  'ThirdPair': 'Troisième Paire',
  'IntermediatePair': 'Paire Intermédiaire',
  'Underpair': 'Underpair',
  'SmallPair': 'Petite Paire',
  'OnePair': 'Paire',
  'HighCard': 'Hauteur',
  'Overcard': 'Overcard',
  'Oesd2Card': 'OESD (2card)',
  'Oesd1Card': 'OESD (1card)',
  'FlushDraw': 'Flushdraw',
  'Gutshot2Card': 'Gutshot (2card)',
  'Gutshot1Card': 'Gutshot (1card)',
  'ComboDraw': 'Combo draw',
  'OesdAndFd': 'OESD + FD',
  'GutshotAndFd': 'Gutshot + FD',
  'BackdoorFlushDraw': 'Backdoor flushdraw',
  'BackdoorStraightDraw': 'Backdoor quinte',
  'Nothing': 'Nothing'
};

const madeHandsSet = new Set([
  'StraightFlush', 'FourOfAKind', 'FullHouse', 'Flush', 'Straight', 
  'Set', 'Trips', 'TwoPairBothHoleCards', 'TwoPairOneHoleCard', 
  'Overpair', 'TopPair', 'SecondPair', 'ThirdPair', 'IntermediatePair', 'Underpair', 'SmallPair',
  'OnePair'
]);

interface Profile {
  id: number;
  name: string;
}

interface Strategy {
  id: number;
  title?: string;
  profile_id: number;
  parent_strategy_id: number | null;
  street: string;
  strategy_data: any;
  created_at: string;
}

const Strategies: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState<Partial<Strategy>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [strategiesRes, profilesRes] = await Promise.all([
        fetch('http://localhost:3000/api/config/strategies'),
        fetch('http://localhost:3000/api/config/profiles')
      ]);

      if (!strategiesRes.ok || !profilesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [strategiesData, profilesData] = await Promise.all([
        strategiesRes.json(),
        profilesRes.json()
      ]);

      setStrategies(strategiesData);
      setProfiles(profilesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchStrategies = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/config/strategies');
      if (!response.ok) throw new Error('Failed to fetch strategies');
      const data = await response.json();
      setStrategies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUpdate = !!currentStrategy.id;
    const url = isUpdate 
      ? `http://localhost:3000/api/config/strategies/${currentStrategy.id}`
      : 'http://localhost:3000/api/config/strategies';
    
    try {
      // Ensure strategy_data is valid JSON
      let strategyDataObj = currentStrategy.strategy_data;
      if (typeof strategyDataObj === 'string') {
        try {
          strategyDataObj = JSON.parse(strategyDataObj);
        } catch (e) {
          throw new Error("Le format JSON pour strategy_data est invalide");
        }
      }

      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentStrategy.title || null,
          profile_id: currentStrategy.profile_id ? parseInt(currentStrategy.profile_id.toString()) : (profiles[0]?.id || 0),
          parent_strategy_id: currentStrategy.parent_strategy_id ? parseInt(currentStrategy.parent_strategy_id.toString()) : null,
          street: currentStrategy.street || 'PREFLOP',
          strategy_data: strategyDataObj || {},
        }),
      });

      if (!response.ok) throw new Error('Failed to save strategy');
      
      setIsEditing(false);
      setCurrentStrategy({});
      fetchStrategies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette stratégie ?')) return;
    
    try {
      const response = await fetch(`http://localhost:3000/api/config/strategies/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete strategy');
      fetchStrategies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getProfileName = (id: number) => profiles.find(p => p.id === id)?.name || id;
  const getStrategyTitle = (id: number) => {
    const strat = strategies.find(s => s.id === id);
    return strat ? (strat.title || `Stratégie #${strat.id}`) : id;
  };

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestion des Stratégies</h2>
        <button
          onClick={() => { setIsEditing(true); setCurrentStrategy({ street: 'PREFLOP', strategy_data: {} }); }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Stratégie
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isEditing && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Titre (Optionnel)</label>
              <input
                type="text"
                value={currentStrategy.title || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, title: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                placeholder="Ex: Stratégie GTO 100bb"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Profile</label>
              <select
                required
                value={currentStrategy.profile_id || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, profile_id: parseInt(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
              >
                <option value="">Sélectionner un profil</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Street</label>
              <select
                value={currentStrategy.street || 'PREFLOP'}
                onChange={e => setCurrentStrategy({...currentStrategy, street: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
              >
                <option value="PREFLOP">PREFLOP</option>
                <option value="FLOP">FLOP</option>
                <option value="TURN">TURN</option>
                <option value="RIVER">RIVER</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stratégie Parente (Optionnel)</label>
              <select
                value={currentStrategy.parent_strategy_id || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, parent_strategy_id: e.target.value ? parseInt(e.target.value) : null})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
              >
                <option value="">Aucune</option>
                {strategies.filter(s => s.id !== currentStrategy.id).map(s => (
                  <option key={s.id} value={s.id}>{s.title || `Stratégie #${s.id} (${getProfileName(s.profile_id)})`}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Strategy Data</label>
              {currentStrategy.street === 'PREFLOP' ? (
                <div className="border rounded-md p-4 bg-white flex justify-center">
                  <RangeSelector
                    selectedHands={currentStrategy.strategy_data || {}}
                    onChange={(action) => {
                      setCurrentStrategy(prev => {
                        const currentData = prev.strategy_data || {};
                        const newData = typeof action === 'function' ? action(currentData) : action;
                        return { ...prev, strategy_data: newData };
                      });
                    }}
                  />
                </div>
              ) : (
                <div className="border rounded-md p-4 bg-white space-y-6">
                  <div>
                    <h4 className="font-bold text-gray-800 mb-3 border-b pb-1">Mains faites (pair+)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {Object.keys(categoryNames).filter(k => madeHandsSet.has(k)).map(cat => (
                        <div key={cat} className="flex flex-col space-y-1">
                          <label className="text-sm font-medium text-gray-700 truncate" title={categoryNames[cat]}>{categoryNames[cat]}</label>
                          <select
                            value={currentStrategy.strategy_data?.[cat] ?? 0}
                            onChange={(e) => {
                              const newData = { ...(currentStrategy.strategy_data || {}) };
                              newData[cat] = parseInt(e.target.value);
                              setCurrentStrategy({...currentStrategy, strategy_data: newData});
                            }}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-1 border bg-white text-sm"
                          >
                            <option value={100}>100%</option>
                            <option value={75}>75%</option>
                            <option value={50}>50%</option>
                            <option value={25}>25%</option>
                            <option value={0}>0%</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 mb-3 border-b pb-1">Le reste</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {Object.keys(categoryNames).filter(k => !madeHandsSet.has(k)).map(cat => (
                        <div key={cat} className="flex flex-col space-y-1">
                          <label className="text-sm font-medium text-gray-700 truncate" title={categoryNames[cat]}>{categoryNames[cat]}</label>
                          <select
                            value={currentStrategy.strategy_data?.[cat] ?? 0}
                            onChange={(e) => {
                              const newData = { ...(currentStrategy.strategy_data || {}) };
                              newData[cat] = parseInt(e.target.value);
                              setCurrentStrategy({...currentStrategy, strategy_data: newData});
                            }}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-1 border bg-white text-sm"
                          >
                            <option value={100}>100%</option>
                            <option value={75}>75%</option>
                            <option value={50}>50%</option>
                            <option value={25}>25%</option>
                            <option value={0}>0%</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titre / ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Street</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data (Aperçu)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {strategies.map(strategy => (
              <tr key={strategy.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {strategy.title || `Stratégie #${strategy.id}`}
                  {strategy.parent_strategy_id && (
                    <div className="text-xs text-gray-500 font-normal mt-1">
                      Parent: {getStrategyTitle(strategy.parent_strategy_id)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-medium text-blue-600">{getProfileName(strategy.profile_id)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${strategy.street === 'PREFLOP' ? 'bg-green-100 text-green-800' : 
                      strategy.street === 'FLOP' ? 'bg-blue-100 text-blue-800' : 
                      strategy.street === 'TURN' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'}`}>
                    {strategy.street}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                  {JSON.stringify(strategy.strategy_data)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => { 
                      let parsedData = strategy.strategy_data;
                      if (typeof parsedData === 'string') {
                        try { parsedData = JSON.parse(parsedData); } catch(e) { parsedData = {}; }
                      }
                      setIsEditing(true); 
                      setCurrentStrategy({...strategy, strategy_data: parsedData}); 
                    }}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(strategy.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Strategies;
