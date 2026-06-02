import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface Profile {
  id: number;
  name: string;
}

interface Situation {
  id: number;
  street: string;
  action_history: string;
}

interface Strategy {
  id: number;
  title?: string;
  profile_id: number;
  situation_id: number;
  parent_strategy_id: number | null;
  street: string;
  strategy_data: any;
  created_at: string;
}

const Strategies: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState<Partial<Strategy>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [strategiesRes, profilesRes, situationsRes] = await Promise.all([
        fetch('http://localhost:3000/api/config/strategies'),
        fetch('http://localhost:3000/api/config/profiles'),
        fetch('http://localhost:3000/api/config/situations')
      ]);

      if (!strategiesRes.ok || !profilesRes.ok || !situationsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [strategiesData, profilesData, situationsData] = await Promise.all([
        strategiesRes.json(),
        profilesRes.json(),
        situationsRes.json()
      ]);

      setStrategies(strategiesData);
      setProfiles(profilesData);
      setSituations(situationsData);
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
          situation_id: currentStrategy.situation_id ? parseInt(currentStrategy.situation_id.toString()) : (situations[0]?.id || 0),
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
  const getSituationName = (id: number) => {
    const sit = situations.find(s => s.id === id);
    return sit ? `[${sit.street}] ${sit.action_history}` : id;
  };
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
          onClick={() => { setIsEditing(true); setCurrentStrategy({ street: 'PREFLOP', strategy_data: "{}" }); }}
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
              <label className="block text-sm font-medium text-gray-700">Situation</label>
              <select
                required
                value={currentStrategy.situation_id || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, situation_id: parseInt(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
              >
                <option value="">Sélectionner une situation</option>
                {situations.map(s => (
                  <option key={s.id} value={s.id}>[{s.street}] {s.action_history}</option>
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
              <label className="block text-sm font-medium text-gray-700">Strategy Data (JSON)</label>
              <textarea
                required
                value={typeof currentStrategy.strategy_data === 'string' ? currentStrategy.strategy_data : JSON.stringify(currentStrategy.strategy_data || {}, null, 2)}
                onChange={e => setCurrentStrategy({...currentStrategy, strategy_data: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border font-mono text-sm"
                rows={5}
              />
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile / Situation</th>
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
                  <div className="text-gray-500 text-xs mt-1">{getSituationName(strategy.situation_id)}</div>
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
                    onClick={() => { setIsEditing(true); setCurrentStrategy(strategy); }}
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
