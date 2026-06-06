import React from 'react';
import { RangeSelector } from './RangeSelector';
import {
  HandRecommendation,
  ActionDisplayStyle,
  ActionOption,
  ComboPlayDetail,
} from '../utils/heroStrategyUtils';

interface HeroStrategyExpandedModalProps {
  recommendations: HandRecommendation[];
  actions: ActionOption[];
  actionStyleMap: Record<string, ActionDisplayStyle>;
  comboDetailsByHand: Record<string, ComboPlayDetail[]>;
  deadCards: string[];
  currentStreet: string;
  onClose: () => void;
}

export const HeroStrategyExpandedModal: React.FC<HeroStrategyExpandedModalProps> = ({
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '98vw',
            height: '98vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            marginBottom: '12px',
            gap: '12px',
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

          <RangeSelector
            selectedHands={Object.fromEntries(recommendations.map(r => [r.hand, r.weight]))}
            onChange={() => {}}
            readOnly
            deadCards={deadCards}
            actionStyles={actionStyleMap}
            comboDetailsByHand={comboDetailsByHand}
            recommendations={recommendations}
            actionOptions={actions}
            size="large"
          />
        </div>
      </div>
  );
};
