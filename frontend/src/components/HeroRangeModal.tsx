import { themeColors } from '../utils/themeColors';
import React, { useState, useEffect, useMemo } from 'react';
import { RangeSelector, getComboCount } from './RangeSelector';

interface HeroRangeModalProps {
  selectedRange: Record<string, number>;
  deadCards: string[];
  onClose: () => void;
  onSave: (range: Record<string, number>) => void;
}

export const HeroRangeModal: React.FC<HeroRangeModalProps> = ({
  selectedRange,
  deadCards,
  onClose,
  onSave,
}) => {
  const [localRange, setLocalRange] = useState<Record<string, number>>(selectedRange);

  useEffect(() => {
    setLocalRange(selectedRange);
  }, [selectedRange]);

  const comboCount = useMemo(() => {
    let total = 0;
    for (const [hand, weight] of Object.entries(localRange)) {
      if (weight > 0) {
        total += getComboCount(hand, deadCards) * (weight / 100);
      }
    }
    return total;
  }, [localRange, deadCards]);

  const handCount = Object.keys(localRange).filter(h => localRange[h] > 0).length;

  const handleSave = () => {
    onSave(localRange);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: themeColors.inputBg,
          padding: '24px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: '8px', color: themeColors.text }}>
          Sélectionner votre Range Hero
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: themeColors.textMuted }}>
          {handCount} main{handCount !== 1 ? 's' : ''} — {comboCount % 1 !== 0 ? comboCount.toFixed(1) : comboCount} combos
        </p>

        <RangeSelector
          selectedHands={localRange}
          onChange={setLocalRange}
          deadCards={deadCards}
        />

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '20px',
          width: '100%',
          maxWidth: '700px',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              cursor: 'pointer',
              border: `1px solid ${themeColors.borderInput}`,
              borderRadius: '6px',
              backgroundColor: themeColors.surfaceAlt,
              fontSize: '14px',
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '10px 18px',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#3498db',
              color: themeColors.surface,
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
};
