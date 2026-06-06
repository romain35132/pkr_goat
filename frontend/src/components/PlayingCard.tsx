import React from 'react';

export const SUITS_MAP: Record<string, { color: string; icon: string }> = {
  s: { color: '#2c3e50', icon: '♠' },
  h: { color: '#e74c3c', icon: '♥' },
  d: { color: '#3498db', icon: '♦' },
  c: { color: '#27ae60', icon: '♣' },
};

interface PlayingCardProps {
  card: string;
  size?: 'sm' | 'md';
}

export const PlayingCard: React.FC<PlayingCardProps> = ({ card, size = 'md' }) => {
  if (card.length !== 2) return <span>{card}</span>;
  const value = card[0];
  const suit = card[1];
  const suitInfo = SUITS_MAP[suit] ?? { color: '#2c3e50', icon: suit };

  const fontSize = size === 'sm' ? '13px' : '15px';
  const iconSize = size === 'sm' ? '14px' : '16px';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '1px',
      color: suitInfo.color,
      fontWeight: 'bold',
      fontSize,
    }}>
      {value}
      <span style={{ fontSize: iconSize, lineHeight: 1 }}>{suitInfo.icon}</span>
    </span>
  );
};

interface ComboCardsProps {
  combo: string;
  size?: 'sm' | 'md';
  gap?: number;
}

export const ComboCards: React.FC<ComboCardsProps> = ({ combo, size = 'sm', gap = 4 }) => {
  if (combo.length !== 4) return <span>{combo}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <PlayingCard card={combo.slice(0, 2)} size={size} />
      <PlayingCard card={combo.slice(2, 4)} size={size} />
    </span>
  );
};
