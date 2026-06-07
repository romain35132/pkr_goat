import { themeColors } from './utils/themeColors';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CardSelector } from './components/CardSelector';
import { RangeSelector, getComboCount } from './components/RangeSelector';
import { CategoryFilter } from './components/CategoryFilter';
import { CategoryResult } from './components/CategoryDetailModal';
import { ActionTreeNavigator } from './components/ActionTreeNavigator';
import {
  StrategyNode,
  streetToDb,
  computePotAtStrategy,
  parseActionAmountBb,
  getParentForVillainActions,
  getSelectedStrategyForStreet,
  truncatePathForStreet,
  formatVillainAction,
  formatHeroAction,
  getAllHeroNodesForStreet,
  getHeroActionNodes,
  getVillainNodeForHero,
} from './utils/strategyUtils';
import { buildStrategyRange } from './utils/strategyRangeUtils';
import { HeroStrategyMatrix } from './components/HeroStrategyMatrix';
import { HeroRangeModal } from './components/HeroRangeModal';
import {
  buildActionOptions,
  computeHeroStrategyMatrix,
  getEffectiveHeroRange,
  ActionOption,
  HandRecommendation,
  ActionDisplayStyle,
  ComboPlayDetail,
} from './utils/heroStrategyUtils';

interface EquityResult {
  equity: number;
  wins: number;
  ties: number;
  losses: number;
  iterations: number;
  time_ms: number;
}

const SUITS_MAP: Record<string, { color: string; icon: string }> = {
  's': { color: '#2c3e50', icon: '♠' },
  'h': { color: '#e74c3c', icon: '♥' },
  'd': { color: '#3498db', icon: '♦' },
  'c': { color: '#27ae60', icon: '♣' },
};

const SelectedCardsDisplay: React.FC<{ cards: string[] }> = ({ cards }) => {
  if (cards.length === 0) return <strong style={{ color: themeColors.text }}>Aucune</strong>;
  
  return (
    <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
      {cards.map(card => {
        const value = card[0];
        const suit = card[1];
        const suitInfo = SUITS_MAP[suit];
        
        return (
          <div key={card} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: themeColors.inputBg,
            border: `1px solid ${themeColors.borderInput}`,
            borderRadius: '4px',
            padding: '2px 6px',
            color: suitInfo?.color || 'black',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            {value}<span style={{ fontSize: '16px', marginLeft: '2px' }}>{suitInfo?.icon || suit}</span>
          </div>
        );
      })}
    </div>
  );
};

export type Street = 'Preflop' | 'Flop' | 'Turn' | 'River';

export interface StreetState {
  street: Street;
  range: Record<string, number>;
  boardCards: string[];
}

const PokerEquityCalculator: React.FC = () => {
  const [playerCards, setPlayerCards] = useState<string[]>([]);
  const [heroMode, setHeroMode] = useState<'combo' | 'range'>('combo');
  const [heroRange, setHeroRange] = useState<Record<string, number>>({});
  const [boardCards, setBoardCards] = useState<string[]>([]);
  
  const [ranges, setRanges] = useState<Record<Street, Record<string, number>>>({
    Preflop: {},
    Flop: {},
    Turn: {},
    River: {}
  });
  
  const [isPlayerHandOpen, setIsPlayerHandOpen] = useState(true);
  const [isBoardOpen, setIsBoardOpen] = useState(true);
  const [isHeroRangeModalOpen, setIsHeroRangeModalOpen] = useState(false);

  const [potSize, setPotSize] = useState<number>(0);
  const [actionType, setActionType] = useState<'Check' | 'Check/Fold' | 'Call' | 'Bet/Raise'>('Call');
  const [actionAmount, setActionAmount] = useState<number>(0);
  const [foldEquity, setFoldEquity] = useState<number>(0);

  const [result, setResult] = useState<EquityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [postflopRangeGroups, setPostflopRangeGroups] = useState<Record<string, number>>({});
  const [postflopAllowedHands, setPostflopAllowedHands] = useState<string[]>([]);

  const [allStrategies, setAllStrategies] = useState<StrategyNode[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [strategyPath, setStrategyPath] = useState<number[]>([]);
  const [pendingVillainNodeId, setPendingVillainNodeId] = useState<number | null>(null);
  
  const [baseCategories, setBaseCategories] = useState<CategoryResult[]>([]);
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({});
  const [filterRevision, setFilterRevision] = useState(0);
  const [strategiesResults, setStrategiesResults] = useState<Record<string, { equity: number, ev: number, loading: boolean, error?: string }>>({});
  const [heroStrategyLoading, setHeroStrategyLoading] = useState(false);
  const [heroStrategyError, setHeroStrategyError] = useState('');
  const [heroRecommendations, setHeroRecommendations] = useState<HandRecommendation[]>([]);
  const [heroActionStyles, setHeroActionStyles] = useState<Record<string, ActionDisplayStyle>>({});
  const [heroAggregateEV, setHeroAggregateEV] = useState(0);
  const [heroActionOptions, setHeroActionOptions] = useState<ActionOption[]>([]);
  const [heroComboDetailsByHand, setHeroComboDetailsByHand] = useState<Record<string, ComboPlayDetail[]>>({});

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/config/strategies');
        if (response.ok) {
          const data = await response.json();
          setAllStrategies(data);
        }
      } catch (err) {
        console.error('Failed to fetch strategies', err);
      }
    };
    fetchStrategies();
  }, []);

  const getCurrentStreet = (cards: string[]): Street => {
    if (cards.length < 3) return 'Preflop';
    if (cards.length === 3) return 'Flop';
    if (cards.length === 4) return 'Turn';
    return 'River';
  };

  const rangeToString = (range: Record<string, number>) =>
    Object.entries(range)
      .filter(([, w]) => w > 0)
      .map(([hand, weight]) => (weight === 100 ? hand : `${hand}:${weight}`))
      .join(', ');

  const currentStreet = getCurrentStreet(boardCards);
  const currentStreetDb = streetToDb(currentStreet);
  const currentRange = ranges[currentStreet];

  const heroDeadCards = useMemo(
    () => (heroMode === 'combo' ? [...playerCards, ...boardCards] : [...boardCards]),
    [heroMode, playerCards, boardCards],
  );

  const effectiveHeroRange = useMemo(
    () => getEffectiveHeroRange(heroRange, heroDeadCards),
    [heroRange, heroDeadCards],
  );

  const isHeroReady = heroMode === 'combo'
    ? playerCards.length === 2
    : Object.keys(effectiveHeroRange).length > 0;

  const heroRangeStr = useMemo(() => rangeToString(effectiveHeroRange), [effectiveHeroRange]);

  const preflopStrategies = useMemo(() => allStrategies.filter(s => s.street === 'PREFLOP'), [allStrategies]);

  const applyStrategySettings = useCallback((strategy: StrategyNode) => {
    const derivedPot = computePotAtStrategy(strategy, allStrategies);
    if (derivedPot !== undefined) {
      setPotSize(derivedPot);
    } else if (strategy.pot_size_bb !== null && strategy.pot_size_bb !== undefined) {
      setPotSize(strategy.pot_size_bb);
    }

    if (strategy.hero_action) {
      if (strategy.hero_action === 'FOLD') {
        setActionType('Check/Fold');
      } else if (strategy.hero_action === 'CHECK') {
        setActionType('Check');
      } else if (strategy.hero_action === 'CALL') {
        setActionType('Call');
      } else if (strategy.hero_action === 'BET' || strategy.hero_action === 'RAISE') {
        setActionType('Bet/Raise');
      }
    }

    if (strategy.action_size) {
      const pot = derivedPot ?? strategy.pot_size_bb ?? potSize;
      const parsedAmount = parseActionAmountBb(strategy.action_size, pot);
      if (parsedAmount !== null) {
        setActionAmount(Number(parsedAmount.toFixed(1)));
      }
    }
  }, [allStrategies, potSize]);

  const selectedStreetStrategy = useMemo(
    () => getSelectedStrategyForStreet(allStrategies, strategyPath, currentStreetDb),
    [allStrategies, strategyPath, currentStreetDb]
  );

  const heroStrategiesAtStreet = useMemo(() => {
    const parentId = getParentForVillainActions(
      allStrategies,
      strategyPath,
      selectedStrategyId,
      currentStreetDb
    );
    if (!parentId || currentStreet === 'Preflop') return [];
    return getAllHeroNodesForStreet(allStrategies, parentId, currentStreetDb);
  }, [allStrategies, strategyPath, selectedStrategyId, currentStreet, currentStreetDb]);

  const decisionPointHeroStrategies = useMemo(() => {
    if (currentStreet === 'Preflop') return [];
    const selectedHero = getSelectedStrategyForStreet(allStrategies, strategyPath, currentStreetDb);
    const selectedVillain = selectedHero
      ? getVillainNodeForHero(allStrategies, selectedHero)
      : undefined;
    const activeVillainId = pendingVillainNodeId ?? selectedVillain?.id ?? null;
    if (!activeVillainId) return [];
    return getHeroActionNodes(allStrategies, activeVillainId, currentStreetDb);
  }, [
    allStrategies,
    strategyPath,
    currentStreet,
    currentStreetDb,
    pendingVillainNodeId,
  ]);

  const handleSelectVillainAction = useCallback((strategy: StrategyNode) => {
    setPendingVillainNodeId(strategy.id);
    setStrategyPath(prev => prev.filter(id => {
      const s = allStrategies.find(st => st.id === id);
      return s?.street !== strategy.street;
    }));
  }, [allStrategies]);

  const applyHeroStrategySelection = useCallback((strategy: StrategyNode) => {
    applyStrategySettings(strategy);
    setFilterRevision(r => r + 1);
  }, [applyStrategySettings]);

  const handleSelectHeroAction = useCallback((strategy: StrategyNode) => {
    setStrategyPath(prev => {
      const withoutSameStreet = prev.filter(id => {
        const s = allStrategies.find(st => st.id === id);
        return s?.street !== strategy.street;
      });
      return [...withoutSameStreet, strategy.id];
    });
    setPendingVillainNodeId(strategy.parent_strategy_id);
    applyHeroStrategySelection(strategy);
  }, [allStrategies, applyHeroStrategySelection]);

  const handleSelectLine = useCallback((villain: StrategyNode, hero: StrategyNode) => {
    setPendingVillainNodeId(villain.id);
    setStrategyPath(prev => {
      const withoutSameStreet = prev.filter(id => {
        const s = allStrategies.find(st => st.id === id);
        return s?.street !== hero.street;
      });
      return [...withoutSameStreet, hero.id];
    });
    applyHeroStrategySelection(hero);
  }, [allStrategies, applyHeroStrategySelection]);

  const handleGoBack = useCallback(() => {
    const selectedHero = getSelectedStrategyForStreet(allStrategies, strategyPath, currentStreetDb);
    if (selectedHero) {
      setStrategyPath(prev => prev.filter(id => id !== selectedHero.id));
      const villain = getVillainNodeForHero(allStrategies, selectedHero);
      setPendingVillainNodeId(villain?.id ?? null);
      return;
    }
    if (pendingVillainNodeId) {
      setPendingVillainNodeId(null);
      return;
    }
    setStrategyPath(prev => {
      const next = [...prev];
      next.pop();
      const last = next.length > 0 ? allStrategies.find(s => s.id === next[next.length - 1]) : undefined;
      if (last) {
        applyStrategySettings(last);
        setPendingVillainNodeId(last.parent_strategy_id);
      } else if (selectedStrategyId) {
        const preflop = allStrategies.find(s => s.id.toString() === selectedStrategyId);
        if (preflop) applyStrategySettings(preflop);
        setPendingVillainNodeId(null);
      }
      return next;
    });
  }, [allStrategies, strategyPath, currentStreetDb, pendingVillainNodeId, selectedStrategyId, applyStrategySettings]);

  useEffect(() => {
    setStrategyPath([]);
    setPendingVillainNodeId(null);
  }, [selectedStrategyId]);

  useEffect(() => {
    setBaseCategories([]);
    setActiveCategories({});
    setStrategyPath(prev => {
      const truncated = truncatePathForStreet(allStrategies, prev, currentStreetDb);
      const hero = getSelectedStrategyForStreet(allStrategies, truncated, currentStreetDb);
      if (hero) {
        const villain = getVillainNodeForHero(allStrategies, hero);
        setPendingVillainNodeId(villain?.id ?? hero.parent_strategy_id ?? null);
      } else {
        setPendingVillainNodeId(null);
      }
      return truncated;
    });
    setFilterRevision(r => r + 1);
  }, [currentStreetDb, allStrategies]);

  // Helper to compute range for a strategy, respecting active category filters
  const getStrategyRange = (
    strategyData: any,
    baseCats: CategoryResult[],
    activeCats: Record<string, boolean>,
    boardLength: number,
  ): Record<string, number> => buildStrategyRange(strategyData, baseCats, activeCats, boardLength);

  // Calculate EV helper
  const calculateEV = (eq: number, action: string, pot: number, amount: number, fe: number) => {
    if (action === 'Check/Fold' || action === 'FOLD') return 0;
    if (action === 'Check' || action === 'CHECK') return eq * pot;
    if (action === 'Call' || action === 'CALL') return (eq * pot) - ((1 - eq) * amount);
    if (action === 'Bet/Raise' || action === 'BET' || action === 'RAISE') {
      const fePct = fe / 100;
      return (fePct * pot) + ((1 - fePct) * ((eq * (pot + amount)) - ((1 - eq) * amount)));
    }
    return 0;
  };

  // FE suffisante pour un profit direct (bluff rentable même avec 0% d'équité si call)
  const hasDirectProfit = (fe: number, pot: number, amount: number) => {
    if (pot <= 0 || amount <= 0) return false;
    const minFe = (amount / (pot + amount)) * 100;
    return fe >= minFe;
  };

  const opponentCombos = useMemo(() => {
    let total = 0;
    for (const [hand, weight] of Object.entries(currentRange)) {
      if (weight > 0) {
        total += getComboCount(hand, heroDeadCards) * (weight / 100);
      }
    }
    return total;
  }, [currentRange, heroDeadCards]);

  const baseRangeForCurrentStreet = useMemo(() => {
    if (currentStreet === 'Flop') return ranges.Preflop;
    if (currentStreet === 'Turn') return ranges.Flop;
    if (currentStreet === 'River') return ranges.Turn;
    return {};
  }, [currentStreet, ranges.Preflop, ranges.Flop, ranges.Turn]);

  const getBaseRangeForCurrentStreet = () => baseRangeForCurrentStreet;

  const baseCombos = useMemo(() => {
    let total = 0;
    const baseRange = getBaseRangeForCurrentStreet();
    for (const [hand, weight] of Object.entries(baseRange)) {
      if (weight > 0) {
        total += getComboCount(hand, heroDeadCards) * (weight / 100);
      }
    }
    return total;
  }, [ranges, currentStreet, heroDeadCards]);

  // Auto-calculate all flop strategies
  useEffect(() => {
    let isActive = true;

    const calculateAllStrategies = async () => {
      if (currentStreet === 'Preflop' || heroStrategiesAtStreet.length === 0 || !isHeroReady || baseCategories.length === 0 || Object.keys(activeCategories).length === 0) {
        setStrategiesResults({});
        return;
      }

      const newResults: Record<string, any> = {};
      heroStrategiesAtStreet.forEach(s => {
        newResults[s.id] = { loading: true };
      });
      setStrategiesResults(newResults);

      for (const strategy of heroStrategiesAtStreet) {
        if (!isActive) break;
        
        const strategyRangeObj = getStrategyRange(strategy.strategy_data, baseCategories, activeCategories, boardCards.length);
        const strategyRangeStr = rangeToString(strategyRangeObj);
        if (!strategyRangeStr) {
          setStrategiesResults(prev => ({ ...prev, [strategy.id]: { loading: false, error: 'Range vide' } }));
          continue;
        }

        try {
          const equityBody = heroMode === 'range'
            ? {
                player_range: heroRangeStr,
                opponent_range: strategyRangeStr,
                board: boardCards.join(' '),
                iterations: 50000,
              }
            : {
                player_hand: playerCards.join(''),
                opponent_range: strategyRangeStr,
                board: boardCards.join(' '),
                iterations: 50000,
              };

          const response = await fetch('/api/v1/equity/monte-carlo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(equityBody),
          });

          const data = await response.json();
          if (!isActive) break;

          if (!response.ok) throw new Error(data.error || 'Erreur');

          const pot = computePotAtStrategy(strategy, allStrategies) ?? strategy.pot_size_bb ?? potSize ?? 0;
          const action = strategy.hero_action || 'Call';
          const amount = parseActionAmountBb(strategy.action_size, pot) ?? 0;
          
          // Estimate fold equity based on combos
          let strategyCombos = 0;

          for (const [hand, weight] of Object.entries(strategyRangeObj)) {
            if (weight > 0) {
              strategyCombos += getComboCount(hand, heroDeadCards) * (weight / 100);
            }
          }
          
          let fe = 0;
          if (baseCombos > 0) {
            fe = ((baseCombos - strategyCombos) / baseCombos) * 100;
            fe = Math.max(0, Math.min(100, fe));
          }

          const ev = calculateEV(data.equity, action, pot, amount, fe);

          setStrategiesResults(prev => ({
            ...prev,
            [strategy.id]: {
              equity: data.equity,
              ev,
              fe,
              loading: false
            }
          }));
        } catch (err: any) {
          if (!isActive) break;
          setStrategiesResults(prev => ({
            ...prev,
            [strategy.id]: { loading: false, error: err.message }
          }));
        }
      }
    };

    calculateAllStrategies();

    return () => {
      isActive = false;
    };
  }, [currentStreet, heroStrategiesAtStreet, isHeroReady, heroMode, heroRangeStr, playerCards, boardCards, baseCategories, activeCategories, potSize, baseCombos, allStrategies, heroDeadCards]);

  useEffect(() => {
    if (currentStreet !== 'Preflop' && baseCombos > 0) {
      const fe = ((baseCombos - opponentCombos) / baseCombos) * 100;
      setFoldEquity(Number(Math.max(0, Math.min(100, fe)).toFixed(1)));
    }
  }, [baseCombos, opponentCombos, currentStreet]);

  const handleRangeChange = (newRangeOrUpdater: Record<string, number> | React.SetStateAction<Record<string, number>>) => {
    setRanges(prev => {
      const prevStreetRange = prev[currentStreet];
      const nextStreetRange = typeof newRangeOrUpdater === 'function' 
        ? (newRangeOrUpdater as (prevState: Record<string, number>) => Record<string, number>)(prevStreetRange) 
        : newRangeOrUpdater;
      return { ...prev, [currentStreet]: nextStreetRange };
    });
  };

  const handleRangeGroupsChange = (groups: Record<string, number>, allowed: string[]) => {
    setPostflopRangeGroups(groups);
    setPostflopAllowedHands(allowed);
  };

  const handleActiveCategoriesChange = useCallback((active: Record<string, boolean>) => {
    setActiveCategories(active);
  }, []);

  // Auto-collapse when selections are complete
  useEffect(() => {
    if (heroMode === 'combo' && playerCards.length === 2) {
      setIsPlayerHandOpen(false);
    }
    if (heroMode === 'range' && Object.keys(effectiveHeroRange).length > 0) {
      setIsPlayerHandOpen(false);
    }
  }, [playerCards.length, heroMode, effectiveHeroRange]);

  const openHeroRangeModal = () => {
    setHeroMode('range');
    setIsHeroRangeModalOpen(true);
  };

  useEffect(() => {
    if (boardCards.length === 5) {
      setIsBoardOpen(false);
    }
  }, [boardCards.length]);

  // Synchronize text inputs for display or manual editing if needed
  const playerHand = playerCards.join('');
  const opponentRange = Object.entries(currentRange)
    .map(([hand, weight]) => (weight === 100 ? hand : `${hand}:${weight}`))
    .join(', ');
  const board = boardCards.join(' ');

  useEffect(() => {
    let isActive = true;

    const calculateEquity = async () => {
      if (!isHeroReady) {
        return;
      }
      if (Object.keys(currentRange).length === 0) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const body = heroMode === 'range'
          ? {
              player_range: heroRangeStr,
              opponent_range: opponentRange,
              board: board,
              iterations: 100000,
            }
          : {
              player_hand: playerHand,
              opponent_range: opponentRange,
              board: board,
              iterations: 100000,
            };

        const response = await fetch('/api/v1/equity/monte-carlo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!isActive) return;

        if (!response.ok) {
          throw new Error(data.error || 'Une erreur est survenue');
        }

        setResult(data);
      } catch (err: any) {
        if (!isActive) return;
        setError(err.message || 'Erreur de connexion au serveur');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    if (isHeroReady && Object.keys(currentRange).length > 0) {
      calculateEquity();
    } else {
      setResult(null);
    }

    return () => {
      isActive = false;
    };
  }, [playerHand, heroRangeStr, heroMode, opponentRange, board, isHeroReady, currentRange]);

  // Hero strategy matrix (range mode)
  useEffect(() => {
    if (heroMode !== 'range' || !isHeroReady || Object.keys(currentRange).length === 0) {
      setHeroRecommendations([]);
      setHeroActionStyles({});
      setHeroAggregateEV(0);
      setHeroActionOptions([]);
      return;
    }

    let isActive = true;

    const runMatrix = async () => {
      const postflopReady = currentStreet === 'Preflop'
        || (baseCategories.length > 0 && Object.keys(activeCategories).length > 0);

      if (!postflopReady) {
        setHeroRecommendations([]);
        setHeroActionOptions([]);
        return;
      }

      const actions = buildActionOptions({
        currentStreet,
        selectedPreflopId: selectedStrategyId,
        decisionPointHeroStrategies,
        heroStrategiesAtStreet,
        allStrategies,
        baseRange: baseRangeForCurrentStreet,
        opponentRange: currentRange,
        deadCards: heroDeadCards,
        getStrategyRange: (data) => getStrategyRange(data, baseCategories, activeCategories, boardCards.length),
        potSize,
        actionType,
        actionAmount,
        foldEquity,
      });

      if (!isActive) return;
      setHeroActionOptions(actions);
      setHeroStrategyLoading(true);
      setHeroStrategyError('');

      try {
        const result = await computeHeroStrategyMatrix(
          effectiveHeroRange,
          actions,
          board,
          heroDeadCards,
          opponentRange,
        );
        if (!isActive) return;
        setHeroRecommendations(result.recommendations);
        setHeroActionStyles(result.actionStyleMap);
        setHeroComboDetailsByHand(result.comboDetailsByHand);
        setHeroAggregateEV(result.aggregateEV);
      } catch (err: any) {
        if (!isActive) return;
        setHeroStrategyError(err.message || 'Erreur stratégie hero');
        setHeroRecommendations([]);
      } finally {
        if (isActive) setHeroStrategyLoading(false);
      }
    };

    runMatrix();
    return () => { isActive = false; };
  }, [
    heroMode, isHeroReady, effectiveHeroRange, currentRange, currentStreet,
    decisionPointHeroStrategies, heroStrategiesAtStreet, allStrategies, baseRangeForCurrentStreet, selectedStrategyId,
    baseCategories, activeCategories, boardCards.length, board,
    heroDeadCards, potSize, actionType, actionAmount, foldEquity,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (heroMode === 'combo' && playerCards.length !== 2) {
      setError('Veuillez sélectionner exactement 2 cartes pour votre main.');
      return;
    }
    if (heroMode === 'range' && Object.keys(effectiveHeroRange).length === 0) {
      setError('Veuillez sélectionner au moins une main dans votre range hero.');
      return;
    }
    if (Object.keys(currentRange).length === 0) {
      setError('Veuillez sélectionner au moins une main pour le range adverse.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/equity/monte-carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          heroMode === 'range'
            ? {
                player_range: heroRangeStr,
                opponent_range: opponentRange,
                board: board,
                iterations: 100000,
              }
            : {
                player_hand: playerHand,
                opponent_range: opponentRange,
                board: board,
                iterations: 100000,
              },
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', fontFamily: 'sans-serif', backgroundColor: themeColors.bg }}>
      
      {/* Top Row: My Hand, Board */}
      <div style={{ display: 'flex', gap: '20px', padding: '15px 20px', backgroundColor: themeColors.surface, borderBottom: `1px solid ${themeColors.border}`, maxHeight: '190px', flexShrink: 0 }}>
        
        <div style={{ flex: '1.2', display: 'flex', flexDirection: 'column' }}>
          <div 
            onClick={() => setIsPlayerHandOpen(!isPlayerHandOpen)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '5px' }}
          >
            <label style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer', color: themeColors.text }}>
              {heroMode === 'combo'
                ? `Votre Main (${playerCards.length}/2)`
                : `Votre Range (${Object.keys(effectiveHeroRange).length} mains)`}
            </label>
            <span style={{ fontSize: '12px', color: themeColors.textMuted }}>
              {isPlayerHandOpen ? '▼ Replier' : '▶ Déplier'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setHeroMode('combo'); setIsHeroRangeModalOpen(false); }}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: `1px solid ${heroMode === 'combo' ? '#3498db' : themeColors.borderInput}`,
                backgroundColor: heroMode === 'combo' ? themeColors.activeBg : themeColors.surface,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: heroMode === 'combo' ? 'bold' : 'normal',
              }}
            >
              Combo
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openHeroRangeModal(); }}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: `1px solid ${heroMode === 'range' ? '#3498db' : themeColors.borderInput}`,
                backgroundColor: heroMode === 'range' ? themeColors.activeBg : themeColors.surface,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: heroMode === 'range' ? 'bold' : 'normal',
              }}
            >
              Range
            </button>
          </div>
          
          {isPlayerHandOpen && heroMode === 'combo' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <CardSelector 
                selectedCards={playerCards} 
                onChange={setPlayerCards} 
                maxCards={2} 
                disabledCards={boardCards}
              />
            </div>
          )}
          {heroMode === 'range' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsHeroRangeModalOpen(true); }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #3498db',
                  backgroundColor: themeColors.activeBg,
                  color: themeColors.activeText,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                {Object.keys(effectiveHeroRange).length > 0
                  ? `Modifier le range (${Object.keys(effectiveHeroRange).length} mains)`
                  : 'Choisir un range…'}
              </button>
              {Object.keys(effectiveHeroRange).length > 0 && (
                <span style={{ fontSize: '13px', color: themeColors.textMuted }}>
                  {heroRangeStr.length > 60 ? heroRangeStr.slice(0, 60) + '…' : heroRangeStr}
                </span>
              )}
            </div>
          )}
          {!isPlayerHandOpen && heroMode === 'combo' && (
            <div style={{ fontSize: '14px', color: themeColors.textMuted }}>
              Sélection: <SelectedCardsDisplay cards={playerCards} />
            </div>
          )}
          {!isPlayerHandOpen && heroMode === 'range' && (
            <div
              style={{ fontSize: '14px', color: themeColors.textMuted, cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setIsHeroRangeModalOpen(true); }}
            >
              {Object.keys(effectiveHeroRange).length > 0
                ? `${Object.keys(effectiveHeroRange).length} mains — cliquer pour modifier`
                : 'Aucun range — cliquer pour choisir'}
            </div>
          )}
        </div>

        <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
          <div 
            onClick={() => setIsBoardOpen(!isBoardOpen)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '5px' }}
          >
            <label style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer', color: themeColors.text }}>
              Board ({boardCards.length}/5)
            </label>
            <span style={{ fontSize: '12px', color: themeColors.textMuted }}>
              {isBoardOpen ? '▼ Replier' : '▶ Déplier'}
            </span>
          </div>
          
          {isBoardOpen && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <CardSelector 
                selectedCards={boardCards} 
                onChange={setBoardCards} 
                maxCards={5} 
                disabledCards={heroMode === 'combo' ? playerCards : []}
              />
            </div>
          )}
          {!isBoardOpen && (
            <div style={{ fontSize: '14px', color: themeColors.textMuted }}>
              Sélection: <SelectedCardsDisplay cards={boardCards} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Range Selector, Filters, EV & Results */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Column 1: Range Selector */}
        <div style={{ flex: '1.2', minWidth: '400px', padding: '20px', overflowY: 'auto', borderRight: `1px solid ${themeColors.border}`, backgroundColor: themeColors.surface, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '18px', color: themeColors.text }}>
            Range Adverse - {currentStreet}
          </label>
          <div style={{ fontSize: '14px', color: themeColors.textMuted }}>
            {Object.keys(currentRange).length} mains, {opponentCombos % 1 !== 0 ? opponentCombos.toFixed(1) : opponentCombos} combos
          </div>
        </div>

        {currentStreet === 'Preflop' && preflopStrategies.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: themeColors.textMuted }}>
              Importer une stratégie Preflop :
            </label>
            <select
              value={selectedStrategyId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedStrategyId(id);
                if (id) {
                  const strategy = preflopStrategies.find(s => s.id.toString() === id);
                  if (strategy) {
                    if (strategy.strategy_data) {
                      // Si la strategy est stockée en string on la parse, sinon direct
                      let dataToImport = strategy.strategy_data;
                      if (typeof dataToImport === 'string') {
                        try {
                          dataToImport = JSON.parse(dataToImport);
                        } catch (err) {}
                      }
                      if (typeof dataToImport === 'object' && dataToImport !== null && !Array.isArray(dataToImport)) {
                        handleRangeChange(dataToImport as Record<string, number>);
                      }
                    }
                    if (strategy.pot_size_bb !== null && strategy.pot_size_bb !== undefined) {
                      setPotSize(strategy.pot_size_bb);
                    }
                    if (strategy.hero_action) {
                      if (strategy.hero_action === 'FOLD') {
                        setActionType('Check/Fold');
                      } else if (strategy.hero_action === 'CHECK') {
                        setActionType('Check');
                      } else if (strategy.hero_action === 'CALL') {
                        setActionType('Call');
                      } else if (strategy.hero_action === 'BET' || strategy.hero_action === 'RAISE') {
                        setActionType('Bet/Raise');
                      }
                    }
                    if (strategy.action_size) {
                      let parsedAmount = parseFloat(strategy.action_size);
                      if (!isNaN(parsedAmount)) {
                        if (strategy.action_size.includes('%') && strategy.pot_size_bb) {
                          parsedAmount = (parsedAmount / 100) * strategy.pot_size_bb;
                        }
                        setActionAmount(Number(parsedAmount.toFixed(1)));
                      }
                    }
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: `1px solid ${themeColors.borderInput}`,
                backgroundColor: themeColors.inputBg,
              }}
            >
              <option value="">-- Sélectionner une stratégie --</option>
              {preflopStrategies.map(s => (
                <option key={s.id} value={s.id}>{s.title || `Stratégie #${s.id}`}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {currentStreet === 'Preflop' ? (
            <RangeSelector 
              selectedHands={currentRange} 
              onChange={handleRangeChange} 
              deadCards={heroDeadCards}
            />
          ) : (
            <RangeSelector 
              selectedHands={postflopRangeGroups}
              onChange={() => {}} 
              allowedHands={postflopAllowedHands}
              readOnly={true}
              deadCards={heroDeadCards}
            />
          )}
        </div>
        
        <div style={{ marginTop: '20px', fontSize: '12px', color: themeColors.textMuted, maxHeight: '100px', overflowY: 'auto', wordBreak: 'break-all', padding: '10px', backgroundColor: themeColors.surfaceAlt, borderRadius: '4px' }}>
          {opponentRange || 'Aucun range sélectionné'}
        </div>
      </div>

      {/* Column 2: Filters */}
      <div style={{ flex: '1', minWidth: '350px', padding: '20px', overflowY: 'auto', borderRight: `1px solid ${themeColors.border}`, backgroundColor: themeColors.surface }}>
        
        <h2 style={{ fontSize: '18px', marginTop: 0, color: themeColors.text, marginBottom: '20px' }}>Filtres</h2>
        {currentStreet !== 'Preflop' ? (
          <>
            <ActionTreeNavigator
              allStrategies={allStrategies}
              strategyPath={strategyPath}
              selectedPreflopId={selectedStrategyId}
              currentStreetDb={currentStreetDb}
              pendingVillainNodeId={pendingVillainNodeId}
              onSelectVillain={handleSelectVillainAction}
              onSelectHero={handleSelectHeroAction}
              onGoBack={handleGoBack}
              onResetPath={() => {
                setStrategyPath([]);
                setPendingVillainNodeId(null);
                if (selectedStrategyId) {
                  const preflop = allStrategies.find(s => s.id.toString() === selectedStrategyId);
                  if (preflop) applyStrategySettings(preflop);
                }
              }}
            />
            <CategoryFilter
              key={currentStreetDb}
              baseRange={baseRangeForCurrentStreet}
              board={boardCards}
              onChange={handleRangeChange}
              onRangeGroupsChange={handleRangeGroupsChange}
              onBaseCategoriesChange={setBaseCategories}
              onActiveCategoriesChange={handleActiveCategoriesChange}
              deadCards={heroDeadCards}
              strategyId={selectedStreetStrategy?.id}
              strategyData={selectedStreetStrategy?.strategy_data as Record<string, number> | undefined}
              filterRevision={filterRevision}
            />
          </>
        ) : (
          <div style={{ color: themeColors.textMuted, fontStyle: 'italic', padding: '20px', backgroundColor: themeColors.surfaceAlt, borderRadius: '8px', textAlign: 'center' }}>
            Les filtres seront disponibles au Flop, Turn et River.
          </div>
        )}
      </div>

        {/* Column 3: EV & Results */}
        <form onSubmit={handleSubmit} style={{ flex: '1', minWidth: '350px', padding: '20px', overflowY: 'auto', backgroundColor: themeColors.surfaceAlt, display: 'flex', flexDirection: 'column', gap: '20px', margin: 0 }}>
          
          <div style={{ backgroundColor: themeColors.surface, borderRadius: '8px', padding: '15px', border: `1px solid ${themeColors.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, color: themeColors.text, fontSize: '16px', marginBottom: '15px' }}>Paramètres d'EV</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: themeColors.textMuted, marginBottom: '4px', fontWeight: 'bold' }}>Taille du Pot</label>
                <input 
                  type="number" 
                  value={potSize || ''} 
                  onChange={(e) => setPotSize(Number(e.target.value))}
                  placeholder="Ex: 100"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${themeColors.borderInput}`, fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', color: themeColors.textMuted, marginBottom: '4px', fontWeight: 'bold' }}>Action Envisagée</label>
                <select 
                  value={actionType} 
                  onChange={(e) => setActionType(e.target.value as any)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${themeColors.borderInput}`, fontSize: '14px', backgroundColor: themeColors.inputBg }}
                >
                  <option value="Check">Check</option>
                  <option value="Check/Fold">Fold</option>
                  <option value="Call">Call</option>
                  <option value="Bet/Raise">Bet / Raise</option>
                </select>
              </div>

              {actionType !== 'Check/Fold' && actionType !== 'Check' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: themeColors.textMuted, marginBottom: '4px', fontWeight: 'bold' }}>
                    Montant ({actionType === 'Call' ? 'à payer' : 'de la mise'})
                  </label>
                  <input 
                    type="number" 
                    value={actionAmount || ''} 
                    onChange={(e) => setActionAmount(Number(e.target.value))}
                    placeholder="Ex: 50"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${themeColors.borderInput}`, fontSize: '14px' }}
                  />
                </div>
              )}

              {actionType === 'Bet/Raise' && (() => {
                const feDirectProfit = hasDirectProfit(foldEquity, potSize, actionAmount);
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '14px', color: themeColors.textMuted, fontWeight: 'bold', margin: 0 }}>
                        Fold Equity (%)
                      </label>
                      {currentStreet !== 'Preflop' && baseCombos > 0 && (
                        <span style={{ fontSize: '11px', color: '#3498db' }}>
                          Auto-calculé via le filtre
                        </span>
                      )}
                    </div>
                    <input 
                      type="number" 
                      value={foldEquity === 0 && baseCombos === 0 ? '' : foldEquity} 
                      onChange={(e) => setFoldEquity(Number(e.target.value))}
                      placeholder="Ex: 30"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: `1px solid ${feDirectProfit ? '#27ae60' : themeColors.borderInput}`,
                        fontSize: '14px',
                        backgroundColor: feDirectProfit ? '#e8f8f5' : themeColors.surface,
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '15px',
              backgroundColor: loading ? '#95a5a6' : '#3498db',
              color: themeColors.surface,
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px rgba(52, 152, 219, 0.3)',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Calcul en cours...' : 'Calculer l\'Équité'}
          </button>

          {error && (
            <div style={{ padding: '15px', backgroundColor: '#e74c3c', color: themeColors.surface, borderRadius: '8px', boxShadow: '0 2px 4px rgba(231, 76, 60, 0.3)' }}>
              <strong>Erreur:</strong> {error}
            </div>
          )}

          {result && (
            <div style={{ padding: '20px', backgroundColor: themeColors.surface, borderRadius: '8px', border: `1px solid ${themeColors.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 15px 0', color: '#27ae60', fontSize: '24px' }}>
                Équité : {(result.equity * 100).toFixed(2)}%
              </h2>
              
              {(() => {
                const eq = result.equity;
                let ev = 0;
                
                if (actionType === 'Check/Fold') {
                  ev = 0;
                } else if (actionType === 'Check') {
                  ev = eq * potSize;
                } else if (actionType === 'Call') {
                  ev = (eq * potSize) - ((1 - eq) * actionAmount);
                } else if (actionType === 'Bet/Raise') {
                  const fe = foldEquity / 100;
                  ev = (fe * potSize) + ((1 - fe) * ((eq * (potSize + actionAmount)) - ((1 - eq) * actionAmount)));
                }

                return (
                  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: ev > 0 ? '#e8f8f5' : (ev < 0 ? '#fdedec' : themeColors.surfaceAlt), borderRadius: '8px', border: `1px solid ${ev > 0 ? '#27ae60' : (ev < 0 ? '#e74c3c' : themeColors.borderInput)}` }}>
                    <h3 style={{ margin: '0 0 10px 0', color: ev > 0 ? '#27ae60' : (ev < 0 ? '#e74c3c' : themeColors.text), textAlign: 'center', fontSize: '18px' }}>
                      Expected Value (EV) : {ev > 0 ? '+' : ''}{ev.toFixed(2)}
                    </h3>
                    <div style={{ fontSize: '13px', color: themeColors.textMuted, textAlign: 'center' }}>
                      {actionType === 'Check/Fold' && "L'EV d'un fold est toujours de 0."}
                      {actionType === 'Check' && `Basé sur un pot de ${potSize} (réalisation de l'équité au showdown).`}
                      {actionType === 'Call' && `Basé sur un pot de ${potSize} et un call de ${actionAmount}.`}
                      {actionType === 'Bet/Raise' && `Basé sur un pot de ${potSize}, une mise de ${actionAmount} et ${foldEquity}% de fold equity.`}
                    </div>
                  </div>
                );
              })()}

              <div style={{ height: '20px', backgroundColor: themeColors.border, borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ width: `${result.equity * 100}%`, height: '100%', backgroundColor: '#27ae60', transition: 'width 0.5s ease-in-out' }}></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                <div style={{ padding: '10px', backgroundColor: themeColors.surfaceAlt, borderRadius: '6px', border: `1px solid ${themeColors.border}` }}>
                  <div style={{ fontSize: '12px', color: themeColors.textMuted, marginBottom: '4px' }}>Victoires</div>
                  <div style={{ fontWeight: 'bold', color: themeColors.text }}>{result.wins.toLocaleString()}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: themeColors.surfaceAlt, borderRadius: '6px', border: `1px solid ${themeColors.border}` }}>
                  <div style={{ fontSize: '12px', color: themeColors.textMuted, marginBottom: '4px' }}>Égalités</div>
                  <div style={{ fontWeight: 'bold', color: themeColors.text }}>{result.ties.toLocaleString()}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: themeColors.surfaceAlt, borderRadius: '6px', border: `1px solid ${themeColors.border}` }}>
                  <div style={{ fontSize: '12px', color: themeColors.textMuted, marginBottom: '4px' }}>Défaites</div>
                  <div style={{ fontWeight: 'bold', color: themeColors.text }}>{result.losses.toLocaleString()}</div>
                </div>
              </div>
              
              <div style={{ marginTop: '15px', fontSize: '12px', color: '#95a5a6', textAlign: 'center' }}>
                Basé sur {result.iterations.toLocaleString()} itérations (Calculé en {result.time_ms}ms)
              </div>
            </div>
          )}

          {/* All Strategies Results */}
          {heroMode === 'range' && (
            <div style={{ backgroundColor: themeColors.surface, borderRadius: '8px', padding: '15px', border: `1px solid ${themeColors.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <HeroStrategyMatrix
                recommendations={heroRecommendations}
                actions={heroActionOptions}
                actionStyleMap={heroActionStyles}
                comboDetailsByHand={heroComboDetailsByHand}
                loading={heroStrategyLoading}
                error={heroStrategyError}
                aggregateEV={heroAggregateEV}
                currentStreet={currentStreet}
                deadCards={heroDeadCards}
              />
            </div>
          )}

          {currentStreet !== 'Preflop' && heroStrategiesAtStreet.length > 0 && isHeroReady && (
            <div style={{ backgroundColor: themeColors.surface, borderRadius: '8px', padding: '15px', border: `1px solid ${themeColors.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, color: themeColors.text, fontSize: '16px', marginBottom: '15px' }}>Toutes les lignes ({currentStreet})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {heroStrategiesAtStreet.map(strategy => {
                  const res = strategiesResults[strategy.id];
                  const villain = getVillainNodeForHero(allStrategies, strategy);
                  const isSelected = selectedStreetStrategy?.id === strategy.id;
                  return (
                    <div
                      key={strategy.id}
                      onClick={() => {
                        if (villain) {
                          handleSelectLine(villain, strategy);
                        } else {
                          handleSelectHeroAction(strategy);
                        }
                      }}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: `1px solid ${isSelected ? '#27ae60' : themeColors.border}`,
                        backgroundColor: isSelected ? '#e8f8f5' : themeColors.surfaceAlt,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: themeColors.text, marginBottom: '5px' }}>
                        {villain ? `${formatVillainAction(villain)} → ` : ''}{formatHeroAction(strategy)}
                      </div>
                      {res?.loading ? (
                        <div style={{ fontSize: '13px', color: themeColors.textMuted }}>Calcul en cours...</div>
                      ) : res?.error ? (
                        <div style={{ fontSize: '13px', color: '#e74c3c' }}>Erreur: {res.error}</div>
                      ) : res ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: '#27ae60', fontWeight: 'bold' }}>Eq: {(res.equity * 100).toFixed(1)}%</span>
                          <span style={{ color: res.ev > 0 ? '#27ae60' : (res.ev < 0 ? '#e74c3c' : themeColors.textMuted), fontWeight: 'bold' }}>
                            EV: {res.ev > 0 ? '+' : ''}{res.ev.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: themeColors.textMuted }}>En attente...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </div>

      {isHeroRangeModalOpen && (
        <HeroRangeModal
          selectedRange={heroRange}
          deadCards={boardCards}
          onClose={() => setIsHeroRangeModalOpen(false)}
          onSave={(range) => {
            setHeroRange(range);
            setIsPlayerHandOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default PokerEquityCalculator;
