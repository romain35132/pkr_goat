export const STREET_ORDER = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'] as const;

export type DbStreet = (typeof STREET_ORDER)[number];

export interface StrategyNode {
  id: number;
  title?: string;
  parent_strategy_id: number | null;
  street: string;
  pot_size_bb?: number;
  hero_action?: string;
  action_size?: string;
  action_vilain?: string;
  strategy_data?: unknown;
}

export const streetToDb = (street: string): DbStreet => {
  const map: Record<string, DbStreet> = {
    Preflop: 'PREFLOP',
    Flop: 'FLOP',
    Turn: 'TURN',
    River: 'RIVER',
  };
  return map[street] || 'PREFLOP';
};

export const parsePotSizeBb = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? null : parsed;
};

export const parseActionAmountBb = (actionSize: string | undefined, potSizeBb: number): number | null => {
  if (!actionSize) return null;
  const parsed = parseFloat(actionSize);
  if (isNaN(parsed)) return null;
  if (actionSize.includes('%')) {
    return (parsed / 100) * potSizeBb;
  }
  return parsed;
};

export const applyHeroActionToPot = (
  pot: number,
  heroAction?: string | null,
  actionSize?: string
): number => {
  const action = heroAction?.toUpperCase();
  if (!action || action === 'CHECK') return pot;

  const amount = parseActionAmountBb(actionSize, pot);
  if (amount === null) return pot;

  if (action === 'BET') {
    return pot + 2 * amount;
  }
  if (action === 'CALL') {
    return pot + amount;
  }
  return pot;
};

export const computePotAfterStrategyChain = (
  strategy: StrategyNode,
  allStrategies: StrategyNode[]
): number | undefined => {
  const byId = new Map(allStrategies.map(s => [s.id, s]));
  const chain: StrategyNode[] = [];
  let current: StrategyNode | undefined = strategy;

  while (current) {
    chain.unshift(current);
    if (!current.parent_strategy_id) break;
    current = byId.get(current.parent_strategy_id);
  }

  const startIndex = chain.findIndex(s => parsePotSizeBb(s.pot_size_bb) !== null);
  if (startIndex === -1) return undefined;

  let pot = parsePotSizeBb(chain[startIndex].pot_size_bb)!;

  for (let i = startIndex; i < chain.length; i++) {
    pot = applyHeroActionToPot(pot, chain[i].hero_action, chain[i].action_size);
  }

  return pot;
};

export const derivePotFromParent = (
  parentId: number | null | undefined,
  allStrategies: StrategyNode[]
): number | undefined => {
  if (!parentId) return undefined;
  const parent = allStrategies.find(s => s.id === parentId);
  if (!parent) return undefined;
  const derivedPot = computePotAfterStrategyChain(parent, allStrategies);
  return derivedPot !== undefined ? Number(derivedPot.toFixed(2)) : undefined;
};

/** Pot au moment de la décision (après la chaîne parente, avant l'action du nœud). */
export const computePotAtStrategy = (
  strategy: StrategyNode,
  allStrategies: StrategyNode[]
): number | undefined => {
  if (!strategy.parent_strategy_id) {
    const pot = parsePotSizeBb(strategy.pot_size_bb);
    return pot !== null ? pot : undefined;
  }
  return derivePotFromParent(strategy.parent_strategy_id, allStrategies);
};

export const buildAncestorChainSignature = (
  parentId: number | null | undefined,
  allStrategies: StrategyNode[]
): string => {
  if (!parentId) return '';
  const byId = new Map(allStrategies.map(s => [s.id, s]));
  const parts: string[] = [];
  let current = byId.get(parentId);
  while (current) {
    parts.push(
      `${current.id}:${current.pot_size_bb ?? ''}:${current.hero_action ?? ''}:${current.action_size ?? ''}`
    );
    if (!current.parent_strategy_id) break;
    current = byId.get(current.parent_strategy_id);
  }
  return parts.join('|');
};

export const getChildrenForStreet = (
  allStrategies: StrategyNode[],
  parentId: number,
  street: DbStreet
): StrategyNode[] =>
  allStrategies
    .filter(s => s.parent_strategy_id === parentId && s.street === street)
    .sort((a, b) => a.id - b.id);

export const getVillainActionNodes = (
  allStrategies: StrategyNode[],
  parentId: number,
  street: DbStreet
): StrategyNode[] => getChildrenForStreet(allStrategies, parentId, street);

export const getHeroActionNodes = (
  allStrategies: StrategyNode[],
  villainNodeId: number,
  street: DbStreet
): StrategyNode[] => {
  const children = getChildrenForStreet(allStrategies, villainNodeId, street);
  if (children.length > 0) return children;

  const villainNode = allStrategies.find(s => s.id === villainNodeId);
  if (villainNode?.hero_action) return [villainNode];

  return [];
};

export const getAllHeroNodesForStreet = (
  allStrategies: StrategyNode[],
  parentId: number,
  street: DbStreet
): StrategyNode[] => {
  const villains = getVillainActionNodes(allStrategies, parentId, street);
  const heroes: StrategyNode[] = [];
  for (const villain of villains) {
    heroes.push(...getHeroActionNodes(allStrategies, villain.id, street));
  }
  return heroes;
};

export const getVillainNodeForHero = (
  allStrategies: StrategyNode[],
  heroNode: StrategyNode
): StrategyNode | undefined => {
  if (!heroNode.parent_strategy_id) {
    return heroNode.action_vilain ? heroNode : undefined;
  }
  const parent = allStrategies.find(s => s.id === heroNode.parent_strategy_id);
  if (!parent) return heroNode.action_vilain ? heroNode : undefined;
  if (parent.action_vilain && parent.id !== heroNode.id) return parent;
  return heroNode.action_vilain ? heroNode : undefined;
};

const hasStreetActionsUnderParent = (
  allStrategies: StrategyNode[],
  parentId: number,
  street: DbStreet
): boolean =>
  getVillainActionNodes(allStrategies, parentId, street).length > 0
  || getHeroActionNodes(allStrategies, parentId, street).length > 0;

export const getParentForVillainActions = (
  allStrategies: StrategyNode[],
  strategyPath: number[],
  selectedPreflopId: string,
  currentStreetDb: DbStreet
): number | null => {
  if (currentStreetDb === 'PREFLOP') return null;

  const streetIdx = STREET_ORDER.indexOf(currentStreetDb);
  const parentStreet = STREET_ORDER[streetIdx - 1];
  const candidateIds: number[] = [];

  const addCandidate = (id: number | null | undefined) => {
    if (id != null && !candidateIds.includes(id)) {
      candidateIds.push(id);
    }
  };

  for (let i = strategyPath.length - 1; i >= 0; i--) {
    const s = allStrategies.find(st => st.id === strategyPath[i]);
    if (s?.street === parentStreet) {
      addCandidate(s.id);
      addCandidate(s.parent_strategy_id);
      break;
    }
  }

  for (const id of strategyPath) {
    const s = allStrategies.find(st => st.id === id);
    if (s?.street === parentStreet) {
      addCandidate(s.id);
      addCandidate(s.parent_strategy_id);
    }
  }

  if (currentStreetDb === 'FLOP' && selectedPreflopId) {
    addCandidate(parseInt(selectedPreflopId, 10));
  }

  for (const candidateId of candidateIds) {
    if (hasStreetActionsUnderParent(allStrategies, candidateId, currentStreetDb)) {
      return candidateId;
    }
  }

  return candidateIds[0] ?? null;
};

export const getSelectedStrategyForStreet = (
  allStrategies: StrategyNode[],
  strategyPath: number[],
  street: DbStreet
): StrategyNode | undefined =>
  [...strategyPath]
    .reverse()
    .map(id => allStrategies.find(s => s.id === id))
    .find(s => s?.street === street);

export const formatHeroAction = (strategy: StrategyNode): string => {
  const action = strategy.hero_action?.toUpperCase();
  if (!action) return '—';
  if (action === 'CHECK') return 'Check';
  if (action === 'CALL') return `Call${strategy.action_size ? ` (${strategy.action_size})` : ''}`;
  if (action === 'BET') return `Bet${strategy.action_size ? ` (${strategy.action_size})` : ''}`;
  return action;
};

export const formatVillainAction = (strategy: StrategyNode): string =>
  strategy.action_vilain || strategy.title || `Stratégie #${strategy.id}`;

export const truncatePathForStreet = (
  allStrategies: StrategyNode[],
  path: number[],
  currentStreetDb: DbStreet
): number[] => {
  const maxIdx = STREET_ORDER.indexOf(currentStreetDb);
  return path.filter(id => {
    const s = allStrategies.find(st => st.id === id);
    if (!s) return false;
    return STREET_ORDER.indexOf(s.street as DbStreet) <= maxIdx;
  });
};
