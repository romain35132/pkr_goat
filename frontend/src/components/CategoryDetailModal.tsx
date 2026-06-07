import { themeColors } from '../utils/themeColors';
import React, { useState, useMemo } from 'react';
import { RangeSelector } from './RangeSelector';

export interface CategorizedHand {
  hand: string;
  weight: number;
}

export interface CategoryResult {
  category: string;
  hands: CategorizedHand[];
}

interface CategoryDetailModalProps {
  category: string;
  hands: CategorizedHand[];
  effectiveRange?: Record<string, number>;
  onClose: () => void;
  onUpdate: (updatedHands: CategorizedHand[]) => void;
}

export const getHandGroup = (combo: string) => {
  const v1 = combo[0];
  const s1 = combo[1];
  const v2 = combo[2];
  const s2 = combo[3];
  const VALUES = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const idx1 = VALUES.indexOf(v1);
  const idx2 = VALUES.indexOf(v2);
  
  const [high, low] = idx1 <= idx2 ? [v1, v2] : [v2, v1];
  
  if (high === low) return `${high}${low}`;
  return `${high}${low}${s1 === s2 ? 's' : 'o'}`;
};

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({ category, hands, effectiveRange, onClose, onUpdate }) => {
  // Determine allowed hand groups and their initial weights based on combos
  const initialGroupWeights = useMemo(() => {
    const groups: Record<string, number[]> = {};
    hands.forEach(h => {
      const g = getHandGroup(h.hand);
      if (!groups[g]) groups[g] = [];
      groups[g].push(h.weight);
    });
    
    const result: Record<string, number> = {};
    for (const [g, weights] of Object.entries(groups)) {
      const maxWeight = Math.max(...weights);
      if (maxWeight > 0) {
        result[g] = maxWeight;
      }
    }
    return result;
  }, [hands]);

  const effectiveGroupWeights = useMemo(() => {
    if (!effectiveRange) return {};
    const groups: Record<string, number[]> = {};
    hands.forEach(h => {
      const g = getHandGroup(h.hand);
      if (!groups[g]) groups[g] = [];
      groups[g].push(effectiveRange[h.hand] || 0);
    });
    
    const result: Record<string, number> = {};
    for (const [g, weights] of Object.entries(groups)) {
      result[g] = Math.max(...weights);
    }
    return result;
  }, [hands, effectiveRange]);

  const [localHands, setLocalHands] = useState<Record<string, number>>(initialGroupWeights);
  const allowedHands = useMemo(() => {
    const groups = new Set<string>();
    hands.forEach(h => groups.add(getHandGroup(h.hand)));
    return Array.from(groups);
  }, [hands]);

  const handleSave = () => {
    // Map back to combos
    const updatedCombos = hands.map(h => {
      const g = getHandGroup(h.hand);
      const newWeight = localHands[g] !== undefined ? localHands[g] : 0;
      return { ...h, weight: newWeight };
    });
    onUpdate(updatedCombos);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{ backgroundColor: themeColors.inputBg, padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: themeColors.text }}>Détails - {category}</h3>
        <RangeSelector 
          selectedHands={localHands}
          onChange={setLocalHands}
          allowedHands={allowedHands}
          effectiveHands={effectiveGroupWeights}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', width: '100%' }}>
          <button onClick={onClose} style={{ padding: '8px 15px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: themeColors.surfaceAlt }}>Annuler</button>
          <button onClick={handleSave} style={{ padding: '8px 15px', cursor: 'pointer', border: 'none', borderRadius: '4px', backgroundColor: '#3498db', color: themeColors.surface }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
};
