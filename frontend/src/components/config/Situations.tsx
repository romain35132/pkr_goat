import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface Situation {
  id: number;
  parent_id: number | null;
  street: string;
  runout_id: number | null;
  action_history: string;
  created_at: string;
}

const Situations: React.FC = () => {
  const [situations, setSituations] = useState<Situation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentSituation, setCurrentSituation] = useState<Partial<Situation>>({});

  useEffect(() => {
    fetchSituations();
  }, []);

  const fetchSituations = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/config/situations');
      if (!response.ok) throw new Error('Failed to fetch situations');
      const data = await response.json();
      setSituations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUpdate = !!currentSituation.id;
    const url = isUpdate 
      ? `http://localhost:3000/api/config/situations/${currentSituation.id}`
      : 'http://localhost:3000/api/config/situations';
    
    try {
      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: currentSituation.parent_id ? parseInt(currentSituation.parent_id.toString()) : null,
          street: currentSituation.street || 'PREFLOP',
          runout_id: currentSituation.runout_id ? parseInt(currentSituation.runout_id.toString()) : null,
          action_history: currentSituation.action_history || '',
        }),
      });

      if (!response.ok) throw new Error('Failed to save situation');
      
      setIsEditing(false);
      setCurrentSituation({});
      fetchSituations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette situation ?')) return;
    
    try {
      const response = await fetch(`http://localhost:3000/api/config/situations/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete situation');
      fetchSituations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestion des Situations</h2>
        <button
          onClick={() => { setIsEditing(true); setCurrentSituation({ street: 'PREFLOP' }); }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Situation
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isEditing && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Street</label>
              <select
                value={currentSituation.street || 'PREFLOP'}
                onChange={e => setCurrentSituation({...currentSituation, street: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white dark:bg-gray-800"
              >
                <option value="PREFLOP">PREFLOP</option>
                <option value="FLOP">FLOP</option>
                <option value="TURN">TURN</option>
                <option value="RIVER">RIVER</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Parent ID (Optionnel)</label>
              <input
                type="number"
                value={currentSituation.parent_id || ''}
                onChange={e => setCurrentSituation({...currentSituation, parent_id: e.target.value ? parseInt(e.target.value) : null})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Runout ID (Optionnel)</label>
              <input
                type="number"
                value={currentSituation.runout_id || ''}
                onChange={e => setCurrentSituation({...currentSituation, runout_id: e.target.value ? parseInt(e.target.value) : null})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Historique des actions</label>
              <input
                type="text"
                required
                placeholder="ex: BTN open, BB call"
                value={currentSituation.action_history || ''}
                onChange={e => setCurrentSituation({...currentSituation, action_history: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 hover:bg-gray-50 dark:bg-gray-700"
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

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Street</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent ID</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {situations.map(situation => (
              <tr key={situation.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{situation.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${situation.street === 'PREFLOP' ? 'bg-green-100 text-green-800' : 
                      situation.street === 'FLOP' ? 'bg-blue-100 text-blue-800' : 
                      situation.street === 'TURN' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'}`}>
                    {situation.street}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{situation.action_history}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{situation.parent_id || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => { setIsEditing(true); setCurrentSituation(situation); }}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(situation.id)}
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

export default Situations;
