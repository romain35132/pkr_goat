import { getComboCount } from '../components/RangeSelector';
import { getHandGroup } from '../components/CategoryDetailModal';
import { CATEGORY_LABELS } from './categoryUtils';
import {
  StrategyNode,
  parseActionAmountBb,
  computePotAtStrategy,
  getAllHeroActionsInSubtree,
  getVillainNodeForHero,
  formatHeroAction,
  formatVillainAction,
  streetToDb,
  DbStreet,
} from './strategyUtils';

const SUITS = ['h', 'd', 'c', 's'] as const;

export type HeroActionType = 'Fold' | 'Check' | 'Call' | 'Bet/Raise';

export interface ActionOption {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  action: HeroActionType;
  pot: number;
  amount: number;
  foldEquity: number;
  opponentRangeStr: string;
}

export interface ActionDisplayStyle {
  color: string;
  shortLabel: string;
  label: string;
  actionId: string;
}

export interface HandEquityEntry {
  hand: string;
  equity: number;
  combos: number;
  weight: number;
}

export interface HandRecommendation {
  hand: string;
  combos: number;
  weight: number;
  equities: Record<string, number>;
  evs: Record<string, number>;
  bestActionId: string;
  bestEV: number;
  bestActionLabel: string;
}

export interface ComboPlayDetail {
  combo: string;
  group: string;
  categories: string[];
  style: ActionDisplayStyle;
  bestEV: number;
  bestActionId: string;
  evs: Record<string, number>;
}

export interface ActionDistributionSegment {
  color: string;
  shortLabel: string;
  percent: number;
  actionId: string;
}

export const buildActionDistribution = (
  details: ComboPlayDetail[],
): ActionDistributionSegment[] => {
  if (details.length === 0) return [];

  const counts = new Map<string, { count: number; style: ActionDisplayStyle }>();
  for (const d of details) {
    const id = d.style.actionId;
    const entry = counts.get(id) ?? { count: 0, style: d.style };
    entry.count += 1;
    counts.set(id, entry);
  }

  const total = details.length;
  return Array.from(counts.entries())
    .map(([, { count, style }]) => ({
      color: style.color,
      shortLabel: style.shortLabel,
      percent: (count / total) * 100,
      actionId: style.actionId,
    }))
    .sort((a, b) => b.percent - a.percent);
};

export interface ExpandedComboEntry {
  combo: string;
  group: string;
  weight: number;
}

/** Palette inspirée de PioSolver : bleu = fold, vert = check/call, rouge = bet/raise. */
export const PIO_COLORS = {
  fold: '#4A8FD4',
  check: '#7DCE7D',
  call: '#4CAF50',
} as const;

/** Nuances de rouge : clair (petite mise) → foncé (grosse mise). */
export const PIO_BET_PALETTE = [
  '#FFD6D6',
  '#FFB8B8',
  '#FF9999',
  '#FF7070',
  '#F24C4C',
  '#E03030',
  '#C62828',
  '#A31F1F',
  '#8B1818',
] as const;

const getPioBaseColor = (action: HeroActionType): string => {
  if (action === 'Fold') return PIO_COLORS.fold;
  if (action === 'Check') return PIO_COLORS.check;
  if (action === 'Call') return PIO_COLORS.call;
  return PIO_BET_PALETTE[4];
};

const colorForBetByRank = (rank: number, total: number): string => {
  if (total <= 1) return PIO_BET_PALETTE[4];
  const idx = Math.round((rank / (total - 1)) * (PIO_BET_PALETTE.length - 1));
  return PIO_BET_PALETTE[Math.max(0, Math.min(PIO_BET_PALETTE.length - 1, idx))];
};

export const isLightActionColor = (hex: string): boolean => {
  if (!hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
};

export const getActionBadgeStyles = (color: string) => ({
  backgroundColor: color,
  color: isLightActionColor(color) ? '#1a252f' : '#ffffff',
  border: isLightActionColor(color) ? '1px solid rgba(0,0,0,0.25)' : '1px solid rgba(0,0,0,0.12)',
});

export const rangeToString = (range: Record<string, number>) =>
  Object.entries(range)
    .filter(([, w]) => w > 0)
    .map(([hand, weight]) => (weight === 100 ? hand : `${hand}:${weight}`))
    .join(', ');

export const calculateEV = (eq: number, action: HeroActionType, pot: number, amount: number, fe: number) => {
  if (action === 'Fold') return 0;
  if (action === 'Check') return eq * pot;
  if (action === 'Call') return eq * pot - (1 - eq) * amount;
  const fePct = fe / 100;
  return fePct * pot + (1 - fePct) * (eq * (pot + amount) - (1 - eq) * amount);
};

export const mapHeroAction = (heroAction?: string | null): HeroActionType => {
  const a = heroAction?.toUpperCase();
  if (a === 'FOLD') return 'Fold';
  if (a === 'CHECK') return 'Check';
  if (a === 'CALL') return 'Call';
  if (a === 'BET' || a === 'RAISE') return 'Bet/Raise';
  return 'Call';
};

const normalizeSizeToken = (actionSize?: string | null): string => {
  if (!actionSize) return '';
  return actionSize.replace(/\s+/g, '').replace(/bb$/i, 'bb');
};

export const buildActionShortLabel = (
  action: HeroActionType,
  actionSize?: string | null,
  fallbackIndex = 0,
): string => {
  const size = normalizeSizeToken(actionSize);
  if (action === 'Fold') return 'F';
  if (action === 'Check') return 'X';
  if (action === 'Call') return size ? `C ${size}` : 'C';
  if (action === 'Bet/Raise') {
    if (size) return size.includes('%') ? `B ${size}` : `B ${size}`;
    return `B${fallbackIndex + 1}`;
  }
  return `?${fallbackIndex + 1}`;
};

export const buildStrategyActionLabel = (
  strategy: StrategyNode,
  allStrategies: StrategyNode[],
): string => {
  const villain = getVillainNodeForHero(allStrategies, strategy);
  const villainLabel = villain ? `${formatVillainAction(villain)} → ` : '';
  return `${villainLabel}${formatHeroAction(strategy)}`;
};

const assignDistinctColors = (actions: ActionOption[]): ActionOption[] => {
  const usedShortLabels = new Map<string, number>();

  const betActions = actions
    .filter(a => a.action === 'Bet/Raise')
    .sort((a, b) => a.amount - b.amount || a.label.localeCompare(b.label));

  const betColorById = new Map<string, string>();
  betActions.forEach((bet, rank) => {
    betColorById.set(bet.id, colorForBetByRank(rank, betActions.length));
  });

  return actions.map(action => {
    let shortLabel = action.shortLabel;
    const count = usedShortLabels.get(shortLabel) ?? 0;
    if (count > 0) {
      shortLabel = `${shortLabel}*${count + 1}`;
    }
    usedShortLabels.set(action.shortLabel, count + 1);

    let color = getPioBaseColor(action.action);
    if (action.action === 'Bet/Raise') {
      color = betColorById.get(action.id) ?? PIO_BET_PALETTE[4];
    }

    return { ...action, shortLabel, color };
  });
};

export const estimateFoldEquity = (
  strategyRange: Record<string, number>,
  baseRange: Record<string, number>,
  deadCards: string[],
): number => {
  let strategyCombos = 0;
  let baseTotal = 0;
  for (const [hand, weight] of Object.entries(strategyRange)) {
    if (weight > 0) strategyCombos += getComboCount(hand, deadCards) * (weight / 100);
  }
  for (const [hand, weight] of Object.entries(baseRange)) {
    if (weight > 0) baseTotal += getComboCount(hand, deadCards) * (weight / 100);
  }
  if (baseTotal <= 0) return 0;
  return Math.max(0, Math.min(100, ((baseTotal - strategyCombos) / baseTotal) * 100));
};

export const getEffectiveHeroRange = (
  heroRange: Record<string, number>,
  deadCards: string[],
): Record<string, number> => {
  const effective: Record<string, number> = {};
  for (const [hand, weight] of Object.entries(heroRange)) {
    if (weight > 0 && getComboCount(hand, deadCards) > 0) {
      effective[hand] = weight;
    }
  }
  return effective;
};

const cardIsDead = (card: string, deadCards: string[]) =>
  deadCards.some(d => d === card);

export const isComboBlocked = (combo: string, deadCards: string[]) => {
  if (combo.length !== 4) return true;
  return cardIsDead(combo.slice(0, 2), deadCards) || cardIsDead(combo.slice(2, 4), deadCards);
};

const comboIsAlive = (combo: string, deadCards: string[]) => !isComboBlocked(combo, deadCards);

export interface ComboGridCell {
  combo: string;
  blocked: boolean;
}

export type HandGridLayout = 'pair' | 'suited' | 'offsuit';

export const getHandGridLayout = (hand: string): HandGridLayout => {
  if (hand.length === 2) return 'pair';
  if (hand[2] === 's') return 'suited';
  return 'offsuit';
};

export const getComboPlayDetail = (
  combo: string,
  hand: string,
  comboDetails?: ComboPlayDetail[],
  handRecommendation?: HandRecommendation,
  actionOptions?: ActionOption[],
): ComboPlayDetail | null => {
  const fromDetails = comboDetails?.find(d => d.combo === combo);
  if (fromDetails) return fromDetails;

  if (!handRecommendation || !actionOptions) return null;
  const action = actionOptions.find(a => a.id === handRecommendation.bestActionId);
  if (!action) return null;

  return {
    combo,
    group: hand,
    categories: [],
    style: {
      color: action.color,
      shortLabel: action.shortLabel,
      label: action.label,
      actionId: action.id,
    },
    bestEV: handRecommendation.bestEV,
    bestActionId: handRecommendation.bestActionId,
    evs: handRecommendation.evs,
  };
};

export const formatComboEvTitle = (
  detail: ComboPlayDetail,
  actionOptions: ActionOption[],
): string =>
  actionOptions
    .map(action => {
      const ev = detail.evs[action.id];
      const marker = action.id === detail.bestActionId ? '★' : '';
      return `${marker}${action.shortLabel}: ${ev > 0 ? '+' : ''}${ev.toFixed(2)} bb`;
    })
    .join('\n');

export const buildHandComboGrid = (hand: string, deadCards: string[]): ComboGridCell[][] => {
  const toCell = (combo: string): ComboGridCell => ({
    combo,
    blocked: isComboBlocked(combo, deadCards),
  });

  if (hand.length === 2) {
    const rank = hand[0];
    const pairCombos: string[] = [];
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        pairCombos.push(`${rank}${SUITS[i]}${rank}${SUITS[j]}`);
      }
    }
    return [
      pairCombos.slice(0, 3).map(toCell),
      pairCombos.slice(3, 6).map(toCell),
    ];
  }

  const rank1 = hand[0];
  const rank2 = hand[1];

  if (hand[2] === 's') {
    return [
      [toCell(`${rank1}h${rank2}h`), toCell(`${rank1}d${rank2}d`)],
      [toCell(`${rank1}c${rank2}c`), toCell(`${rank1}s${rank2}s`)],
    ];
  }

  return SUITS.map(s1 =>
    SUITS.filter(s2 => s2 !== s1).map(s2 => toCell(`${rank1}${s1}${rank2}${s2}`)),
  );
};

export const expandHandNotationToCombos = (hand: string, deadCards: string[]): string[] => {
  if (hand.length === 4) {
    return comboIsAlive(hand, deadCards) ? [hand] : [];
  }

  if (hand.length === 2) {
    const rank = hand[0];
    const combos: string[] = [];
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        const combo = `${rank}${SUITS[i]}${rank}${SUITS[j]}`;
        if (comboIsAlive(combo, deadCards)) combos.push(combo);
      }
    }
    return combos;
  }

  const rank1 = hand[0];
  const rank2 = hand[1];
  const isSuited = hand[2] === 's';
  const combos: string[] = [];

  if (isSuited) {
    for (const s of SUITS) {
      const combo = `${rank1}${s}${rank2}${s}`;
      if (comboIsAlive(combo, deadCards)) combos.push(combo);
    }
  } else {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        const combo = `${rank1}${s1}${rank2}${s2}`;
        if (comboIsAlive(combo, deadCards)) combos.push(combo);
      }
    }
  }
  return combos;
};

export const expandHeroRangeToCombos = (
  heroRange: Record<string, number>,
  deadCards: string[],
): ExpandedComboEntry[] => {
  const entries: ExpandedComboEntry[] = [];
  for (const [hand, weight] of Object.entries(heroRange)) {
    if (weight <= 0) continue;
    for (const combo of expandHandNotationToCombos(hand, deadCards)) {
      entries.push({ combo, group: getHandGroup(combo), weight });
    }
  }
  return entries;
};

export const formatComboLabel = (combo: string): string => {
  if (combo.length !== 4) return combo;
  return `${combo.slice(0, 2)} ${combo.slice(2, 4)}`;
};

export async function fetchHeroComboCategories(
  comboRangeStr: string,
  board: string,
  deadCards: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!board.trim() || !comboRangeStr) return map;

  try {
    const res = await fetch('/api/v1/range/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opponent_range: comboRangeStr,
        board,
        dead_cards: deadCards.join(' '),
      }),
    });
    if (!res.ok) return map;
    const data: { categories: { category: string; hands: { hand: string }[] }[] } = await res.json();
    for (const cat of data.categories) {
      for (const h of cat.hands) {
        const list = map.get(h.hand) ?? [];
        if (!list.includes(cat.category)) list.push(cat.category);
        map.set(h.hand, list);
      }
    }
  } catch {
    // ignore
  }
  return map;
}

const aggregateRecommendationsByGroup = (
  comboRecs: HandRecommendation[],
  actions: ActionOption[],
  effectiveRange: Record<string, number>,
): HandRecommendation[] => {
  const byGroup = new Map<string, HandRecommendation[]>();
  for (const rec of comboRecs) {
    const group = rec.hand.length === 4 ? getHandGroup(rec.hand) : rec.hand;
    const list = byGroup.get(group) ?? [];
    list.push(rec);
    byGroup.set(group, list);
  }

  return Array.from(byGroup.entries()).map(([group, recs]) => {
    const weight = effectiveRange[group] ?? recs[0]?.weight ?? 100;
    const equities: Record<string, number> = {};
    const evs: Record<string, number> = {};

    for (const action of actions) {
      let eqSum = 0;
      let evSum = 0;
      for (const rec of recs) {
        eqSum += rec.equities[action.id] ?? 0;
        evSum += rec.evs[action.id] ?? 0;
      }
      equities[action.id] = eqSum / recs.length;
      evs[action.id] = evSum / recs.length;
    }

    let bestActionId = actions[0]?.id ?? '';
    let bestEV = -Infinity;
    let bestActionLabel = '';
    for (const action of actions) {
      const ev = evs[action.id];
      if (ev > bestEV) {
        bestEV = ev;
        bestActionId = action.id;
        bestActionLabel = action.label;
      }
    }

    return {
      hand: group,
      combos: recs.length,
      weight,
      equities,
      evs,
      bestActionId,
      bestEV,
      bestActionLabel,
    };
  }).sort((a, b) => b.bestEV - a.bestEV);
};

const buildComboDetailsByHand = (
  comboRecs: HandRecommendation[],
  actions: ActionOption[],
  comboCategories: Map<string, string[]>,
): Record<string, ComboPlayDetail[]> => {
  const byHand: Record<string, ComboPlayDetail[]> = {};

  for (const rec of comboRecs) {
    const group = getHandGroup(rec.hand);
    const action = actions.find(a => a.id === rec.bestActionId);
    if (!action) continue;

    const cats = (comboCategories.get(rec.hand) ?? [])
      .map(c => CATEGORY_LABELS[c] || c);

    const detail: ComboPlayDetail = {
      combo: rec.hand,
      group,
      categories: cats,
      style: {
        color: action.color,
        shortLabel: action.shortLabel,
        label: action.label,
        actionId: action.id,
      },
      bestEV: rec.bestEV,
      bestActionId: rec.bestActionId,
      evs: rec.evs,
    };

    if (!byHand[group]) byHand[group] = [];
    byHand[group].push(detail);
  }

  for (const group of Object.keys(byHand)) {
    byHand[group].sort((a, b) => b.bestEV - a.bestEV);
  }

  return byHand;
};

const resolveDominantHandStyle = (
  details: ComboPlayDetail[],
  actions: ActionOption[],
): ActionDisplayStyle & { isMixed: boolean } => {
  if (details.length === 0) {
    return { color: '#95a5a6', shortLabel: '?', label: '—', actionId: '', isMixed: false };
  }

  const counts = new Map<string, number>();
  for (const d of details) {
    counts.set(d.style.actionId, (counts.get(d.style.actionId) ?? 0) + 1);
  }

  let dominantId = details[0].style.actionId;
  let maxCount = 0;
  for (const [id, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominantId = id;
    }
  }

  const isMixed = counts.size > 1;
  const action = actions.find(a => a.id === dominantId) ?? actions[0];
  return {
    color: action?.color ?? details[0].style.color,
    shortLabel: isMixed ? `${action?.shortLabel ?? '?'}+` : (action?.shortLabel ?? details[0].style.shortLabel),
    label: isMixed
      ? `${details.length} combos — actions mixtes`
      : (action?.label ?? details[0].style.label),
    actionId: dominantId,
    isMixed,
  };
};

export const buildRecommendations = (
  baseHands: HandEquityEntry[],
  equitiesByAction: Record<string, Record<string, number>>,
  actions: ActionOption[],
): HandRecommendation[] => {
  return baseHands
    .map(entry => {
      const evs: Record<string, number> = {};
      const equities: Record<string, number> = {};

      for (const action of actions) {
        const eq = equitiesByAction[action.id]?.[entry.hand] ?? entry.equity;
        equities[action.id] = eq;
        evs[action.id] = calculateEV(
          eq,
          action.action,
          action.pot,
          action.amount,
          action.foldEquity,
        );
      }

      let bestActionId = actions[0]?.id ?? '';
      let bestEV = -Infinity;
      let bestActionLabel = '';

      for (const action of actions) {
        const ev = evs[action.id];
        if (ev > bestEV) {
          bestEV = ev;
          bestActionId = action.id;
          bestActionLabel = action.label;
        }
      }

      return {
        hand: entry.hand,
        combos: entry.combos,
        weight: entry.weight,
        equities,
        evs,
        bestActionId,
        bestEV,
        bestActionLabel,
      };
    })
    .sort((a, b) => b.bestEV - a.bestEV);
};

export async function computeHeroStrategyMatrix(
  heroRange: Record<string, number>,
  actions: ActionOption[],
  board: string,
  deadCards: string[],
  defaultOpponentRangeStr = '',
): Promise<{
  recommendations: HandRecommendation[];
  actionStyleMap: Record<string, ActionDisplayStyle>;
  comboDetailsByHand: Record<string, ComboPlayDetail[]>;
  aggregateEV: number;
}> {
  const effectiveRange = getEffectiveHeroRange(heroRange, deadCards);
  if (Object.keys(effectiveRange).length === 0 || actions.length === 0) {
    return { recommendations: [], actionStyleMap: {}, comboDetailsByHand: {}, aggregateEV: 0 };
  }

  const boardHasCards = board.trim().length > 0;
  const comboEntries = expandHeroRangeToCombos(effectiveRange, deadCards);
  const useComboLevel = boardHasCards && comboEntries.length > 0;

  const playerRangeStr = useComboLevel
    ? comboEntries.map(e => (e.weight === 100 ? e.combo : `${e.combo}:${e.weight}`)).join(', ')
    : rangeToString(effectiveRange);

  const iterations = useComboLevel
    ? Math.max(4000, Math.floor(12000 / Math.sqrt(comboEntries.length)))
    : 12000;

  const equitiesByAction: Record<string, Record<string, number>> = {};
  const matrixCache = new Map<string, HandEquityEntry[]>();
  let baseHands: HandEquityEntry[] = [];

  for (const action of actions) {
    equitiesByAction[action.id] = {};

    if (action.action === 'Fold') {
      continue;
    }

    const oppRange = action.opponentRangeStr || defaultOpponentRangeStr;
    if (!oppRange) continue;

    const cacheKey = `${playerRangeStr}|${oppRange}|${board}`;
    let hands = matrixCache.get(cacheKey);
    if (!hands) {
      const result = await fetchHandMatrix(playerRangeStr, oppRange, board, iterations);
      hands = result.hands;
      matrixCache.set(cacheKey, hands);
    }

    for (const h of hands) {
      equitiesByAction[action.id][h.hand] = h.equity;
    }
    if (baseHands.length === 0) {
      baseHands = hands;
    }
  }

  if (baseHands.length === 0) {
    baseHands = (useComboLevel ? comboEntries : Object.entries(effectiveRange)).map(entry => {
      if (useComboLevel) {
        const e = entry as ExpandedComboEntry;
        return { hand: e.combo, equity: 0, combos: 1, weight: e.weight };
      }
      const [hand, weight] = entry as [string, number];
      return { hand, equity: 0, combos: getComboCount(hand, deadCards), weight };
    });
  }

  const comboRecs = buildRecommendations(baseHands, equitiesByAction, actions);

  const comboCategories = useComboLevel
    ? await fetchHeroComboCategories(playerRangeStr, board, deadCards)
    : new Map<string, string[]>();

  const comboDetailsByHand = useComboLevel
    ? buildComboDetailsByHand(comboRecs, actions, comboCategories)
    : {};

  const recommendations = useComboLevel
    ? aggregateRecommendationsByGroup(comboRecs, actions, effectiveRange)
    : comboRecs;

  const actionStyleMap: Record<string, ActionDisplayStyle> = {};

  if (useComboLevel) {
    for (const [group, details] of Object.entries(comboDetailsByHand)) {
      const { isMixed, ...style } = resolveDominantHandStyle(details, actions);
      actionStyleMap[group] = style;
    }
  } else {
    for (const rec of recommendations) {
      const action = actions.find(a => a.id === rec.bestActionId);
      if (action) {
        actionStyleMap[rec.hand] = {
          color: action.color,
          shortLabel: action.shortLabel,
          label: action.label,
          actionId: action.id,
        };
      }
    }
  }

  return {
    recommendations,
    actionStyleMap,
    comboDetailsByHand,
    aggregateEV: computeWeightedAggregateEV(recommendations, deadCards),
  };
}

export const computeWeightedAggregateEV = (
  recommendations: HandRecommendation[],
  deadCards: string[],
): number => {
  let totalWeight = 0;
  let weightedEV = 0;
  for (const rec of recommendations) {
    const w = getComboCount(rec.hand, deadCards) * (rec.weight / 100);
    if (w > 0) {
      weightedEV += rec.bestEV * w;
      totalWeight += w;
    }
  }
  return totalWeight > 0 ? weightedEV / totalWeight : 0;
};

export interface BuildActionsParams {
  currentStreet: string;
  selectedPreflopId: string;
  /** Actions hero au point de décision courant (celles proposées dans l'arbre d'actions). */
  decisionPointHeroStrategies: StrategyNode[];
  heroStrategiesAtStreet: StrategyNode[];
  allStrategies: StrategyNode[];
  baseRange: Record<string, number>;
  opponentRange: Record<string, number>;
  deadCards: string[];
  getStrategyRange: (strategyData: unknown) => Record<string, number>;
  potSize: number;
  actionType: HeroActionType | 'Check/Fold';
  actionAmount: number;
  foldEquity: number;
}

const strategyToActionOption = (
  strategy: StrategyNode,
  allStrategies: StrategyNode[],
  baseRange: Record<string, number>,
  deadCards: string[],
  getStrategyRange: (strategyData: unknown) => Record<string, number>,
  potSize: number,
  betIndex: number,
  defaultOppRangeStr: string,
): ActionOption => {
  const strategyRangeObj = getStrategyRange(strategy.strategy_data);
  const strategyRangeStr = rangeToString(strategyRangeObj);
  const opponentRangeStr = strategyRangeStr || defaultOppRangeStr;
  const pot = computePotAtStrategy(strategy, allStrategies) ?? strategy.pot_size_bb ?? potSize ?? 0;
  const amount = parseActionAmountBb(strategy.action_size, pot) ?? 0;
  const fe = strategyRangeStr
    ? estimateFoldEquity(strategyRangeObj, baseRange, deadCards)
    : 0;
  const action = mapHeroAction(strategy.hero_action);

  return {
    id: String(strategy.id),
    label: buildStrategyActionLabel(strategy, allStrategies),
    shortLabel: buildActionShortLabel(action, strategy.action_size, betIndex),
    color: getPioBaseColor(action),
    action,
    pot,
    amount,
    foldEquity: fe,
    opponentRangeStr,
  };
};

const buildFoldAction = (
  pot: number,
  opponentRangeStr: string,
): ActionOption => ({
  id: 'fold',
  label: 'Fold',
  shortLabel: 'F',
  color: PIO_COLORS.fold,
  action: 'Fold',
  pot,
  amount: 0,
  foldEquity: 0,
  opponentRangeStr,
});

const buildStrategyActionOptions = (
  strategies: StrategyNode[],
  allStrategies: StrategyNode[],
  baseRange: Record<string, number>,
  deadCards: string[],
  getStrategyRange: (strategyData: unknown) => Record<string, number>,
  potSize: number,
  defaultOppRangeStr: string,
  pot: number,
): ActionOption[] => {
  let betIndex = 0;
  const strategyActions = strategies.map(strategy => {
    const action = mapHeroAction(strategy.hero_action);
    const opt = strategyToActionOption(
      strategy,
      allStrategies,
      baseRange,
      deadCards,
      getStrategyRange,
      potSize,
      betIndex,
      defaultOppRangeStr,
    );
    if (action === 'Bet/Raise') betIndex += 1;
    return opt;
  });

  return assignDistinctColors([buildFoldAction(pot, defaultOppRangeStr), ...strategyActions]);
};

export const buildActionOptions = (params: BuildActionsParams): ActionOption[] => {
  const {
    currentStreet,
    selectedPreflopId,
    decisionPointHeroStrategies,
    heroStrategiesAtStreet,
    allStrategies,
    baseRange,
    opponentRange,
    deadCards,
    getStrategyRange,
    potSize,
    actionType,
    actionAmount,
    foldEquity,
  } = params;

  const defaultOppRangeStr = rangeToString(opponentRange);
  const streetDb = streetToDb(currentStreet) as DbStreet;
  const pot = potSize || 0;

  if (currentStreet !== 'Preflop' && decisionPointHeroStrategies.length > 0) {
    return buildStrategyActionOptions(
      decisionPointHeroStrategies,
      allStrategies,
      baseRange,
      deadCards,
      getStrategyRange,
      potSize,
      defaultOppRangeStr,
      pot,
    );
  }

  if (selectedPreflopId && currentStreet === 'Preflop') {
    const rootId = parseInt(selectedPreflopId, 10);
    const strategyNodes = getAllHeroActionsInSubtree(allStrategies, rootId, streetDb);

    if (strategyNodes.length > 0) {
      return buildStrategyActionOptions(
        strategyNodes,
        allStrategies,
        baseRange,
        deadCards,
        getStrategyRange,
        potSize,
        defaultOppRangeStr,
        pot,
      );
    }
  }

  if (currentStreet !== 'Preflop' && heroStrategiesAtStreet.length > 0) {
    return buildStrategyActionOptions(
      heroStrategiesAtStreet,
      allStrategies,
      baseRange,
      deadCards,
      getStrategyRange,
      potSize,
      defaultOppRangeStr,
      pot,
    );
  }

  const preflopActions: ActionOption[] = [
    buildFoldAction(pot, defaultOppRangeStr),
    {
      id: 'call',
      label: `Call${actionAmount > 0 ? ` (${actionAmount})` : ''}`,
      shortLabel: buildActionShortLabel('Call', actionAmount > 0 ? `${actionAmount}bb` : undefined),
      color: PIO_COLORS.call,
      action: 'Call',
      pot,
      amount: actionAmount,
      foldEquity: 0,
      opponentRangeStr: defaultOppRangeStr,
    },
    {
      id: 'bet',
      label: `Bet/Raise${actionAmount > 0 ? ` (${actionAmount})` : ''}`,
      shortLabel: buildActionShortLabel('Bet/Raise', actionAmount > 0 ? `${actionAmount}bb` : undefined),
      color: PIO_BET_PALETTE[4],
      action: 'Bet/Raise',
      pot,
      amount: actionAmount,
      foldEquity,
      opponentRangeStr: defaultOppRangeStr,
    },
  ];

  if (currentStreet === 'Preflop') {
    return assignDistinctColors(preflopActions);
  }

  const mappedAction: HeroActionType =
    actionType === 'Check/Fold' ? 'Fold' : (actionType as HeroActionType);

  return assignDistinctColors([{
    id: 'manual',
    label: `${mappedAction}${actionAmount > 0 && mappedAction !== 'Fold' && mappedAction !== 'Check' ? ` (${actionAmount})` : ''}`,
    shortLabel: buildActionShortLabel(mappedAction, actionAmount > 0 ? `${actionAmount}bb` : undefined),
    color: getPioBaseColor(mappedAction),
    action: mappedAction,
    pot,
    amount: actionAmount,
    foldEquity,
    opponentRangeStr: defaultOppRangeStr,
  }]);
};

export async function fetchHandMatrix(
  playerRange: string,
  opponentRange: string,
  board: string,
  iterations = 15000,
): Promise<{ hands: HandEquityEntry[]; aggregateEquity: number }> {
  const response = await fetch('/api/v1/equity/hand-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_range: playerRange,
      opponent_range: opponentRange,
      board,
      iterations,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erreur hand-matrix');
  return {
    hands: data.hands,
    aggregateEquity: data.aggregate_equity,
  };
}
