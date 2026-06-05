import React, { useState, useEffect, useMemo } from 'react';
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
  'BackdoorFlushDraw1Card': '1 card backdoor flushdraw',
  'BackdoorFlushDraw2Card': '2 card backdoor flushdraw',
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
  pot_size_bb?: number;
  hero_action?: 'BET' | 'CALL' | 'CHECK';
  action_size?: string;
  action_vilain?: string;
  position_relative?: 'OOP' | 'IP';
  position_preflop?: 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
  strategy_data: any;
  created_at: string;
}

interface OrderedStrategy {
  strategy: Strategy;
  depth: number;
}

const buildOrderedStrategies = (strategies: Strategy[]): OrderedStrategy[] => {
  const childrenByParent = new Map<number | null, Strategy[]>();

  for (const strategy of strategies) {
    const parentId = strategy.parent_strategy_id;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)!.push(strategy);
  }

  const sortById = (a: Strategy, b: Strategy) => a.id - b.id;
  const result: OrderedStrategy[] = [];
  const visited = new Set<number>();

  const visit = (parentId: number | null, depth: number) => {
    const children = (childrenByParent.get(parentId) || []).sort(sortById);
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push({ strategy: child, depth });
      visit(child.id, depth + 1);
    }
  };

  visit(null, 0);

  for (const strategy of [...strategies].sort(sortById)) {
    if (!visited.has(strategy.id)) {
      result.push({ strategy, depth: 0 });
    }
  }

  return result;
};

const Strategies: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState<Partial<Strategy>>({});

  const getStrategyValue = (cat: string, data: any) => {
    if (!data) return 0;
    if (data[cat] !== undefined) return data[cat];
    // Fallback for old BackdoorFlushDraw keys
    if ((cat === 'BackdoorFlushDraw1Card' || cat === 'BackdoorFlushDraw2Card') && data['BackdoorFlushDraw'] !== undefined) {
      return data['BackdoorFlushDraw'];
    }
    return 0;
  };

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

      strategyDataObj = strategyDataObj || {};

      // Toujours sauvegarder toutes les catégories (même à zéro) pour le postflop
      if (currentStrategy.street !== 'PREFLOP') {
        Object.keys(categoryNames).forEach(cat => {
          strategyDataObj[cat] = getStrategyValue(cat, strategyDataObj);
        });
      }

      const isPreflop = currentStrategy.street === 'PREFLOP';

      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentStrategy.title || null,
          profile_id: currentStrategy.profile_id ? parseInt(currentStrategy.profile_id.toString()) : (profiles[0]?.id || 0),
          parent_strategy_id: currentStrategy.parent_strategy_id ? parseInt(currentStrategy.parent_strategy_id.toString()) : null,
          street: currentStrategy.street || 'PREFLOP',
          pot_size_bb: currentStrategy.pot_size_bb ? parseFloat(currentStrategy.pot_size_bb.toString()) : null,
          hero_action: currentStrategy.hero_action || null,
          action_size: (currentStrategy.hero_action === 'BET' || currentStrategy.hero_action === 'CALL') ? (currentStrategy.action_size || null) : null,
          action_vilain: currentStrategy.action_vilain || null,
          position_relative: !isPreflop ? (currentStrategy.position_relative || null) : null,
          position_preflop: isPreflop ? (currentStrategy.position_preflop || null) : null,
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

  const orderedStrategies = useMemo(
    () => buildOrderedStrategies(strategies),
    [strategies]
  );

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
                onChange={e => {
                  const street = e.target.value;
                  setCurrentStrategy({
                    ...currentStrategy,
                    street,
                    position_relative: street === 'PREFLOP' ? undefined : currentStrategy.position_relative,
                    position_preflop: street !== 'PREFLOP' ? undefined : currentStrategy.position_preflop,
                  });
                }}
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
            <div>
              <label className="block text-sm font-medium text-gray-700">Taille du Pot (bb)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentStrategy.pot_size_bb ?? ''}
                onChange={e => setCurrentStrategy({...currentStrategy, pot_size_bb: e.target.value ? parseFloat(e.target.value) : undefined})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                placeholder="Ex: 5.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Action Hero</label>
              <select
                value={currentStrategy.hero_action || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, hero_action: e.target.value as any})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
              >
                <option value="">Sélectionner une action</option>
                <option value="BET">Bet / Raise</option>
                <option value="CALL">Call</option>
                <option value="CHECK">Check</option>
              </select>
            </div>
            {(currentStrategy.hero_action === 'BET' || currentStrategy.hero_action === 'CALL') && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Taille de l'action</label>
                <input
                  type="text"
                  value={currentStrategy.action_size || ''}
                  onChange={e => setCurrentStrategy({...currentStrategy, action_size: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  placeholder="Ex: 33%, 3bb, All-in"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Action Vilain</label>
              <input
                type="text"
                value={currentStrategy.action_vilain || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, action_vilain: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                placeholder="Ex: Open 2.5bb, Check, Bet 33%"
              />
            </div>
            {currentStrategy.street === 'PREFLOP' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Position Preflop</label>
                <select
                  value={currentStrategy.position_preflop || ''}
                  onChange={e => setCurrentStrategy({...currentStrategy, position_preflop: e.target.value as Strategy['position_preflop'] || undefined})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
                >
                  <option value="">Sélectionner une position</option>
                  <option value="UTG">UTG</option>
                  <option value="HJ">HJ</option>
                  <option value="CO">CO</option>
                  <option value="BTN">BTN</option>
                  <option value="SB">SB</option>
                  <option value="BB">BB</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">Position Relative</label>
                <select
                  value={currentStrategy.position_relative || ''}
                  onChange={e => setCurrentStrategy({...currentStrategy, position_relative: e.target.value as Strategy['position_relative'] || undefined})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
                >
                  <option value="">Sélectionner une position</option>
                  <option value="OOP">OOP (Out of Position)</option>
                  <option value="IP">IP (In Position)</option>
                </select>
              </div>
            )}
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
                            value={getStrategyValue(cat, currentStrategy.strategy_data)}
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
                            value={getStrategyValue(cat, currentStrategy.strategy_data)}
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

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-[30%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titre / ID</th>
              <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</th>
              <th className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Street</th>
              <th className="w-[33%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contexte</th>
              <th className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orderedStrategies.map(({ strategy, depth }) => (
              <tr key={strategy.id}>
                <td
                  className="px-6 py-4 text-sm font-medium text-gray-900"
                  style={{ paddingLeft: `calc(1.5rem + ${depth * 1.25}rem)` }}
                >
                  {depth > 0 && (
                    <span className="text-gray-300 mr-1.5 select-none">└</span>
                  )}
                  <span className="break-words">
                    {strategy.title || `Stratégie #${strategy.id}`}
                  </span>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {strategy.pot_size_bb !== undefined && strategy.pot_size_bb !== null && (
                    <div className="mb-1">Pot: <span className="font-medium">{strategy.pot_size_bb} bb</span></div>
                  )}
                  {strategy.hero_action && (
                    <div>
                      Action Hero: <span className="font-medium">{strategy.hero_action}</span>
                      {strategy.action_size && ` (${strategy.action_size})`}
                    </div>
                  )}
                  {strategy.action_vilain && (
                    <div>
                      Action Vilain: <span className="font-medium">{strategy.action_vilain}</span>
                    </div>
                  )}
                  {strategy.street === 'PREFLOP' && strategy.position_preflop && (
                    <div>
                      Position: <span className="font-medium">{strategy.position_preflop}</span>
                    </div>
                  )}
                  {strategy.street !== 'PREFLOP' && strategy.position_relative && (
                    <div>
                      Position: <span className="font-medium">{strategy.position_relative}</span>
                    </div>
                  )}
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
