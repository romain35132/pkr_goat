import React from 'react';
import { ComboCards } from './PlayingCard';
import {
  ActionOption,
  ComboPlayDetail,
  HandRecommendation,
  buildHandComboGrid,
  getHandGridLayout,
  getComboPlayDetail,
  getActionBadgeStyles,
} from '../utils/heroStrategyUtils';

interface HeroComboGridTooltipProps {
  hand: string;
  deadCards: string[];
  comboDetails?: ComboPlayDetail[];
  handRecommendation?: HandRecommendation;
  actionOptions?: ActionOption[];
  size?: 'normal' | 'large';
}

const CELL_WIDTH: Record<'normal' | 'large', number> = {
  normal: 90,
  large: 178,
};

const CELL_GAP: Record<'normal' | 'large', number> = {
  normal: 6,
  large: 10,
};

const TOOLTIP_WIDTH: Record<string, Record<'normal' | 'large', number>> = {
  offsuit: { normal: 390, large: 750 },
  pair: { normal: 290, large: 560 },
  suited: { normal: 200, large: 370 },
};

const formatEv = (ev: number) => `${ev > 0 ? '+' : ''}${ev.toFixed(2)}`;

export const HeroComboGridTooltip: React.FC<HeroComboGridTooltipProps> = ({
  hand,
  deadCards,
  comboDetails,
  handRecommendation,
  actionOptions,
  size = 'normal',
}) => {
  const grid = buildHandComboGrid(hand, deadCards);
  const cellWidth = CELL_WIDTH[size];
  const cellGap = CELL_GAP[size];
  const evFontSize = '11px';
  const cellPadding = size === 'large' ? '7px 9px' : '4px 5px';
  const cardSize = size === 'large' ? 'md' : 'sm';
  const cardGap = size === 'large' ? 3 : 2;
  const cellRadius = size === 'large' ? '8px' : '6px';

  const cellBaseStyle: React.CSSProperties = {
    position: 'relative',
    width: `${cellWidth}px`,
    aspectRatio: '3 / 2',
    boxSizing: 'border-box',
    borderRadius: cellRadius,
    overflow: 'hidden',
  };

  const actionCount = actionOptions?.length ?? 0;
  const evTwoColumns = size === 'large' ? actionCount >= 3 : actionCount >= 4;

  const renderComboHeader = (combo: string, muted = false) => (
    <div style={{
      position: 'absolute',
      top: '4px',
      left: '6px',
      zIndex: 1,
      lineHeight: 1,
      opacity: muted ? 0.45 : 1,
      filter: muted ? 'grayscale(0.7)' : 'none',
    }}>
      <ComboCards combo={combo} size={cardSize} gap={cardGap} />
    </div>
  );

  const renderEvList = (detail: ComboPlayDetail) => {
    const textColor = '#1a252f';
    const subTextColor = '#636e72';
    if (!actionOptions?.length) return null;

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: evTwoColumns ? '1fr 1fr' : '1fr',
        alignContent: 'center',
        gap: size === 'large' ? '2px 6px' : '1px 6px',
        width: '100%',
        paddingTop: size === 'large' ? '24px' : '16px',
      }}>
        {actionOptions.map(action => {
          const ev = detail.evs[action.id] ?? 0;
          const isBest = action.id === detail.bestActionId;
          const badgeStyles = getActionBadgeStyles(action.color);
          return (
            <div
              key={action.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: evFontSize,
                fontWeight: isBest ? 700 : 500,
                lineHeight: 1,
                color: isBest ? textColor : subTextColor,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{
                ...badgeStyles,
                display: 'inline-block',
                padding: size === 'large' ? '1px 4px' : '1px 4px',
                borderRadius: '3px',
                fontSize: evFontSize,
                fontWeight: 'bold',
                lineHeight: 1,
                flexShrink: 0,
              }}>
                {action.shortLabel}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatEv(ev)}{isBest ? ' ★' : ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${grid[0]?.length ?? 1}, ${cellWidth}px)`,
        gap: `${cellGap}px`,
      }}
    >
      {grid.flat().map(cell => {
        const detail = getComboPlayDetail(
          cell.combo,
          hand,
          comboDetails,
          handRecommendation,
          actionOptions,
        );

        if (cell.blocked) {
          return (
            <div
              key={cell.combo}
              title="Combo bloqué par le board"
              style={{
                ...cellBaseStyle,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: cellPadding,
                backgroundColor: '#ffffff',
                border: '1px dashed #b2bec3',
                opacity: 0.85,
              }}
            >
              {renderComboHeader(cell.combo, true)}
              <span style={{
                fontSize: evFontSize,
                color: '#636e72',
                fontWeight: 600,
                marginTop: '14px',
              }}>
                bloqué
              </span>
            </div>
          );
        }

        const accentColor = detail?.style.color ?? '#95a5a6';

        return (
          <div
            key={cell.combo}
            style={{
              ...cellBaseStyle,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              padding: cellPadding,
              backgroundColor: '#ffffff',
              border: '1px solid #d5dbe1',
              borderLeft: `4px solid ${accentColor}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            {renderComboHeader(cell.combo)}
            {detail && renderEvList(detail)}
          </div>
        );
      })}
    </div>
  );
};

export const getComboTooltipDimensions = (hand: string, size: 'normal' | 'large' = 'normal') => {
  const layout = getHandGridLayout(hand);
  return { width: TOOLTIP_WIDTH[layout][size], layout };
};
