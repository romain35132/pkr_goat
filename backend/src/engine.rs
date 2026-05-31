use crate::parser::{HoleCards, parse_card};
use rs_poker::core::{Card, Deck, Hand, Rankable};
use rand::seq::SliceRandom;
use rand::distributions::{WeightedIndex, Distribution};
use rayon::prelude::*;

#[derive(Debug, Default)]
pub struct EquityResult {
    pub wins: u32,
    pub ties: u32,
    pub losses: u32,
    pub iterations: u32,
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

                // 1. Pick a random opponent hand from the range
                // We must ensure it doesn't conflict with player hand or board
                let mut opp_hand = None;
                // Try a few times to find a non-conflicting hand
                for _ in 0..100 {
                    let candidate_idx = dist.sample(&mut rng);
                    let candidate = &opponent_range[candidate_idx].0;
                    if !conflicts(candidate, player_hand, board) {
                        opp_hand = Some(candidate);
                        break;
                    }
                }

                let opp_hand = match opp_hand {
                    Some(h) => h,
                    None => return acc, // Skip if we couldn't find a valid hand
                };

                // 2. Build the deck and remove known cards
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

                // 3. Deal remaining board cards
                let mut current_board = board.to_vec();
                let needed = 5 - current_board.len();
                
                // Shuffle deck and take needed cards
                let mut remaining_cards = remaining_cards;
                remaining_cards.shuffle(&mut rng);
                
                for i in 0..needed {
                    current_board.push(remaining_cards[i]);
                }

                // 4. Evaluate hands
                let mut p_cards = current_board.clone();
                p_cards.push(player_hand.0);
                p_cards.push(player_hand.1);
                let p_hand = Hand::new_with_cards(p_cards);
                let p_rank = p_hand.rank();

                let mut o_cards = current_board;
                o_cards.push(opp_hand.0);
                o_cards.push(opp_hand.1);
                let o_hand = Hand::new_with_cards(o_cards);
                let o_rank = o_hand.rank();

                // 5. Compare
                if p_rank > o_rank {
                    acc.wins += 1;
                } else if p_rank < o_rank {
                    acc.losses += 1;
                } else {
                    acc.ties += 1;
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

fn conflicts(h1: &HoleCards, h2: &HoleCards, board: &[Card]) -> bool {
    if h1.0 == h2.0 || h1.0 == h2.1 || h1.1 == h2.0 || h1.1 == h2.1 {
        return true;
    }
    for c in board {
        if h1.0 == *c || h1.1 == *c || h2.0 == *c || h2.1 == *c {
            return true;
        }
    }
    false
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
