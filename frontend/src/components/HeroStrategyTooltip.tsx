import React from 'react';
import { HeroComboGridTooltip, getComboTooltipDimensions } from './HeroComboGridTooltip';
import {
  ActionOption,
  ComboPlayDetail,
  HandRecommendation,
} from '../utils/heroStrategyUtils';

export interface HeroStrategyTooltipState {
  hand: string;
  x: number;
  y: number;
}

interface HeroStrategyTooltipProps {
  tooltip: HeroStrategyTooltipState;
  deadCards: string[];
  comboDetails?: ComboPlayDetail[];
  handRecommendation?: HandRecommendation;
  actionOptions?: ActionOption[];
  size?: 'normal' | 'large';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const HeroStrategyTooltip: React.FC<HeroStrategyTooltipProps> = ({
  tooltip,
  deadCards,
  comboDetails,
  handRecommendation,
  actionOptions,
  size = 'normal',
  onMouseEnter,
  onMouseLeave,
}) => {
  const { width } = getComboTooltipDimensions(tooltip.hand, size);
  const maxTooltipHeight = size === 'large' ? 500 : 240;
  const left = Math.min(tooltip.x + 12, window.innerWidth - width - 16);
  const top = Math.min(tooltip.y + 12, window.innerHeight - maxTooltipHeight);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 2000,
        backgroundColor: '#ffffff',
        color: '#2c3e50',
        padding: size === 'large' ? '22px 24px' : '12px 14px',
        borderRadius: size === 'large' ? '12px' : '10px',
        fontSize: size === 'large' ? '15px' : '12px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
        border: '1px solid #cfd8dc',
        pointerEvents: 'auto',
        lineHeight: 1.4,
        maxWidth: `min(${width + 36}px, calc(100vw - 24px))`,
      }}
    >
      <HeroComboGridTooltip
        hand={tooltip.hand}
        deadCards={deadCards}
        comboDetails={comboDetails}
        handRecommendation={handRecommendation}
        actionOptions={actionOptions}
        size={size}
      />
    </div>
  );
};
