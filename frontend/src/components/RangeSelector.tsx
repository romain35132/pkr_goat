import React, { useState, useEffect, useMemo } from 'react';
import {
  ActionDisplayStyle,
  ActionOption,
  ComboPlayDetail,
  HandRecommendation,
  buildActionDistribution,
  ActionDistributionSegment,
} from '../utils/heroStrategyUtils';
import { HeroStrategyTooltip, HeroStrategyTooltipState } from './HeroStrategyTooltip';
interface RangeSelectorProps {
  selectedHands: Record<string, number>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  allowedHands?: string[];
  readOnly?: boolean;
  deadCards?: string[];
  effectiveHands?: Record<string, number>;
  actionStyles?: Record<string, ActionDisplayStyle>;
  comboDetailsByHand?: Record<string, ComboPlayDetail[]>;
  recommendations?: HandRecommendation[];
  actionOptions?: ActionOption[];
  size?: 'normal' | 'large';
}

const VALUES = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// Standard ranking of 169 hands
const HAND_RANKING = [
  "AA", "KK", "QQ", "JJ", "AKs", "AQs", "TT", "AKo", "AJs", "KQs", "99", "ATs", "AQo", "KJs", "88", 
  "QJs", "KTs", "AJo", "77", "QTs", "A9s", "KTo", "JTs", "A8s", "KQo", "66", "ATo", "A7s", "K9s", 
  "Q9s", "J9s", "55", "A6s", "K8s", "QJo", "A5s", "A9o", "44", "K7s", "J8s", "Q8s", "A4s", "T9s", 
  "KJo", "A8o", "33", "A3s", "K6s", "QTo", "98s", "JTo", "22", "A2s", "K5s", "T8s", "K9o", "A7o", 
  "Q7s", "J7s", "K4s", "Q9o", "87s", "T9o", "J9o", "A6o", "K3s", "97s", "Q6s", "K8o", "T7s", "K2s", 
  "A5o", "J8o", "86s", "98o", "A4o", "Q5s", "K7o", "76s", "T8o", "Q8o", "A3o", "J6s", "96s", "Q4s", 
  "K6o", "T6s", "A2o", "85s", "75s", "Q7o", "J7o", "K5o", "97o", "Q3s", "87o", "65s", "T7o", "J5s", 
  "K4o", "Q6o", "95s", "84s", "74s", "Q2s", "K3o", "T5s", "J4s", "86o", "64s", "76o", "K2o", "96o", 
  "54s", "J6o", "T6o", "83s", "Q5o", "73s", "94s", "63s", "J3s", "T4s", "85o", "53s", "Q4o", "75o", 
  "95o", "J2s", "T3s", "65o", "82s", "62s", "43s", "Q3o", "T2s", "93s", "74o", "J5o", "84o", "52s", 
  "72s", "Q2o", "92s", "54o", "64o", "J4o", "T5o", "83o", "42s", "73o", "94o", "32s", "J3o", "63o", 
  "T4o", "53o", "82o", "J2o", "93o", "T3o", "72o", "62o", "T2o", "92o", "43o", "52o", "42o", "32o"
];

export const getComboCount = (hand: string, deadCards: string[] = []) => {
  const deadByRank: Record<string, string[]> = {};
  deadCards.forEach(card => {
    if (card.length === 2) {
      const r = card[0];
      const s = card[1];
      if (!deadByRank[r]) deadByRank[r] = [];
      if (!deadByRank[r].includes(s)) deadByRank[r].push(s);
    }
  });

  const getDeadSuits = (rank: string) => deadByRank[rank] || [];

  if (hand.length === 4) {
    // Specific combo like AhKh
    const r1 = hand[0];
    const s1 = hand[1];
    const r2 = hand[2];
    const s2 = hand[3];
    const isDead = getDeadSuits(r1).includes(s1) || getDeadSuits(r2).includes(s2) || (r1 === r2 && s1 === s2);
    return isDead ? 0 : 1;
  }

  if (hand.length === 2) {
    // Pair
    const rank = hand[0];
    const deadCount = getDeadSuits(rank).length;
    const avail = 4 - deadCount;
    return avail >= 2 ? (avail * (avail - 1)) / 2 : 0;
  }

  const rank1 = hand[0];
  const rank2 = hand[1];
  const isSuited = hand[2] === 's';

  const deadSuits1 = getDeadSuits(rank1);
  const deadSuits2 = getDeadSuits(rank2);

  const suits = ['h', 'd', 'c', 's'];
  let availSuited = 0;
  for (const s of suits) {
    if (!deadSuits1.includes(s) && !deadSuits2.includes(s)) {
      availSuited++;
    }
  }

  if (isSuited) {
    return availSuited;
  } else {
    // Offsuit
    const avail1 = 4 - deadSuits1.length;
    const avail2 = 4 - deadSuits2.length;
    return (avail1 * avail2) - availSuited;
  }
};

export const RangeSelector: React.FC<RangeSelectorProps> = ({
  selectedHands,
  onChange,
  allowedHands,
  readOnly = false,
  deadCards = [],
  effectiveHands,
  actionStyles: handActionStyles,
  comboDetailsByHand,
  recommendations,
  actionOptions,
  size = 'normal',
}) => {
  const [currentWeight, setCurrentWeight] = useState<number>(100);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [hoverTooltip, setHoverTooltip] = useState<HeroStrategyTooltipState | null>(null);
  const [tooltipPinned, setTooltipPinned] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const updateHand = (hand: string, mode: 'select' | 'deselect') => {
    onChange((prev) => {
      const newHands = { ...prev };
      if (mode === 'select') {
        newHands[hand] = currentWeight;
      } else {
        delete newHands[hand];
      }
      return newHands;
    });
  };

  const handleMouseDown = (hand: string) => {
    setIsDragging(true);
    const isCurrentlySelected = selectedHands[hand] !== undefined;
    const newDragMode = (isCurrentlySelected && selectedHands[hand] === currentWeight) ? 'deselect' : 'select';
    setDragMode(newDragMode);
    updateHand(hand, newDragMode);
  };

  const handleMouseEnter = (hand: string) => {
    if (isDragging) {
      updateHand(hand, dragMode);
    }
  };

  const clearRange = () => onChange({});
  const selectAll = () => {
    const allHands: Record<string, number> = {};
    for (let i = 0; i < VALUES.length; i++) {
      for (let j = 0; j < VALUES.length; j++) {
        let hand = '';
        if (i === j) {
          hand = `${VALUES[i]}${VALUES[j]}`;
        } else if (i < j) {
          hand = `${VALUES[i]}${VALUES[j]}s`;
        } else {
          hand = `${VALUES[j]}${VALUES[i]}o`;
        }
        if (!allowedHands || allowedHands.includes(hand)) {
          allHands[hand] = currentWeight;
        }
      }
    }
    onChange(allHands);
  };

  const handleTopPercentChange = (percent: number) => {
    const targetCombos = (percent / 100) * 1326;
    let currentCombos = 0;
    const newHands: Record<string, number> = {};
    
    for (const hand of HAND_RANKING) {
      if (!allowedHands || allowedHands.includes(hand)) {
        const combos = getComboCount(hand, deadCards);
        if (currentCombos + combos <= targetCombos) {
          newHands[hand] = currentWeight;
          currentCombos += combos;
        } else if (currentCombos < targetCombos) {
          // Partially include the last hand if needed, though usually we just include it if it's close
          // For simplicity, include it if it gets us closer
          newHands[hand] = currentWeight;
          currentCombos += combos;
        }
        
        if (currentCombos >= targetCombos) break;
      }
    }
    
    onChange(newHands);
  };

  // Calculate current total combos % for slider display
  const currentTotalCombos = useMemo(() => {
    let total = 0;
    for (const [hand, weight] of Object.entries(selectedHands)) {
      if (weight > 0) {
        total += getComboCount(hand, deadCards) * (weight / 100);
      }
    }
    return total;
  }, [selectedHands, deadCards]);
  const currentPercent = Math.round((currentTotalCombos / 1326) * 100);

  const hoveredRec = hoverTooltip
    ? recommendations?.find(r => r.hand === hoverTooltip.hand)
    : undefined;

  const showStrategyTooltip = readOnly && !!hoverTooltip && !!hoveredRec;

  const updateHoverTooltip = (hand: string, x: number, y: number) => {
    const hasComboDetails = !!comboDetailsByHand?.[hand]?.length;
    const hasRec = !!recommendations?.some(r => r.hand === hand);
    if (hasComboDetails || hasRec) {
      setHoverTooltip({ hand, x, y });
    }
  };

  const clearHoverTooltip = () => {
    if (!tooltipPinned) setHoverTooltip(null);
  };

  const isHeroStrategyGrid = readOnly && size === 'large';
  const gridMaxWidth = size === 'large' ? 'min(1400px, calc(98vw - 48px))' : '700px';
  const cellFontSize = size === 'large' ? '18px' : '14px';
  const comboCountFontSize = size === 'large' ? '12px' : '10px';
  const handLabelFontSize = size === 'large' ? '11px' : '9px';

  const distributionByHand = useMemo(() => {
    if (!comboDetailsByHand) return {};
    const result: Record<string, ActionDistributionSegment[]> = {};
    for (const [hand, details] of Object.entries(comboDetailsByHand)) {
      if (details.length > 0) {
        result[hand] = buildActionDistribution(details);
      }
    }
    return result;
  }, [comboDetailsByHand]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'center', position: 'relative' }}>
      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', width: '100%', maxWidth: gridMaxWidth }}>
          <label htmlFor="weight-slider" style={{ fontSize: '16px', fontWeight: 'bold', color: `hsl(${(currentWeight * 120) / 100}, 100%, 40%)` }}>
            Pondération: {currentWeight}%
          </label>
          <input
            id="weight-slider"
            type="range"
            min="0"
            max="100"
            step="5"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(parseInt(e.target.value, 10))}
            style={{ flex: 1 }}
          />
        </div>
      )}
      <div 
        style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: size === 'large' ? '4px' : '2px', width: '100%', maxWidth: gridMaxWidth }}
        onMouseLeave={() => {
          setIsDragging(false);
          if (!tooltipPinned) setHoverTooltip(null);
        }}
      >
        {VALUES.map((rowVal, i) =>
          VALUES.map((colVal, j) => {
            let hand = '';
            let bgColor = '';
            if (i === j) {
              hand = `${rowVal}${colVal}`;
              bgColor = '#81ecec'; // Pairs
            } else if (i < j) {
              hand = `${rowVal}${colVal}s`;
              bgColor = '#a29bfe'; // Suited
            } else {
              hand = `${colVal}${rowVal}o`;
              bgColor = '#fab1a0'; // Offsuit
            }

            const weight = selectedHands[hand];
            const isSelected = weight !== undefined && weight > 0;
            const isAllowed = allowedHands ? allowedHands.includes(hand) : true;
            
            const effectiveWeight = effectiveHands ? effectiveHands[hand] : undefined;
            const isEffective = effectiveWeight !== undefined && effectiveWeight > 0;

            let cellBgColor = isSelected ? '#2d3436' : bgColor;
            let cellColor = isSelected ? 'white' : '#2d3436';
            let cellOpacity = isAllowed ? 1 : 0.2;

            if (!isSelected && isEffective) {
              cellBgColor = '#95a5a6'; // gray
              cellColor = 'white';
            }

            const handStyle = handActionStyles?.[hand];
            const distribution = distributionByHand[hand];
            const hasDistribution = readOnly && isSelected && distribution && distribution.length > 0;
            const isMixedDistribution = hasDistribution && distribution.length > 1;

            if (hasDistribution) {
              cellBgColor = '#2d3436';
              cellColor = 'white';
              cellOpacity = 1;
            } else if (readOnly && handStyle && isSelected) {
              cellBgColor = handStyle.color;
              cellColor = 'white';
              cellOpacity = 1;
            } else if (readOnly) {
              cellBgColor = isSelected ? bgColor : '#f8f9fa';
              cellColor = isSelected ? '#2d3436' : '#bdc3c7';
              cellOpacity = isSelected ? 1 : 0.3;
              if (!isAllowed) {
                cellOpacity = 0.1;
                cellBgColor = '#ffffff';
              }
            }

            const hasStrategyData = isSelected && (
              comboDetailsByHand?.[hand]?.length || recommendations?.some(r => r.hand === hand)
            );

            return (
              <div
                key={hand}
                onMouseDown={(e) => { 
                  if (!isAllowed || readOnly) return;
                  e.preventDefault(); 
                  handleMouseDown(hand); 
                }}
                onMouseEnter={(e) => {
                  if (!isAllowed) return;
                  if (!readOnly) handleMouseEnter(hand);
                  if (readOnly && hasStrategyData) {
                    setTooltipPinned(false);
                    updateHoverTooltip(hand, e.clientX, e.clientY);
                  }
                }}
                onMouseLeave={() => {
                  if (readOnly && hasStrategyData) clearHoverTooltip();
                }}
                onMouseMove={(e) => {
                  if (readOnly && hasStrategyData) updateHoverTooltip(hand, e.clientX, e.clientY);
                }}
                style={{
                  aspectRatio: isHeroStrategyGrid ? '2 / 1' : '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hasDistribution ? '#ecf0f1' : cellBgColor,
                  color: cellColor,
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '2px',
                  cursor: isAllowed ? (readOnly ? 'default' : 'pointer') : 'not-allowed',
                  fontSize: cellFontSize,
                  fontWeight: 'bold',
                  padding: 0,
                  position: 'relative',
                  userSelect: 'none',
                  opacity: cellOpacity,
                  overflow: 'hidden',
                }}
                title={
                  readOnly && hasStrategyData
                    ? undefined
                    : `${hand}${isSelected ? ` (${weight}%)` : ''}${handStyle ? ` → ${handStyle.label}` : ''}`
                }
              >
                {isHeroStrategyGrid && (
                  <div style={{
                    position: 'absolute',
                    top: '3px',
                    left: '4px',
                    fontSize: handLabelFontSize,
                    fontWeight: 'bold',
                    lineHeight: 1,
                    color: isSelected
                      ? (hasDistribution ? 'white' : cellColor)
                      : '#95a5a6',
                    textShadow: isSelected && (hasDistribution || cellColor === 'white')
                      ? '0 0 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)'
                      : 'none',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}>
                    {hand}
                  </div>
                )}
                {hasDistribution && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'row',
                  }}>
                    {distribution.map(seg => (
                      <div
                        key={seg.actionId}
                        style={{
                          width: `${seg.percent}%`,
                          backgroundColor: seg.color,
                          minWidth: seg.percent > 0 ? '1px' : 0,
                        }}
                        title={`${seg.shortLabel}: ${Math.round(seg.percent)}%`}
                      />
                    ))}
                  </div>
                )}
                {readOnly && hasDistribution ? (
                  <span style={{
                    position: 'relative',
                    zIndex: 1,
                    fontSize: isMixedDistribution ? '8px' : (distribution[0].shortLabel.length > 4 ? '8px' : '10px'),
                    lineHeight: 1.1,
                    textAlign: 'center',
                    padding: '0 1px',
                    color: 'white',
                    textShadow: '0 0 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)',
                    fontWeight: 'bold',
                  }}>
                    {isMixedDistribution
                      ? distribution.map(s => `${Math.round(s.percent)}`).join('/')
                      : distribution[0].shortLabel}
                  </span>
                ) : readOnly && handStyle ? (
                  <span style={{ fontSize: handStyle.shortLabel.length > 4 ? '9px' : '11px', lineHeight: 1.1, textAlign: 'center', padding: '0 1px' }}>
                    {handStyle.shortLabel}
                  </span>
                ) : (
                  hand
                )}
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  fontSize: comboCountFontSize,
                  opacity: 0.7,
                  fontWeight: 'normal'
                }}>
                  {getComboCount(hand, deadCards)}
                </div>
                {isSelected && weight < 100 && (
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    fontSize: '11px',
                    color: `hsl(${(weight * 120) / 100}, 100%, 60%)`,
                    textShadow: '0px 0px 2px rgba(0,0,0,0.8)'
                  }}>
                    {weight}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {!readOnly && (
        <>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', width: '100%', maxWidth: gridMaxWidth, alignItems: 'center' }}>
            <button type="button" onClick={selectAll} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #bdc3c7', backgroundColor: '#ecf0f1' }}>Tout sélectionner</button>
            <button type="button" onClick={clearRange} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #e74c3c', backgroundColor: '#fadbd8', color: '#c0392b' }}>Effacer</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', width: '100%', maxWidth: gridMaxWidth, padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
            <label htmlFor="top-percent-slider" style={{ fontSize: '14px', fontWeight: 'bold', minWidth: '120px' }}>
              Top {currentPercent}% des mains
            </label>
            <input
              id="top-percent-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={currentPercent}
              onChange={(e) => handleTopPercentChange(parseInt(e.target.value, 10))}
              style={{ flex: 1 }}
            />
          </div>
        </>
      )}

      {showStrategyTooltip && hoverTooltip && hoveredRec && (
        <HeroStrategyTooltip
          tooltip={hoverTooltip}
          deadCards={deadCards}
          comboDetails={comboDetailsByHand?.[hoverTooltip.hand]}
          handRecommendation={hoveredRec}
          actionOptions={actionOptions}
          size={size}
          onMouseEnter={() => setTooltipPinned(true)}
          onMouseLeave={() => {
            setTooltipPinned(false);
            setHoverTooltip(null);
          }}
        />
      )}
    </div>
  );
};
