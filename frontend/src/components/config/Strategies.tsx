import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { RangeSelector } from '../RangeSelector';
import {
  derivePotFromParent,
  computePotAtStrategy,
  buildAncestorChainSignature,
} from '../../utils/strategyUtils';

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
  'PairWithTurnCard': 'Paire avec la carte de la turn',
  'PairWithRiverCard': 'Paire avec la carte de la river',
  'HighCard': 'Hauteur',
  'Overcard': 'Overcard',
  'Oesd2Card': 'OESD (2card)',
  'Oesd1Card': 'OESD (1card)',
  'FlushDraw': 'Flushdraw',
  'TurnFlushDraw': 'Flush draw de la turn',
  'FlopFlushDraw': 'Flush draw du flop',
  'Gutshot2Card': 'Gutshot (2card)',
  'Gutshot1Card': 'Gutshot (1card)',
  'ComboDraw': 'Combo draw',
  'OesdAndFd': 'OESD + FD',
  'GutshotAndFd': 'Gutshot + FD',
  'BackdoorFlushDraw1Card': '1 card backdoor flushdraw',
  'BackdoorFlushDraw2Card': '2 card backdoor flushdraw',
  'BackdoorStraightDraw': 'Backdoor quinte',
  'MissDraw': 'Miss draw',
  'Nothing': 'Nothing'
};

const madeHandsSet = new Set([
  'StraightFlush', 'FourOfAKind', 'FullHouse', 'Flush', 'Straight', 
  'Set', 'Trips', 'TwoPairBothHoleCards', 'TwoPairOneHoleCard', 
  'Overpair', 'TopPair', 'SecondPair', 'ThirdPair', 'IntermediatePair', 'Underpair', 'SmallPair',
  'PairWithTurnCard', 'PairWithRiverCard'
]);

const TURN_ONLY_CATEGORIES = new Set(['TurnFlushDraw', 'FlopFlushDraw']);
const BACKDOOR_FLUSH_CATEGORIES = new Set(['BackdoorFlushDraw1Card', 'BackdoorFlushDraw2Card']);
const RIVER_HIDDEN_DRAW_CATEGORIES = new Set([
  'FlushDraw', 'Oesd1Card', 'Oesd2Card', 'Gutshot1Card', 'Gutshot2Card',
  'ComboDraw', 'OesdAndFd', 'GutshotAndFd',
]);

const isCategoryVisibleForStreet = (cat: string, street: string): boolean => {
  if (cat === 'MissDraw') return street === 'RIVER';
  if (TURN_ONLY_CATEGORIES.has(cat)) return street === 'TURN';
  if (BACKDOOR_FLUSH_CATEGORIES.has(cat)) return street === 'FLOP';
  if (cat === 'BackdoorStraightDraw') return street === 'FLOP';
  if (RIVER_HIDDEN_DRAW_CATEGORIES.has(cat)) return street !== 'RIVER';
  if (cat === 'PairWithTurnCard') return street === 'TURN' || street === 'RIVER';
  if (cat === 'PairWithRiverCard') return street === 'RIVER';
  return true;
};

const PERCENTAGE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5);

const createDefaultPostflopStrategyData = (): Record<string, number> => {
  const data: Record<string, number> = {};
  Object.keys(categoryNames).forEach(cat => {
    data[cat] = 100;
  });
  return data;
};

const getMadeHandCategories = (street: string) =>
  Object.keys(categoryNames).filter(k => madeHandsSet.has(k) && isCategoryVisibleForStreet(k, street));
const getOtherHandCategories = (street: string) =>
  Object.keys(categoryNames).filter(k => !madeHandsSet.has(k) && isCategoryVisibleForStreet(k, street));

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
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [bulkPercentage, setBulkPercentage] = useState(100);
  const [madeHandsExpanded, setMadeHandsExpanded] = useState(true);
  const [otherHandsExpanded, setOtherHandsExpanded] = useState(true);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());

  const getStrategyValue = (cat: string, data: any) => {
    if (!data) return 0;
    if (data[cat] !== undefined) return data[cat];
    // Fallback for old BackdoorFlushDraw keys
    if ((cat === 'BackdoorFlushDraw1Card' || cat === 'BackdoorFlushDraw2Card') && data['BackdoorFlushDraw'] !== undefined) {
      return data['BackdoorFlushDraw'];
    }
    return 0;
  };

  const resetBulkSelection = () => {
    setSelectedCategories(new Set());
    setBulkPercentage(100);
    setMadeHandsExpanded(true);
    setOtherHandsExpanded(true);
  };

  const toggleCategorySelection = (cat: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const selectCategoryGroup = (categories: string[]) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      categories.forEach(cat => next.add(cat));
      return next;
    });
  };

  const deselectAllCategories = () => {
    setSelectedCategories(new Set());
  };

  const handleApplyBulkPercentage = () => {
    if (selectedCategories.size === 0) return;
    const newData = { ...(currentStrategy.strategy_data || {}) };
    selectedCategories.forEach(cat => {
      newData[cat] = bulkPercentage;
    });
    setCurrentStrategy({ ...currentStrategy, strategy_data: newData });
  };

  const updateCategoryPercentage = (cat: string, value: number) => {
    const newData = { ...(currentStrategy.strategy_data || {}) };
    newData[cat] = value;
    setCurrentStrategy({ ...currentStrategy, strategy_data: newData });
  };

  const renderCollapsibleSection = (
    title: string,
    categories: string[],
    expanded: boolean,
    onToggle: () => void
  ) => (
    <div className="border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400"
        >
          {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          {title}
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({categories.length})</span>
        </button>
        <button
          type="button"
          onClick={() => selectCategoryGroup(categories)}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60"
        >
          Tout sélectionner
        </button>
      </div>
      {expanded && (
        <div className="p-3">
          {renderCategoryGrid(categories)}
        </div>
      )}
    </div>
  );

  const renderCategoryGrid = (categories: string[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {categories.map(cat => (
        <div key={cat} className="flex items-center gap-2 p-2 rounded-md border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600">
          <input
            type="checkbox"
            checked={selectedCategories.has(cat)}
            onChange={() => toggleCategorySelection(cat)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 shrink-0"
            title="Sélectionner pour appliquer le pourcentage générique"
          />
          <div className="flex flex-col flex-1 min-w-0 space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={categoryNames[cat]}>
              {categoryNames[cat]}
            </label>
            <select
              value={getStrategyValue(cat, currentStrategy.strategy_data)}
              onChange={(e) => updateCategoryPercentage(cat, parseInt(e.target.value))}
              className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-1 border bg-white dark:bg-gray-800 dark:text-gray-100 text-sm w-full"
            >
              {PERCENTAGE_OPTIONS.map(p => (
                <option key={p} value={p}>{p}%</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );

  const getStrategiesForPotDerivation = useCallback((): Strategy[] => {
    if (!isEditing || !currentStrategy.id) return strategies;
    return strategies.map(s =>
      s.id === currentStrategy.id
        ? { ...s, ...currentStrategy, strategy_data: currentStrategy.strategy_data ?? s.strategy_data } as Strategy
        : s
    );
  }, [
    strategies,
    isEditing,
    currentStrategy.id,
    currentStrategy.hero_action,
    currentStrategy.action_size,
    currentStrategy.pot_size_bb,
    currentStrategy.parent_strategy_id,
  ]);

  const parentChainSignature = useMemo(
    () => buildAncestorChainSignature(currentStrategy.parent_strategy_id, strategies),
    [currentStrategy.parent_strategy_id, strategies]
  );

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isEditing || !currentStrategy.parent_strategy_id || strategies.length === 0) return;

    const derivedPot = derivePotFromParent(currentStrategy.parent_strategy_id, strategies);
    if (derivedPot === undefined) return;

    setCurrentStrategy(prev => {
      if (prev.pot_size_bb === derivedPot) return prev;
      return { ...prev, pot_size_bb: derivedPot };
    });
  }, [isEditing, currentStrategy.parent_strategy_id, parentChainSignature, strategies]);

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
        const street = currentStrategy.street || 'FLOP';
        Object.keys(categoryNames)
          .filter(cat => isCategoryVisibleForStreet(cat, street))
          .forEach(cat => {
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
      resetBulkSelection();
      fetchStrategies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCreateChildStrategy = (parentStrategy: Strategy) => {
    const strategiesForDerivation = getStrategiesForPotDerivation();
    const derivedPot = derivePotFromParent(parentStrategy.id, strategiesForDerivation);
    const isPreflop = parentStrategy.street === 'PREFLOP';
    resetBulkSelection();
    setIsEditing(true);
    setCurrentStrategy({
      parent_strategy_id: parentStrategy.id,
      profile_id: parentStrategy.profile_id,
      street: parentStrategy.street,
      ...(derivedPot !== undefined ? { pot_size_bb: derivedPot } : {}),
      strategy_data: isPreflop ? {} : createDefaultPostflopStrategyData(),
    });
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

  const parentsWithChildren = useMemo(() => {
    const set = new Set<number>();
    for (const strategy of strategies) {
      if (strategy.parent_strategy_id !== null) {
        set.add(strategy.parent_strategy_id);
      }
    }
    return set;
  }, [strategies]);

  const isStrategyVisible = useCallback((strategy: Strategy): boolean => {
    let parentId = strategy.parent_strategy_id;
    while (parentId !== null) {
      if (collapsedNodes.has(parentId)) return false;
      const parent = strategies.find(s => s.id === parentId);
      parentId = parent?.parent_strategy_id ?? null;
    }
    return true;
  }, [collapsedNodes, strategies]);

  const visibleStrategies = useMemo(
    () => orderedStrategies.filter(({ strategy }) => isStrategyVisible(strategy)),
    [orderedStrategies, isStrategyVisible]
  );

  const toggleNodeCollapse = (id: number) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const collapseAllNodes = () => {
    setCollapsedNodes(new Set(parentsWithChildren));
  };

  const expandAllNodes = () => {
    setCollapsedNodes(new Set());
  };

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestion des Stratégies</h2>
        <button
          onClick={() => {
            resetBulkSelection();
            setIsEditing(true);
            setCurrentStrategy({ street: 'PREFLOP', strategy_data: {} });
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Stratégie
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
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Titre (Optionnel)</label>
              <input
                type="text"
                value={currentStrategy.title || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, title: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
                placeholder="Ex: Stratégie GTO 100bb"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profile</label>
              <select
                required
                value={currentStrategy.profile_id || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, profile_id: parseInt(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Sélectionner un profil</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Street</label>
              <select
                value={currentStrategy.street || 'PREFLOP'}
                onChange={e => {
                  const street = e.target.value;
                  const isPreflop = street === 'PREFLOP';
                  let strategy_data = currentStrategy.strategy_data;
                  if (!currentStrategy.id) {
                    strategy_data = isPreflop ? {} : createDefaultPostflopStrategyData();
                  }
                  setCurrentStrategy({
                    ...currentStrategy,
                    street,
                    strategy_data,
                    position_relative: isPreflop ? undefined : currentStrategy.position_relative,
                    position_preflop: !isPreflop ? undefined : currentStrategy.position_preflop,
                  });
                }}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="PREFLOP">PREFLOP</option>
                <option value="FLOP">FLOP</option>
                <option value="TURN">TURN</option>
                <option value="RIVER">RIVER</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stratégie Parente (Optionnel)</label>
              <select
                value={currentStrategy.parent_strategy_id || ''}
                onChange={e => {
                  const parentId = e.target.value ? parseInt(e.target.value) : null;
                  setCurrentStrategy(prev => {
                    const derivedPot = derivePotFromParent(parentId, strategies);
                    return {
                      ...prev,
                      parent_strategy_id: parentId,
                      ...(derivedPot !== undefined ? { pot_size_bb: derivedPot } : {}),
                    };
                  });
                }}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Aucune</option>
                {strategies.filter(s => s.id !== currentStrategy.id).map(s => (
                  <option key={s.id} value={s.id}>{s.title || `Stratégie #${s.id} (${getProfileName(s.profile_id)})`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Taille du Pot (bb)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentStrategy.pot_size_bb ?? ''}
                onChange={e => setCurrentStrategy({...currentStrategy, pot_size_bb: e.target.value ? parseFloat(e.target.value) : undefined})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
                placeholder="Ex: 5.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Action Hero</label>
              <select
                value={currentStrategy.hero_action || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, hero_action: e.target.value as any})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Sélectionner une action</option>
                <option value="BET">Bet / Raise</option>
                <option value="CALL">Call</option>
                <option value="CHECK">Check</option>
              </select>
            </div>
            {(currentStrategy.hero_action === 'BET' || currentStrategy.hero_action === 'CALL') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Taille de l'action</label>
                <input
                  type="text"
                  value={currentStrategy.action_size || ''}
                  onChange={e => setCurrentStrategy({...currentStrategy, action_size: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Ex: 33%, 3bb, All-in"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Action Vilain</label>
              <input
                type="text"
                value={currentStrategy.action_vilain || ''}
                onChange={e => setCurrentStrategy({...currentStrategy, action_vilain: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
                placeholder="Ex: Open 2.5bb, Check, Bet 33%"
              />
            </div>
            {currentStrategy.street === 'PREFLOP' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Position Preflop</label>
                <select
                  value={currentStrategy.position_preflop || ''}
                  onChange={e => setCurrentStrategy({...currentStrategy, position_preflop: e.target.value as Strategy['position_preflop'] || undefined})}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white dark:bg-gray-800 dark:text-gray-100"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Position Relative</label>
                <select
                  value={currentStrategy.position_relative || ''}
                  onChange={e => setCurrentStrategy({...currentStrategy, position_relative: e.target.value as Strategy['position_relative'] || undefined})}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Sélectionner une position</option>
                  <option value="OOP">OOP (Out of Position)</option>
                  <option value="IP">IP (In Position)</option>
                </select>
              </div>
            )}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Strategy Data</label>
              {currentStrategy.street === 'PREFLOP' ? (
                <div className="border border-gray-200 dark:border-gray-600 rounded-md p-4 bg-white dark:bg-gray-800 flex justify-center">
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
                <div className="border border-gray-200 dark:border-gray-600 rounded-md p-4 bg-white dark:bg-gray-800 space-y-6">
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-100 dark:border-blue-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pourcentage générique :</span>
                    <select
                      value={bulkPercentage}
                      onChange={(e) => setBulkPercentage(parseInt(e.target.value))}
                      className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-1.5 border bg-white dark:bg-gray-800 dark:text-gray-100 text-sm"
                    >
                      {PERCENTAGE_OPTIONS.map(p => (
                        <option key={p} value={p}>{p}%</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleApplyBulkPercentage}
                      disabled={selectedCategories.size === 0}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Appliquer
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllCategories}
                      disabled={selectedCategories.size === 0}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Tout déselectionner
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedCategories.size > 0
                        ? `${selectedCategories.size} catégorie(s) sélectionnée(s)`
                        : 'Cochez des catégories pour appliquer en masse'}
                    </span>
                  </div>
                  {renderCollapsibleSection(
                    'Mains faites (pair+)',
                    getMadeHandCategories(currentStrategy.street || 'FLOP'),
                    madeHandsExpanded,
                    () => setMadeHandsExpanded(prev => !prev)
                  )}
                  {renderCollapsibleSection(
                    'Le reste',
                    getOtherHandCategories(currentStrategy.street || 'FLOP'),
                    otherHandsExpanded,
                    () => setOtherHandsExpanded(prev => !prev)
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={() => { setIsEditing(false); resetBulkSelection(); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700"
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

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
        {parentsWithChildren.size > 0 && (
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={collapseAllNodes}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
              title="Masquer tous les sous-nœuds"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Tout replier
            </button>
            <button
              type="button"
              onClick={expandAllNodes}
              disabled={collapsedNodes.size === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Afficher tous les sous-nœuds"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Tout déplier
            </button>
          </div>
        )}
        <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="w-[30%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titre / ID</th>
              <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</th>
              <th className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Street</th>
              <th className="w-[33%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contexte</th>
              <th className="w-[18%] px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {visibleStrategies.map(({ strategy, depth }) => {
              const hasChildren = parentsWithChildren.has(strategy.id);
              const isCollapsed = collapsedNodes.has(strategy.id);

              return (
              <tr key={strategy.id}>
                <td
                  className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100"
                  style={{ paddingLeft: `calc(1.5rem + ${depth * 1.25}rem)` }}
                >
                  <div className="flex items-start gap-1">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleNodeCollapse(strategy.id)}
                        className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        title={isCollapsed ? 'Déplier les sous-nœuds' : 'Replier les sous-nœuds'}
                      >
                        {isCollapsed
                          ? <ChevronRight className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    {depth > 0 && (
                      <span className="text-gray-300 mr-0.5 select-none shrink-0">└</span>
                    )}
                    <span className="break-words">
                      {strategy.title || `Stratégie #${strategy.id}`}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {(() => {
                    const displayPot = computePotAtStrategy(strategy, strategies) ?? strategy.pot_size_bb;
                    return displayPot != null ? (
                      <div className="mb-1">Pot: <span className="font-medium">{displayPot} bb</span></div>
                    ) : null;
                  })()}
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
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleCreateChildStrategy(strategy)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                      title={`Créer une stratégie enfant de ${strategy.title || `Stratégie #${strategy.id}`}`}
                    >
                      <Plus className="w-3 h-3" />
                      Créer sous nœud
                    </button>
                    <button
                      onClick={() => { 
                        let parsedData = strategy.strategy_data;
                        if (typeof parsedData === 'string') {
                          try { parsedData = JSON.parse(parsedData); } catch(e) { parsedData = {}; }
                        }
                        resetBulkSelection();
                        setIsEditing(true); 
                        setCurrentStrategy({...strategy, strategy_data: parsedData}); 
                      }}
                      className="text-indigo-600 hover:text-indigo-900 p-1"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(strategy.id)}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Strategies;
