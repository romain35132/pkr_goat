import React from 'react';
import { HeroStrategyTable } from './HeroStrategyTable';
import {
  HandRecommendation,
  ActionDisplayStyle,
  ActionOption,
  ComboPlayDetail,
} from '../utils/heroStrategyUtils';

interface HeroStrategyTableExpandedModalProps {
  recommendations: HandRecommendation[];
  actions: ActionOption[];
  actionStyleMap: Record<string, ActionDisplayStyle>;
  comboDetailsByHand: Record<string, ComboPlayDetail[]>;
  deadCards: string[];
  currentStreet: string;
  onClose: () => void;
}

export const HeroStrategyTableExpandedModal: React.FC<HeroStrategyTableExpandedModalProps> = ({
  recommendations,
  actions,
  actionStyleMap,
  comboDetailsByHand,
  deadCards,
  currentStreet,
  onClose,
}) => {
  return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
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
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            width: '98vw',
            height: '98vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            gap: '12px',
            flexShrink: 0,
          }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '18px' }}>
              Stratégie Hero — {currentStreet}
            </h3>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 12px',
                border: '1px solid #bdc3c7',
                borderRadius: '6px',
                backgroundColor: '#f8f9fa',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Fermer
            </button>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#7f8c8d', flexShrink: 0 }}>
            Survolez une ligne pour voir le détail combo par combo.
          </p>

          <HeroStrategyTable
            recommendations={recommendations}
            actions={actions}
            actionStyleMap={actionStyleMap}
            deadCards={deadCards}
            comboDetailsByHand={comboDetailsByHand}
            size="large"
            maxHeight="calc(98vh - 110px)"
          />
        </div>
      </div>
  );
};
