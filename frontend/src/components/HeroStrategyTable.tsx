import { themeColors } from '../utils/themeColors';
import React, { useState } from 'react';
import {
  HandRecommendation,
  ActionDisplayStyle,
  ActionOption,
  ComboPlayDetail,
} from '../utils/heroStrategyUtils';
import { HeroStrategyTooltip, HeroStrategyTooltipState } from './HeroStrategyTooltip';

interface HeroStrategyTableProps {
  recommendations: HandRecommendation[];
  actions: ActionOption[];
  actionStyleMap: Record<string, ActionDisplayStyle>;
  deadCards?: string[];
  comboDetailsByHand?: Record<string, ComboPlayDetail[]>;
  size?: 'normal' | 'large';
  maxHeight?: string;
}

export const HeroStrategyTable: React.FC<HeroStrategyTableProps> = ({
  recommendations,
  actions,
  actionStyleMap,
  deadCards = [],
  comboDetailsByHand,
  size = 'normal',
  maxHeight,
}) => {
  const [hoverTooltip, setHoverTooltip] = useState<HeroStrategyTooltipState | null>(null);
  const [tooltipPinned, setTooltipPinned] = useState(false);

  const hoveredRec = hoverTooltip
    ? recommendations.find(r => r.hand === hoverTooltip.hand)
    : undefined;

  const fontSize = size === 'large' ? '16px' : '12px';
  const cellPadding = size === 'large' ? '12px' : '6px';
  const headerBadgeSize = size === 'large' ? '12px' : '10px';
  const actionBadgeSize = size === 'large' ? '12px' : '10px';
  const minActionWidth = size === 'large' ? '76px' : '52px';

  const updateHover = (hand: string, x: number, y: number) => {
    setTooltipPinned(false);
    setHoverTooltip({ hand, x, y });
  };

  const clearHover = () => {
    if (!tooltipPinned) setHoverTooltip(null);
  };

  return (
    <>
      <div style={{
        overflowX: 'auto',
        maxHeight: maxHeight ?? (size === 'large' ? '75vh' : '300px'),
        overflowY: 'auto',
      }}
      onMouseLeave={() => {
        if (!tooltipPinned) setHoverTooltip(null);
      }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
          <thead>
            <tr style={{ backgroundColor: themeColors.surfaceAlt, position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ padding: cellPadding, textAlign: 'left', borderBottom: `1px solid ${themeColors.border}` }}>Main</th>
              <th style={{ padding: cellPadding, textAlign: 'center', borderBottom: `1px solid ${themeColors.border}` }}>Combos</th>
              <th style={{ padding: cellPadding, textAlign: 'center', borderBottom: `1px solid ${themeColors.border}` }}>Eq%</th>
              {actions.map(a => (
                <th
                  key={a.id}
                  style={{
                    padding: cellPadding,
                    textAlign: 'center',
                    borderBottom: `1px solid ${themeColors.border}`,
                    minWidth: minActionWidth,
                    backgroundColor: `${a.color}18`,
                  }}
                  title={a.label}
                >
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    backgroundColor: a.color,
                    color: themeColors.surface,
                    fontWeight: 'bold',
                    fontSize: headerBadgeSize,
                    marginBottom: '2px',
                  }}>
                    {a.shortLabel}
                  </div>
                </th>
              ))}
              <th style={{ padding: cellPadding, textAlign: 'center', borderBottom: `1px solid ${themeColors.border}` }}>→</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map(rec => {
              const style = actionStyleMap[rec.hand];
              const isHighlighted = rec.hand === hoverTooltip?.hand;
              return (
                <tr
                  key={rec.hand}
                  onMouseEnter={e => updateHover(rec.hand, e.clientX, e.clientY)}
                  onMouseLeave={clearHover}
                  onMouseMove={e => updateHover(rec.hand, e.clientX, e.clientY)}
                  style={{
                    cursor: 'default',
                    backgroundColor: isHighlighted ? themeColors.activeBg : 'transparent',
                  }}
                >
                  <td style={{ padding: cellPadding, fontWeight: 'bold' }}>{rec.hand}</td>
                  <td style={{ padding: cellPadding, textAlign: 'center' }}>{rec.combos}</td>
                  <td style={{ padding: cellPadding, textAlign: 'center' }}>
                    {(rec.equities[rec.bestActionId] * 100).toFixed(1)}%
                  </td>
                  {actions.map(a => {
                    const ev = rec.evs[a.id];
                    const isBest = a.id === rec.bestActionId;
                    return (
                      <td
                        key={a.id}
                        style={{
                          padding: cellPadding,
                          textAlign: 'center',
                          color: ev > 0 ? '#27ae60' : ev < 0 ? '#e74c3c' : themeColors.textMuted,
                          fontWeight: isBest ? 'bold' : 'normal',
                          backgroundColor: isBest ? `${a.color}22` : 'transparent',
                          borderLeft: isBest ? `2px solid ${a.color}` : 'none',
                        }}
                      >
                        {ev > 0 ? '+' : ''}{ev.toFixed(1)}
                      </td>
                    );
                  })}
                  <td style={{ padding: cellPadding, textAlign: 'center' }}>
                    {style && (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: style.color,
                        color: themeColors.surface,
                        fontWeight: 'bold',
                        fontSize: actionBadgeSize,
                      }}>
                        {style.shortLabel}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hoverTooltip && hoveredRec && (
        <HeroStrategyTooltip
          tooltip={hoverTooltip}
          deadCards={deadCards}
          comboDetails={comboDetailsByHand?.[hoverTooltip.hand]}
          handRecommendation={hoveredRec}
          actionOptions={actions}
          size={size}
          onMouseEnter={() => setTooltipPinned(true)}
          onMouseLeave={() => {
            setTooltipPinned(false);
            setHoverTooltip(null);
          }}
        />
      )}
    </>
  );
};
