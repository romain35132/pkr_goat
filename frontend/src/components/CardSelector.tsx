import React from 'react';

interface CardSelectorProps {
  selectedCards: string[];
  onChange: (cards: string[]) => void;
  maxCards?: number;
  disabledCards?: string[];
}

const SUITS = [
  { symbol: 's', color: '#2c3e50', icon: '♠' },
  { symbol: 'h', color: '#e74c3c', icon: '♥' },
  { symbol: 'd', color: '#3498db', icon: '♦' },
  { symbol: 'c', color: '#27ae60', icon: '♣' },
];

const VALUES = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export const CardSelector: React.FC<CardSelectorProps> = ({
  selectedCards,
  onChange,
  maxCards = 52,
  disabledCards = [],
}) => {
  const toggleCard = (card: string) => {
    if (disabledCards.includes(card)) return;

    if (selectedCards.includes(card)) {
      onChange(selectedCards.filter((c) => c !== card));
    } else {
      if (selectedCards.length < maxCards) {
        onChange([...selectedCards, card]);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {SUITS.map((suit) => (
        <div key={suit.symbol} style={{ display: 'flex', gap: '3px' }}>
          {VALUES.map((value) => {
            const card = `${value}${suit.symbol}`;
            const isSelected = selectedCards.includes(card);
            const isDisabled = disabledCards.includes(card);

            return (
              <button
                key={card}
                type="button"
                onClick={() => toggleCard(card)}
                disabled={isDisabled}
                style={{
                  width: '32px',
                  height: '28px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? '#f1c40f' : isDisabled ? '#ecf0f1' : 'white',
                  color: suit.color,
                  border: `1px solid ${isSelected ? '#f39c12' : '#bdc3c7'}`,
                  borderRadius: '4px',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  opacity: isDisabled ? 0.5 : 1,
                  padding: 0,
                  gap: '2px'
                }}
              >
                <span>{value}</span>
                <span style={{ fontSize: '14px' }}>{suit.icon}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
