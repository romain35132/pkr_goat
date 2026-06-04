import React, { useState, useEffect, useMemo } from 'react';
import { CardSelector } from './components/CardSelector';
import { RangeSelector, getComboCount } from './components/RangeSelector';
import { CategoryFilter } from './components/CategoryFilter';

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
  if (cards.length === 0) return <strong style={{ color: '#2c3e50' }}>Aucune</strong>;
  
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
            backgroundColor: 'white',
            border: '1px solid #bdc3c7',
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
  const [boardCards, setBoardCards] = useState<string[]>([]);
  
  const [ranges, setRanges] = useState<Record<Street, Record<string, number>>>({
    Preflop: {},
    Flop: {},
    Turn: {},
    River: {}
  });
  
  const [isPlayerHandOpen, setIsPlayerHandOpen] = useState(true);
  const [isBoardOpen, setIsBoardOpen] = useState(true);

  const [potSize, setPotSize] = useState<number>(0);
  const [actionType, setActionType] = useState<'Check/Fold' | 'Call' | 'Bet/Raise'>('Call');
  const [actionAmount, setActionAmount] = useState<number>(0);
  const [foldEquity, setFoldEquity] = useState<number>(0);

  const [result, setResult] = useState<EquityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [postflopRangeGroups, setPostflopRangeGroups] = useState<Record<string, number>>({});
  const [postflopAllowedHands, setPostflopAllowedHands] = useState<string[]>([]);

  const [allStrategies, setAllStrategies] = useState<any[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [selectedFlopStrategyId, setSelectedFlopStrategyId] = useState<string>('');

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

  const preflopStrategies = useMemo(() => allStrategies.filter(s => s.street === 'PREFLOP'), [allStrategies]);
  const flopStrategies = useMemo(() => {
    if (!selectedStrategyId) return [];
    return allStrategies.filter(s => s.street === 'FLOP' && s.parent_strategy_id?.toString() === selectedStrategyId);
  }, [allStrategies, selectedStrategyId]);

  // Determine current street based on board cards length
  const getCurrentStreet = (cards: string[]): Street => {
    if (cards.length < 3) return 'Preflop';
    if (cards.length === 3) return 'Flop';
    if (cards.length === 4) return 'Turn';
    return 'River';
  };
  
  const currentStreet = getCurrentStreet(boardCards);
  const currentRange = ranges[currentStreet];

  const opponentCombos = useMemo(() => {
    let total = 0;
    const deadCards = [...playerCards, ...boardCards];
    for (const [hand, weight] of Object.entries(currentRange)) {
      if (weight > 0) {
        total += getComboCount(hand, deadCards) * (weight / 100);
      }
    }
    return total;
  }, [currentRange, playerCards, boardCards]);

  const getBaseRangeForCurrentStreet = () => {
    if (currentStreet === 'Flop') return ranges.Preflop;
    if (currentStreet === 'Turn') return ranges.Flop;
    if (currentStreet === 'River') return ranges.Turn;
    return {};
  };

  const baseCombos = useMemo(() => {
    let total = 0;
    const deadCards = [...playerCards, ...boardCards];
    const baseRange = getBaseRangeForCurrentStreet();
    for (const [hand, weight] of Object.entries(baseRange)) {
      if (weight > 0) {
        total += getComboCount(hand, deadCards) * (weight / 100);
      }
    }
    return total;
  }, [ranges, currentStreet, playerCards, boardCards]);

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

  // Auto-collapse when selections are complete
  useEffect(() => {
    if (playerCards.length === 2) {
      setIsPlayerHandOpen(false);
    }
  }, [playerCards.length]);

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
      if (playerCards.length !== 2) {
        return;
      }
      if (Object.keys(currentRange).length === 0) {
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
          body: JSON.stringify({
            player_hand: playerHand,
            opponent_range: opponentRange,
            board: board,
            iterations: 100000,
          }),
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

    if (playerCards.length === 2 && Object.keys(currentRange).length > 0) {
      calculateEquity();
    } else {
      setResult(null);
    }

    return () => {
      isActive = false;
    };
  }, [playerHand, opponentRange, board, playerCards.length, currentRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (playerCards.length !== 2) {
      setError('Veuillez sélectionner exactement 2 cartes pour votre main.');
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
        body: JSON.stringify({
          player_hand: playerHand,
          opponent_range: opponentRange,
          board: board,
          iterations: 100000,
        }),
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
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', fontFamily: 'sans-serif', backgroundColor: '#f0f2f5' }}>
      
      {/* Column 1: Range Selector */}
      <div style={{ flex: '1.2', minWidth: '400px', padding: '20px', overflowY: 'auto', borderRight: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '18px', color: '#2c3e50' }}>
            Range Adverse - {currentStreet}
          </label>
          <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
            {Object.keys(currentRange).length} mains, {opponentCombos % 1 !== 0 ? opponentCombos.toFixed(1) : opponentCombos} combos
          </div>
        </div>

        {currentStreet === 'Preflop' && preflopStrategies.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#7f8c8d' }}>
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
                      if (typeof dataToImport === 'object') {
                        handleRangeChange(dataToImport);
                      }
                    }
                    if (strategy.pot_size_bb !== null && strategy.pot_size_bb !== undefined) {
                      setPotSize(strategy.pot_size_bb);
                    }
                    if (strategy.hero_action) {
                      if (strategy.hero_action === 'FOLD' || strategy.hero_action === 'CHECK') {
                        setActionType('Check/Fold');
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
                border: '1px solid #bdc3c7',
                backgroundColor: 'white',
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
              deadCards={[...playerCards, ...boardCards]}
            />
          ) : (
            <RangeSelector 
              selectedHands={postflopRangeGroups}
              onChange={() => {}} 
              allowedHands={postflopAllowedHands}
              readOnly={true}
              deadCards={[...playerCards, ...boardCards]}
            />
          )}
        </div>
        
        <div style={{ marginTop: '20px', fontSize: '12px', color: '#7f8c8d', maxHeight: '100px', overflowY: 'auto', wordBreak: 'break-all', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          {opponentRange || 'Aucun range sélectionné'}
        </div>
      </div>

      {/* Column 2: Filters */}
      <div style={{ flex: '1', minWidth: '350px', padding: '20px', overflowY: 'auto', borderRight: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
        
        <h2 style={{ fontSize: '18px', marginTop: 0, color: '#2c3e50', marginBottom: '20px' }}>Filtres</h2>
        {currentStreet !== 'Preflop' ? (
          <>
            {currentStreet === 'Flop' && flopStrategies.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#7f8c8d', fontWeight: 'bold' }}>
                  Importer une stratégie Flop (Réaction) :
                </label>
                <select
                  value={selectedFlopStrategyId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedFlopStrategyId(id);
                    if (id) {
                      const strategy = flopStrategies.find(s => s.id.toString() === id);
                      if (strategy) {
                        if (strategy.pot_size_bb !== null && strategy.pot_size_bb !== undefined) {
                          setPotSize(strategy.pot_size_bb);
                        }
                        if (strategy.hero_action) {
                          if (strategy.hero_action === 'FOLD' || strategy.hero_action === 'CHECK') {
                            setActionType('Check/Fold');
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
                    border: '1px solid #bdc3c7',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="">-- Sélectionner une stratégie Flop --</option>
                  {flopStrategies.map(s => (
                    <option key={s.id} value={s.id}>{s.title || `Stratégie #${s.id}`}</option>
                  ))}
                </select>
              </div>
            )}
            <CategoryFilter 
              baseRange={getBaseRangeForCurrentStreet()}
              board={boardCards}
              onChange={handleRangeChange}
              onRangeGroupsChange={handleRangeGroupsChange}
              deadCards={[...playerCards, ...boardCards]}
              strategyData={selectedFlopStrategyId ? allStrategies.find(s => s.id.toString() === selectedFlopStrategyId)?.strategy_data : undefined}
            />
          </>
        ) : (
          <div style={{ color: '#7f8c8d', fontStyle: 'italic', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
            Les filtres seront disponibles au Flop, Turn et River.
          </div>
        )}
      </div>

      {/* Columns 3 & 4: My Hand, Board, EV, Equity */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flex: '2', minWidth: '700px', margin: 0, padding: 0 }}>
        
        {/* Column 3: My Hand, Board */}
        <div style={{ flex: '1', minWidth: '350px', padding: '20px', overflowY: 'auto', borderRight: '1px solid #e0e0e0', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '15px', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div 
              onClick={() => setIsPlayerHandOpen(!isPlayerHandOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <label style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer', color: '#2c3e50' }}>
                Votre Main ({playerCards.length}/2)
              </label>
              <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
                {isPlayerHandOpen ? '▼ Replier' : '▶ Déplier'}
              </span>
            </div>
            
            {isPlayerHandOpen && (
              <div style={{ marginTop: '15px' }}>
                <CardSelector 
                  selectedCards={playerCards} 
                  onChange={setPlayerCards} 
                  maxCards={2} 
                  disabledCards={boardCards}
                />
              </div>
            )}
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#7f8c8d' }}>
              Sélection: <SelectedCardsDisplay cards={playerCards} />
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '15px', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div 
              onClick={() => setIsBoardOpen(!isBoardOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <label style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer', color: '#2c3e50' }}>
                Board ({boardCards.length}/5)
              </label>
              <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
                {isBoardOpen ? '▼ Replier' : '▶ Déplier'}
              </span>
            </div>
            
            {isBoardOpen && (
              <div style={{ marginTop: '15px' }}>
                <CardSelector 
                  selectedCards={boardCards} 
                  onChange={setBoardCards} 
                  maxCards={5} 
                  disabledCards={playerCards}
                />
              </div>
            )}
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#7f8c8d' }}>
              Sélection: <SelectedCardsDisplay cards={boardCards} />
            </div>
          </div>

        </div>

        {/* Column 4: EV & Results */}
        <div style={{ flex: '1', minWidth: '350px', padding: '20px', overflowY: 'auto', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '15px', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50', fontSize: '16px', marginBottom: '15px' }}>Paramètres d'EV</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#7f8c8d', marginBottom: '4px', fontWeight: 'bold' }}>Taille du Pot</label>
                <input 
                  type="number" 
                  value={potSize || ''} 
                  onChange={(e) => setPotSize(Number(e.target.value))}
                  placeholder="Ex: 100"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bdc3c7', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#7f8c8d', marginBottom: '4px', fontWeight: 'bold' }}>Action Envisagée</label>
                <select 
                  value={actionType} 
                  onChange={(e) => setActionType(e.target.value as any)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bdc3c7', fontSize: '14px', backgroundColor: 'white' }}
                >
                  <option value="Check/Fold">Check / Fold</option>
                  <option value="Call">Call</option>
                  <option value="Bet/Raise">Bet / Raise</option>
                </select>
              </div>

              {actionType !== 'Check/Fold' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#7f8c8d', marginBottom: '4px', fontWeight: 'bold' }}>
                    Montant ({actionType === 'Call' ? 'à payer' : 'de la mise'})
                  </label>
                  <input 
                    type="number" 
                    value={actionAmount || ''} 
                    onChange={(e) => setActionAmount(Number(e.target.value))}
                    placeholder="Ex: 50"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bdc3c7', fontSize: '14px' }}
                  />
                </div>
              )}

              {actionType === 'Bet/Raise' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '14px', color: '#7f8c8d', fontWeight: 'bold', margin: 0 }}>
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
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bdc3c7', fontSize: '14px' }}
                  />
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '15px',
              backgroundColor: loading ? '#95a5a6' : '#3498db',
              color: 'white',
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
            <div style={{ padding: '15px', backgroundColor: '#e74c3c', color: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(231, 76, 60, 0.3)' }}>
              <strong>Erreur:</strong> {error}
            </div>
          )}

          {result && (
            <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 15px 0', color: '#27ae60', fontSize: '24px' }}>
                Équité : {(result.equity * 100).toFixed(2)}%
              </h2>
              
              {(() => {
                const eq = result.equity;
                let ev = 0;
                
                if (actionType === 'Check/Fold') {
                  ev = 0;
                } else if (actionType === 'Call') {
                  ev = (eq * potSize) - ((1 - eq) * actionAmount);
                } else if (actionType === 'Bet/Raise') {
                  const fe = foldEquity / 100;
                  ev = (fe * potSize) + ((1 - fe) * ((eq * (potSize + actionAmount)) - ((1 - eq) * actionAmount)));
                }

                return (
                  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: ev > 0 ? '#e8f8f5' : (ev < 0 ? '#fdedec' : '#f8f9fa'), borderRadius: '8px', border: `1px solid ${ev > 0 ? '#27ae60' : (ev < 0 ? '#e74c3c' : '#bdc3c7')}` }}>
                    <h3 style={{ margin: '0 0 10px 0', color: ev > 0 ? '#27ae60' : (ev < 0 ? '#e74c3c' : '#2c3e50'), textAlign: 'center', fontSize: '18px' }}>
                      Expected Value (EV) : {ev > 0 ? '+' : ''}{ev.toFixed(2)}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#7f8c8d', textAlign: 'center' }}>
                      {actionType === 'Check/Fold' && "L'EV d'un fold est toujours de 0."}
                      {actionType === 'Call' && `Basé sur un pot de ${potSize} et un call de ${actionAmount}.`}
                      {actionType === 'Bet/Raise' && `Basé sur un pot de ${potSize}, une mise de ${actionAmount} et ${foldEquity}% de fold equity.`}
                    </div>
                  </div>
                );
              })()}

              <div style={{ height: '20px', backgroundColor: '#ecf0f1', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ width: `${result.equity * 100}%`, height: '100%', backgroundColor: '#27ae60', transition: 'width 0.5s ease-in-out' }}></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #ecf0f1' }}>
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Victoires</div>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{result.wins.toLocaleString()}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #ecf0f1' }}>
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Égalités</div>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{result.ties.toLocaleString()}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #ecf0f1' }}>
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Défaites</div>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{result.losses.toLocaleString()}</div>
                </div>
              </div>
              
              <div style={{ marginTop: '15px', fontSize: '12px', color: '#95a5a6', textAlign: 'center' }}>
                Basé sur {result.iterations.toLocaleString()} itérations (Calculé en {result.time_ms}ms)
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default PokerEquityCalculator;
