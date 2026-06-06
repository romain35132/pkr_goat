export const CATEGORY_LABELS: Record<string, string> = {
  StraightFlush: 'Quinte Flush',
  FourOfAKind: 'Carré',
  FullHouse: 'Full',
  Flush: 'Couleur',
  Straight: 'Quinte',
  Set: 'Brelan (Set)',
  Trips: 'Brelan (Trips)',
  TwoPairBothHoleCards: 'Double Paire',
  TwoPairOneHoleCard: 'Double Paire (1 carte board)',
  Overpair: 'Overpair',
  TopPair: 'Top Pair',
  SecondPair: 'Seconde Paire',
  ThirdPair: 'Troisième Paire',
  IntermediatePair: 'Paire Intermédiaire',
  Underpair: 'Underpair',
  SmallPair: 'Petite Paire',
  PairWithTurnCard: 'Paire avec la carte de la turn',
  PairWithRiverCard: 'Paire avec la carte de la river',
  HighCard: 'Hauteur',
  Overcard: 'Overcard',
  Oesd2Card: 'OESD (2card)',
  Oesd1Card: 'OESD (1card)',
  FlushDraw: 'Flushdraw',
  TurnFlushDraw: 'Flush draw de la turn',
  FlopFlushDraw: 'Flush draw du flop',
  Gutshot2Card: 'Gutshot (2card)',
  Gutshot1Card: 'Gutshot (1card)',
  ComboDraw: 'Combo draw',
  OesdAndFd: 'OESD + FD',
  GutshotAndFd: 'Gutshot + FD',
  BackdoorFlushDraw1Card: '1 card backdoor flushdraw',
  BackdoorFlushDraw2Card: '2 card backdoor flushdraw',
  BackdoorStraightDraw: 'Backdoor quinte',
  MissDraw: 'Miss draw',
  Nothing: 'Nothing',
};

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
