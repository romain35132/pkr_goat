import { CategoryResult } from '../components/CategoryDetailModal';
import { isCategoryVisible } from './categoryUtils';

export const resolveStrategyWeight = (
  category: string,
  parsedStrategy: Record<string, number>,
): number | undefined => {
  let strategyWeight = parsedStrategy[category];

  if (strategyWeight === undefined && (category === 'BackdoorFlushDraw1Card' || category === 'BackdoorFlushDraw2Card')) {
    strategyWeight = parsedStrategy['BackdoorFlushDraw'];
  }

  // MissDraw n'est pas configurable directement : hérite des catégories « air »
  if (strategyWeight === undefined && category === 'MissDraw') {
    const related = ['HighCard', 'Nothing', 'Overcard']
      .map(k => parsedStrategy[k])
      .filter(w => w !== undefined && !isNaN(Number(w)))
      .map(w => Number(w));
    if (related.length > 0) {
      strategyWeight = Math.min(...related);
    }
  }

  if (typeof strategyWeight === 'string') {
    strategyWeight = parseInt(strategyWeight, 10);
  }

  return strategyWeight !== undefined && !isNaN(strategyWeight) ? strategyWeight : undefined;
};

export const applyStrategyToCategories = (
  base: CategoryResult[],
  data: Record<string, number> | string | undefined,
): CategoryResult[] => {
  const clone = JSON.parse(JSON.stringify(base)) as CategoryResult[];

  if (!data) return clone;

  let parsedStrategy: Record<string, number>;
  if (typeof data === 'string') {
    try {
      parsedStrategy = JSON.parse(data);
    } catch {
      return clone;
    }
  } else {
    parsedStrategy = data;
  }

  return clone.map(cat => {
    const strategyWeight = resolveStrategyWeight(cat.category, parsedStrategy);
    if (strategyWeight === undefined) return cat;

    const targetCount = Math.round(cat.hands.length * (strategyWeight / 100));
    return {
      ...cat,
      hands: cat.hands.map((h, idx) => ({
        ...h,
        weight: idx < targetCount ? h.weight : 0,
      })),
    };
  });
};

/** Une main est incluse si au moins une de ses catégories actives la conserve (max, pas min). */
export const buildEffectiveRange = (
  categories: CategoryResult[],
  activeCategories: Record<string, boolean>,
  boardLength: number,
): Record<string, number> => {
  const handWeights: Record<string, number[]> = {};

  categories.forEach(cat => {
    if (!isCategoryVisible(cat.category, boardLength)) return;
    if (!activeCategories[cat.category]) return;

    cat.hands.forEach(h => {
      if (!handWeights[h.hand]) handWeights[h.hand] = [];
      handWeights[h.hand].push(h.weight);
    });
  });

  const newRange: Record<string, number> = {};
  for (const [hand, weights] of Object.entries(handWeights)) {
    const weight = Math.max(...weights);
    if (weight > 0) {
      newRange[hand] = weight;
    }
  }
  return newRange;
};

export const buildStrategyRange = (
  strategyData: Record<string, number> | string | undefined,
  baseCats: CategoryResult[],
  activeCats: Record<string, boolean>,
  boardLength: number,
): Record<string, number> => {
  if (!strategyData || baseCats.length === 0) return {};

  const strategyApplied = applyStrategyToCategories(baseCats, strategyData);
  return buildEffectiveRange(strategyApplied, activeCats, boardLength);
};
