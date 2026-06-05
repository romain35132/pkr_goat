import React, { useState, useEffect, useMemo } from 'react';
import { CategoryResult, CategorizedHand, CategoryDetailModal, getHandGroup } from './CategoryDetailModal';

interface CategoryFilterProps {
  baseRange: Record<string, number>;
  board: string[];
  onChange: (newRange: Record<string, number>) => void;
  onRangeGroupsChange?: (groups: Record<string, number>, allowed: string[]) => void;
  onBaseCategoriesChange?: (categories: CategoryResult[]) => void;
  onActiveCategoriesChange?: (activeCategories: Record<string, boolean>) => void;
  deadCards?: string[];
  strategyData?: Record<string, number> | string;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ baseRange, board, onChange, onRangeGroupsChange, onBaseCategoriesChange, onActiveCategoriesChange, deadCards = [], strategyData }) => {
  const [categories, setCategories] = useState<CategoryResult[]>([]);
  const [baseCategories, setBaseCategories] = useState<CategoryResult[]>([]);
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [detailModal, setDetailModal] = useState<{ category: string; hands: CategorizedHand[] } | null>(null);

  useEffect(() => {
    if (board.length < 3 || Object.keys(baseRange).length === 0) return;
    
    const fetchCategories = async () => {
      setLoading(true);
      setError('');
      
      const opponentRange = Object.entries(baseRange)
        .map(([hand, weight]) => (weight === 100 ? hand : `${hand}:${weight}`))
        .join(', ');

      try {
        const res = await fetch('/api/v1/range/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opponent_range: opponentRange,
            board: board.join(' '),
            dead_cards: deadCards.join(' '),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erreur API');
        }

        const data: { categories: CategoryResult[] } = await res.json();
        
        // Sort categories by predefined order
        const order = [
          'StraightFlush', 'FourOfAKind', 'FullHouse', 'Flush', 'Straight', 
          'Set', 'Trips', 'TwoPairBothHoleCards', 'TwoPairOneHoleCard', 
          'Overpair', 'TopPair', 'SecondPair', 'ThirdPair', 'IntermediatePair', 'Underpair', 'SmallPair',
          'OnePair', 
          'HighCard', 'Overcard',
          'ComboDraw', 'OesdAndFd', 'GutshotAndFd', 'FlushDraw', 'Oesd2Card', 'Oesd1Card', 'Gutshot2Card', 'Gutshot1Card',
          'BackdoorFlushDraw1Card', 'BackdoorFlushDraw2Card', 'BackdoorStraightDraw', 'Nothing'
        ];
        
        data.categories.sort((a, b) => {
          const idxA = order.indexOf(a.category);
          const idxB = order.indexOf(b.category);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        });

        setCategories(data.categories);
        const newBaseCategories = JSON.parse(JSON.stringify(data.categories));
        setBaseCategories(newBaseCategories);
        if (onBaseCategoriesChange) {
          onBaseCategoriesChange(newBaseCategories);
        }
        
        // By default, all are active
        const initialActive: Record<string, boolean> = {};
        data.categories.forEach(c => initialActive[c.category] = true);
        setActiveCategories(initialActive);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [baseRange, board.join(' '), deadCards.join(' ')]);

  // Appliquer la strategyData quand elle change
  useEffect(() => {
    if (!strategyData || baseCategories.length === 0) return;
    
    let parsedStrategy: Record<string, number>;
    if (typeof strategyData === 'string') {
      try {
        parsedStrategy = JSON.parse(strategyData);
      } catch {
        return;
      }
    } else {
      parsedStrategy = strategyData;
    }

    setCategories(baseCategories.map(cat => {
      let strategyWeight = parsedStrategy[cat.category];
      
      // Fallback pour les anciennes stratégies enregistrées sans les nouvelles catégories BDFD séparées
      if (strategyWeight === undefined && (cat.category === 'BackdoorFlushDraw1Card' || cat.category === 'BackdoorFlushDraw2Card')) {
        strategyWeight = parsedStrategy['BackdoorFlushDraw'];
      }

      if (typeof strategyWeight === 'string') {
         strategyWeight = parseInt(strategyWeight, 10);
      }
      if (strategyWeight !== undefined && !isNaN(strategyWeight)) {
        const targetCount = Math.round(cat.hands.length * (strategyWeight / 100));
        return {
          ...cat,
          hands: cat.hands.map((h, idx) => ({ 
            ...h, 
            weight: idx < targetCount ? h.weight : 0 
          }))
        };
      }
      return cat;
    }));
  }, [strategyData, baseCategories]);

  const effectiveRange = useMemo(() => {
    const newRange: Record<string, number> = {};
    categories.forEach(cat => {
      if (activeCategories[cat.category]) {
        cat.hands.forEach(h => {
          if (h.weight > 0) {
            newRange[h.hand] = Math.max(newRange[h.hand] || 0, h.weight);
          }
        });
      }
    });
    return newRange;
  }, [categories, activeCategories]);

  // Recompute the effective range whenever active categories or hands change
  useEffect(() => {
    if (categories.length === 0) return;
    onChange(effectiveRange);
  }, [effectiveRange]);

  useEffect(() => {
    if (Object.keys(activeCategories).length === 0) return;
    onActiveCategoriesChange?.(activeCategories);
  }, [activeCategories, onActiveCategoriesChange]);

  const handleToggle = (category: string) => {
    setActiveCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleContextMenu = (e: React.MouseEvent, cat: CategoryResult) => {
    e.preventDefault();
    setDetailModal({ category: cat.category, hands: cat.hands });
  };

  const handleUpdateDetail = (updatedHands: CategorizedHand[]) => {
    if (!detailModal) return;
    
    const updatedWeights = new Map<string, number>();
    updatedHands.forEach(h => updatedWeights.set(h.hand, h.weight));

    setCategories(prev => prev.map(cat => {
      if (cat.category === detailModal.category) {
        return {
          ...cat,
          hands: cat.hands.map(h => {
            if (updatedWeights.has(h.hand)) {
              return { ...h, weight: updatedWeights.get(h.hand)! };
            }
            return h;
          })
        };
      }
      return cat;
    }));
  };

  const aggregatedGroupWeights = useMemo(() => {
    const groups: Record<string, number[]> = {};
    categories.forEach(cat => {
      if (activeCategories[cat.category]) {
        cat.hands.forEach(h => {
          if (h.weight > 0) {
            const g = getHandGroup(h.hand);
            if (!groups[g]) groups[g] = [];
            groups[g].push(h.weight);
          }
        });
      }
    });
    
    const result: Record<string, number> = {};
    for (const [g, weights] of Object.entries(groups)) {
      result[g] = Math.max(...weights);
    }
    return result;
  }, [categories, activeCategories]);

  const allowedHands = useMemo(() => {
    const groups = new Set<string>();
    categories.forEach(cat => {
      cat.hands.forEach(h => {
        groups.add(getHandGroup(h.hand));
      });
    });
    return Array.from(groups);
  }, [categories]);

  useEffect(() => {
    if (onRangeGroupsChange) {
      onRangeGroupsChange(aggregatedGroupWeights, allowedHands);
    }
  }, [aggregatedGroupWeights, allowedHands, onRangeGroupsChange]);

  if (loading) return <div>Chargement des catégories...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (categories.length === 0) return <div>Aucune main classifiée.</div>;

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

  const mainsFaites = categories.filter(c => madeHandsSet.has(c.category));
  const leReste = categories.filter(c => !madeHandsSet.has(c.category));

  const renderCategory = (cat: CategoryResult) => {
    const isActive = activeCategories[cat.category];
    const comboCount = cat.hands.reduce((acc, h) => {
      const weight = Math.max(h.weight, effectiveRange[h.hand] || 0);
      return acc + weight / 100;
    }, 0);
    const displayCount = comboCount % 1 === 0 ? comboCount : comboCount.toFixed(1);
    
    return (
      <div 
        key={cat.category}
        onClick={() => handleToggle(cat.category)}
        onContextMenu={(e) => handleContextMenu(e, cat)}
        style={{
          padding: '8px 12px',
          border: '1px solid',
          borderColor: isActive ? '#27ae60' : '#bdc3c7',
          backgroundColor: isActive ? '#e8f8f5' : '#ecf0f1',
          borderRadius: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <input 
          type="checkbox" 
          checked={isActive} 
          onChange={() => {}} // handled by parent div
          style={{ pointerEvents: 'none' }}
        />
        <span>{categoryNames[cat.category] || cat.category} ({displayCount})</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={{ margin: 0, fontSize: '14px', color: '#7f8c8d' }}>
        Filtrez les mains qui continuent (clic droit pour le détail)
      </p>

      <p style={{ margin: 0, fontSize: '14px', color: '#2c3e50', fontWeight: 'bold' }}>
        Mains faites (pair+)
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
        {mainsFaites.map(renderCategory)}
      </div>

      <p style={{ margin: 0, fontSize: '14px', color: '#2c3e50', fontWeight: 'bold' }}>
        Le reste
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {leReste.map(renderCategory)}
      </div>

      {detailModal && (
        <CategoryDetailModal
          category={categoryNames[detailModal.category] || detailModal.category}
          hands={detailModal.hands}
          effectiveRange={effectiveRange}
          onClose={() => setDetailModal(null)}
          onUpdate={handleUpdateDetail}
        />
      )}
    </div>
  );
};
