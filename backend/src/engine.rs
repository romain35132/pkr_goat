use crate::parser::HoleCards;
use rs_poker::core::{Card, Deck, Hand, Rankable};
use rand::seq::SliceRandom;
use rand::distributions::{WeightedIndex, Distribution};
use rayon::prelude::*;

#[derive(Debug, Default, Clone)]
pub struct EquityResult {
    pub wins: u32,
    pub ties: u32,
    pub losses: u32,
    pub iterations: u32,
}

pub fn equity_from_result(result: &EquityResult) -> f64 {
    let total = result.wins + result.ties + result.losses;
    if total == 0 {
        0.0
    } else {
        (result.wins as f64 + (result.ties as f64 / 2.0)) / total as f64
    }
}

fn run_iteration(
    player_hand: &HoleCards,
    opp_hand: &HoleCards,
    board: &[Card],
    rng: &mut impl rand::Rng,
) -> u8 {
    let remaining_cards: Vec<Card> = Deck::default()
        .into_iter()
        .filter(|c| {
            *c != player_hand.0
                && *c != player_hand.1
                && *c != opp_hand.0
                && *c != opp_hand.1
                && !board.contains(c)
        })
        .collect();

    let mut current_board = board.to_vec();
    let needed = 5 - current_board.len();

    let mut remaining_cards = remaining_cards;
    remaining_cards.shuffle(rng);

    for i in 0..needed {
        current_board.push(remaining_cards[i]);
    }

    let mut p_cards = current_board.clone();
    p_cards.push(player_hand.0);
    p_cards.push(player_hand.1);
    let p_rank = Hand::new_with_cards(p_cards).rank();

    let mut o_cards = current_board;
    o_cards.push(opp_hand.0);
    o_cards.push(opp_hand.1);
    let o_rank = Hand::new_with_cards(o_cards).rank();

    if p_rank > o_rank {
        2
    } else if p_rank < o_rank {
        0
    } else {
        1
    }
}

fn sample_from_range<'a>(
    range: &'a [(HoleCards, u8)],
    dist: &WeightedIndex<u32>,
    exclude: &HoleCards,
    board: &[Card],
    rng: &mut impl rand::Rng,
) -> Option<&'a HoleCards> {
    for _ in 0..100 {
        let candidate = &range[dist.sample(rng)].0;
        if !conflicts(candidate, exclude, board) {
            return Some(candidate);
        }
    }
    None
}

fn sample_pair_from_ranges<'a>(
    first_range: &'a [(HoleCards, u8)],
    first_dist: &WeightedIndex<u32>,
    second_range: &'a [(HoleCards, u8)],
    second_dist: &WeightedIndex<u32>,
    board: &[Card],
    rng: &mut impl rand::Rng,
) -> Option<(&'a HoleCards, &'a HoleCards)> {
    for _ in 0..100 {
        let first = &first_range[first_dist.sample(rng)].0;
        if conflicts_with_board(first, board) {
            continue;
        }
        for _ in 0..100 {
            let second = &second_range[second_dist.sample(rng)].0;
            if !conflicts(first, second, board) {
                return Some((first, second));
            }
        }
    }
    None
}

pub fn calculate_equity(
    player_hand: &HoleCards,
    opponent_range: &[(HoleCards, u8)],
    board: &[Card],
    iterations: u32,
) -> Result<EquityResult, String> {
    if opponent_range.is_empty() {
        return Err("Opponent range is empty".into());
    }

    let weights: Vec<u32> = opponent_range.iter().map(|(_, w)| *w as u32).collect();
    let dist = match WeightedIndex::new(&weights) {
        Ok(d) => d,
        Err(_) => return Err("Invalid weights in opponent range".into()),
    };

    let result = (0..iterations)
        .into_par_iter()
        .fold(
            || EquityResult::default(),
            |mut acc, _| {
                let mut rng = rand::thread_rng();

                let opp_hand = match sample_from_range(opponent_range, &dist, player_hand, board, &mut rng) {
                    Some(h) => h,
                    None => return acc,
                };

                match run_iteration(player_hand, opp_hand, board, &mut rng) {
                    2 => acc.wins += 1,
                    1 => acc.ties += 1,
                    _ => acc.losses += 1,
                }
                acc.iterations += 1;

                acc
            },
        )
        .reduce(
            || EquityResult::default(),
            |mut a, b| {
                a.wins += b.wins;
                a.ties += b.ties;
                a.losses += b.losses;
                a.iterations += b.iterations;
                a
            },
        );

    Ok(result)
}

pub fn calculate_equity_combos_vs_range(
    player_combos: &[(HoleCards, u8)],
    opponent_range: &[(HoleCards, u8)],
    board: &[Card],
    iterations: u32,
) -> Result<EquityResult, String> {
    let valid_player: Vec<(HoleCards, u8)> = player_combos
        .iter()
        .filter(|(h, _)| !conflicts_with_board(h, board))
        .cloned()
        .collect();

    if valid_player.is_empty() {
        return Err("No valid player combos for this board".into());
    }
    if opponent_range.is_empty() {
        return Err("Opponent range is empty".into());
    }

    let player_weights: Vec<u32> = valid_player.iter().map(|(_, w)| *w as u32).collect();
    let player_dist = WeightedIndex::new(&player_weights)
        .map_err(|_| "Invalid weights in player combos".to_string())?;

    let opp_weights: Vec<u32> = opponent_range.iter().map(|(_, w)| *w as u32).collect();
    let opp_dist = WeightedIndex::new(&opp_weights)
        .map_err(|_| "Invalid weights in opponent range".to_string())?;

    let result = (0..iterations)
        .into_par_iter()
        .fold(
            || EquityResult::default(),
            |mut acc, _| {
                let mut rng = rand::thread_rng();

                let player_hand = &valid_player[player_dist.sample(&mut rng)].0;
                let opp_hand = match sample_from_range(opponent_range, &opp_dist, player_hand, board, &mut rng) {
                    Some(h) => h,
                    None => return acc,
                };

                match run_iteration(player_hand, opp_hand, board, &mut rng) {
                    2 => acc.wins += 1,
                    1 => acc.ties += 1,
                    _ => acc.losses += 1,
                }
                acc.iterations += 1;

                acc
            },
        )
        .reduce(
            || EquityResult::default(),
            |mut a, b| {
                a.wins += b.wins;
                a.ties += b.ties;
                a.losses += b.losses;
                a.iterations += b.iterations;
                a
            },
        );

    Ok(result)
}

pub fn calculate_equity_range_vs_range(
    player_range: &[(HoleCards, u8)],
    opponent_range: &[(HoleCards, u8)],
    board: &[Card],
    iterations: u32,
) -> Result<EquityResult, String> {
    if player_range.is_empty() {
        return Err("Player range is empty".into());
    }
    if opponent_range.is_empty() {
        return Err("Opponent range is empty".into());
    }

    let player_weights: Vec<u32> = player_range.iter().map(|(_, w)| *w as u32).collect();
    let player_dist = WeightedIndex::new(&player_weights)
        .map_err(|_| "Invalid weights in player range".to_string())?;

    let opp_weights: Vec<u32> = opponent_range.iter().map(|(_, w)| *w as u32).collect();
    let opp_dist = WeightedIndex::new(&opp_weights)
        .map_err(|_| "Invalid weights in opponent range".to_string())?;

    let result = (0..iterations)
        .into_par_iter()
        .fold(
            || EquityResult::default(),
            |mut acc, _| {
                let mut rng = rand::thread_rng();

                let (player_hand, opp_hand) = match sample_pair_from_ranges(
                    player_range,
                    &player_dist,
                    opponent_range,
                    &opp_dist,
                    board,
                    &mut rng,
                ) {
                    Some(pair) => pair,
                    None => return acc,
                };

                match run_iteration(player_hand, opp_hand, board, &mut rng) {
                    2 => acc.wins += 1,
                    1 => acc.ties += 1,
                    _ => acc.losses += 1,
                }
                acc.iterations += 1;

                acc
            },
        )
        .reduce(
            || EquityResult::default(),
            |mut a, b| {
                a.wins += b.wins;
                a.ties += b.ties;
                a.losses += b.losses;
                a.iterations += b.iterations;
                a
            },
        );

    Ok(result)
}

fn conflicts_with_board(h: &HoleCards, board: &[Card]) -> bool {
    board.contains(&h.0) || board.contains(&h.1)
}

fn conflicts(h1: &HoleCards, h2: &HoleCards, board: &[Card]) -> bool {
    if h1.0 == h2.0 || h1.0 == h2.1 || h1.1 == h2.0 || h1.1 == h2.1 {
        return true;
    }
    conflicts_with_board(h1, board) || conflicts_with_board(h2, board)
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::{parse_card, parse_hand};
    use crate::range::expand_range;

    #[test]
    fn test_equity_aa_vs_kk() {
        let player_hand = parse_hand("AsAh").unwrap();
        let opponent_range = expand_range("KsKh").unwrap();
        let board = vec![];
        
        let result = calculate_equity(&player_hand, &opponent_range, &board, 10000).unwrap();
        let total = result.wins + result.ties + result.losses;
        let equity = (result.wins as f64 + (result.ties as f64 / 2.0)) / total as f64;
        
        // AA vs KK is roughly 81.9%
        assert!(equity > 0.80 && equity < 0.84, "Equity was {}", equity);
    }

    #[test]
    fn test_equity_ak_vs_qq() {
        let player_hand = parse_hand("AsKs").unwrap();
        let opponent_range = expand_range("QhQd").unwrap();
        let board = vec![];
        
        let result = calculate_equity(&player_hand, &opponent_range, &board, 10000).unwrap();
        let total = result.wins + result.ties + result.losses;
        let equity = (result.wins as f64 + (result.ties as f64 / 2.0)) / total as f64;
        
        // AKs vs QQ is roughly 46% - 47%
        assert!(equity > 0.44 && equity < 0.49, "Equity was {}", equity);
    }
    
    #[test]
    fn test_equity_with_board() {
        let player_hand = parse_hand("AsKs").unwrap();
        let opponent_range = expand_range("QhQd").unwrap();
        let board = vec![
            parse_card("Qs").unwrap(),
            parse_card("Js").unwrap(),
            parse_card("2h").unwrap(),
        ];
        
        let result = calculate_equity(&player_hand, &opponent_range, &board, 10000).unwrap();
        let total = result.wins + result.ties + result.losses;
        let equity = (result.wins as f64 + (result.ties as f64 / 2.0)) / total as f64;
        
        // AKs has flush draw + gutshot straight draw vs Set of Queens
        // Equity is around 34%
        assert!(equity > 0.32 && equity < 0.36, "Equity was {}", equity);
    }
}
