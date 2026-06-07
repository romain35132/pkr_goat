import { themeColors } from '../utils/themeColors';
import React, { useState, useMemo } from 'react';
import { RangeSelector } from './RangeSelector';
import { HeroStrategyExpandedModal } from './HeroStrategyExpandedModal';
import { HeroStrategyTable } from './HeroStrategyTable';
import { HeroStrategyTableExpandedModal } from './HeroStrategyTableExpandedModal';
import {
  HandRecommendation,
  ActionDisplayStyle,
  ActionOption,
  ComboPlayDetail,
  PIO_COLORS,
  PIO_BET_PALETTE,
  isLightActionColor,
} from '../utils/heroStrategyUtils';

interface HeroStrategyMatrixProps {
  recommendations: HandRecommendation[];
  actions: ActionOption[];
  actionStyleMap: Record<string, ActionDisplayStyle>;
  comboDetailsByHand: Record<string, ComboPlayDetail[]>;
  loading: boolean;
  error?: string;
  aggregateEV: number;
  currentStreet: string;
  deadCards: string[];
}

export const HeroStrategyMatrix: React.FC<HeroStrategyMatrixProps> = ({
  recommendations,
  actions,
  actionStyleMap,
  comboDetailsByHand,
  loading,
  error,
  aggregateEV,
  currentStreet,
  deadCards,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [expandedGridOpen, setExpandedGridOpen] = useState(false);
  const [expandedTableOpen, setExpandedTableOpen] = useState(false);

  const legendItems = useMemo(() => {
    const items = new Map<string, { action: ActionOption; count: number }>();
    for (const rec of recommendations) {
      const style = actionStyleMap[rec.hand];
      if (!style) continue;
      const existing = items.get(style.actionId);
      if (existing) {
        existing.count += 1;
      } else {
        const action = actions.find(a => a.id === style.actionId);
        if (action) items.set(style.actionId, { action, count: 1 });
      }
    }
    return Array.from(items.values());
  }, [recommendations, actionStyleMap, actions]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: themeColors.textMuted }}>
        Calcul de la stratégie hero en cours...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '15px', backgroundColor: '#fdedec', borderRadius: '8px', color: '#e74c3c' }}>
        {error}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: themeColors.textMuted, fontStyle: 'italic' }}>
        Sélectionnez un range hero et une stratégie pour voir les recommandations.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, color: themeColors.text, fontSize: '16px' }}>
          Stratégie Hero — {currentStreet}
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => (viewMode === 'grid' ? setExpandedGridOpen(true) : setExpandedTableOpen(true))}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: `1px solid ${themeColors.borderInput}`,
              backgroundColor: themeColors.surface,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Agrandir
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: `1px solid ${viewMode === 'grid' ? '#3498db' : themeColors.borderInput}`,
              backgroundColor: viewMode === 'grid' ? themeColors.activeBg : themeColors.surface,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Grille
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: `1px solid ${viewMode === 'table' ? '#3498db' : themeColors.borderInput}`,
              backgroundColor: viewMode === 'table' ? themeColors.activeBg : themeColors.surface,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Tableau
          </button>
        </div>
      </div>

      <div style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: aggregateEV > 0 ? '#e8f8f5' : aggregateEV < 0 ? '#fdedec' : themeColors.surfaceAlt,
        border: `1px solid ${aggregateEV > 0 ? '#27ae60' : aggregateEV < 0 ? '#e74c3c' : themeColors.borderInput}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '13px', color: themeColors.textMuted }}>EV moyenne pondérée (meilleure action par main)</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: aggregateEV > 0 ? '#27ae60' : aggregateEV < 0 ? '#e74c3c' : themeColors.text }}>
          {aggregateEV > 0 ? '+' : ''}{aggregateEV.toFixed(2)} bb
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        fontSize: '11px',
        padding: '8px 10px',
        backgroundColor: themeColors.surfaceAlt,
        borderRadius: '6px',
        border: `1px solid ${themeColors.border}`,
        alignItems: 'center',
      }}>
        <span style={{ color: themeColors.textMuted, fontWeight: 'bold' }}>Pio :</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: PIO_COLORS.fold }} />
          Fold
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: PIO_COLORS.check }} />
          Check
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: PIO_COLORS.call }} />
          Call
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '48px',
            height: '12px',
            borderRadius: '2px',
            background: `linear-gradient(to right, ${PIO_BET_PALETTE[0]}, ${PIO_BET_PALETTE[PIO_BET_PALETTE.length - 1]})`,
          }} />
          Bet (clair → foncé)
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px' }}>
        {legendItems.map(({ action, count }) => (
          <div
            key={action.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              backgroundColor: themeColors.surfaceAlt,
              borderRadius: '4px',
              border: `1px solid ${themeColors.border}`,
            }}
          >
            <div style={{
              minWidth: '28px',
              height: '20px',
              borderRadius: '3px',
              backgroundColor: action.color,
              color: isLightActionColor(action.color) ? themeColors.text : themeColors.surface,
              fontWeight: 'bold',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: isLightActionColor(action.color) ? '1px solid rgba(0,0,0,0.15)' : 'none',
            }}>
              {action.shortLabel}
            </div>
            <span style={{ color: themeColors.text, maxWidth: '140px' }} title={action.label}>
              {action.label.length > 22 ? action.label.slice(0, 22) + '…' : action.label}
            </span>
            <span style={{ color: themeColors.textMuted }}>({count})</span>
          </div>
        ))}
      </div>

      {viewMode === 'grid' && (
        <>
          <div style={{ fontSize: '12px', color: themeColors.textMuted, fontStyle: 'italic' }}>
            {Object.keys(comboDetailsByHand).length > 0
              ? 'Les cases sont remplies proportionnellement par action. Survolez une main pour le détail combo (grille 3×2 / 2×2 / 4×3).'
              : 'Survolez une main pour voir les combos et leurs stratégies.'}
          </div>
          <RangeSelector
            selectedHands={Object.fromEntries(recommendations.map(r => [r.hand, r.weight]))}
            onChange={() => {}}
            readOnly
            deadCards={deadCards}
            actionStyles={actionStyleMap}
            comboDetailsByHand={comboDetailsByHand}
            recommendations={recommendations}
            actionOptions={actions}
          />
        </>
      )}

      {viewMode === 'table' && (
        <>
        <div style={{ fontSize: '12px', color: themeColors.textMuted, fontStyle: 'italic' }}>
          Survolez une ligne pour voir le détail combo par combo.
        </div>
        <HeroStrategyTable
          recommendations={recommendations}
          actions={actions}
          actionStyleMap={actionStyleMap}
          deadCards={deadCards}
          comboDetailsByHand={comboDetailsByHand}
        />
        </>
      )}

      {expandedGridOpen && (
        <HeroStrategyExpandedModal
          recommendations={recommendations}
          actions={actions}
          actionStyleMap={actionStyleMap}
          comboDetailsByHand={comboDetailsByHand}
          deadCards={deadCards}
          currentStreet={currentStreet}
          onClose={() => setExpandedGridOpen(false)}
        />
      )}

      {expandedTableOpen && (
        <HeroStrategyTableExpandedModal
          recommendations={recommendations}
          actions={actions}
          actionStyleMap={actionStyleMap}
          comboDetailsByHand={comboDetailsByHand}
          deadCards={deadCards}
          currentStreet={currentStreet}
          onClose={() => setExpandedTableOpen(false)}
        />
      )}

    </div>
  );
};
