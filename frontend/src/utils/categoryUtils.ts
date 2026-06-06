const DRAW_CATEGORIES = new Set([
  'FlushDraw', 'TurnFlushDraw', 'FlopFlushDraw',
  'Oesd1Card', 'Oesd2Card', 'Gutshot1Card', 'Gutshot2Card',
  'ComboDraw', 'OesdAndFd', 'GutshotAndFd',
  'BackdoorFlushDraw1Card', 'BackdoorFlushDraw2Card', 'BackdoorStraightDraw',
]);

export const isCategoryVisible = (category: string, boardLength: number): boolean => {
  if (category === 'MissDraw') return boardLength === 5;
  if (category === 'TurnFlushDraw' || category === 'FlopFlushDraw') return boardLength === 4;
  if (category === 'BackdoorStraightDraw') return boardLength === 3;
  if (category === 'BackdoorFlushDraw1Card' || category === 'BackdoorFlushDraw2Card') {
    return boardLength === 3;
  }
  if (DRAW_CATEGORIES.has(category)) return boardLength < 5;
  if (category === 'PairWithRiverCard') return boardLength === 5;
  if (category === 'PairWithTurnCard') return boardLength >= 4;
  return true;
};
