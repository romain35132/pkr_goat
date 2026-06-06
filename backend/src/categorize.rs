use rs_poker::core::{Card, Hand, Rankable, Rank};
use crate::parser::HoleCards;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum HandCategory {
    StraightFlush,
    FourOfAKind,
    FullHouse,
    Flush,
    Straight,
    Set,
    Trips,
    TwoPairBothHoleCards,
    TwoPairOneHoleCard,
    Overpair,
    TopPair,
    SecondPair,
    ThirdPair,
    IntermediatePair,
    Underpair,
    SmallPair,
    PairWithTurnCard,
    PairWithRiverCard,
    HighCard,
    
    Oesd1Card,
    Oesd2Card,
    FlushDraw,
    TurnFlushDraw,
    FlopFlushDraw,
    Gutshot1Card,
    Gutshot2Card,
    ComboDraw,
    OesdAndFd,
    GutshotAndFd,
    BackdoorFlushDraw1Card,
    BackdoorFlushDraw2Card,
    BackdoorStraightDraw,
    MissDraw,
    Overcard,
    Nothing,
}

fn is_draw_category(cat: &HandCategory) -> bool {
    matches!(
        cat,
        HandCategory::FlushDraw
            | HandCategory::TurnFlushDraw
            | HandCategory::FlopFlushDraw
            | HandCategory::Oesd1Card
            | HandCategory::Oesd2Card
            | HandCategory::Gutshot1Card
            | HandCategory::Gutshot2Card
            | HandCategory::ComboDraw
            | HandCategory::OesdAndFd
            | HandCategory::GutshotAndFd
            | HandCategory::BackdoorFlushDraw1Card
            | HandCategory::BackdoorFlushDraw2Card
    )
}

fn max_suit_count(cards: &[Card]) -> u8 {
    let mut suit_counts = HashMap::new();
    for c in cards {
        *suit_counts.entry(c.suit).or_insert(0u8) += 1;
    }
    *suit_counts.values().max().unwrap_or(&0)
}

fn has_flush_draw(cards: &[Card]) -> bool {
    max_suit_count(cards) == 4
}

fn is_made_flush(cards: &[Card]) -> bool {
    max_suit_count(cards) >= 5
}

pub fn categorize_hand(hole_cards: &HoleCards, board: &[Card]) -> Vec<HandCategory> {
    let mut cards = board.to_vec();
    cards.push(hole_cards.0);
    cards.push(hole_cards.1);
    
    let hand = Hand::new_with_cards(cards.clone());
    let rank = hand.rank();
    
    let hole_val1 = hole_cards.0.value as u8;
    let hole_val2 = hole_cards.1.value as u8;
    
    let mut val_counts = HashMap::new();
    for c in &cards {
        *val_counts.entry(c.value as u8).or_insert(0) += 1;
    }

    let made_hand = match rank {
        Rank::StraightFlush(_) => HandCategory::StraightFlush,
        Rank::FourOfAKind(_) => HandCategory::FourOfAKind,
        Rank::FullHouse(_) => HandCategory::FullHouse,
        Rank::Flush(_) => HandCategory::Flush,
        Rank::Straight(_) => HandCategory::Straight,
        Rank::ThreeOfAKind(_) => {
            let mut trips_val = 0;
            for (&v, &count) in &val_counts {
                if count >= 3 {
                    trips_val = v;
                    break;
                }
            }
            if hole_val1 == hole_val2 && hole_val1 == trips_val {
                HandCategory::Set
            } else if hole_val1 == trips_val || hole_val2 == trips_val {
                HandCategory::Trips
            } else {
                HandCategory::HighCard
            }
        },
        Rank::TwoPair(_) => {
            let mut pairs = Vec::new();
            for (&v, &count) in &val_counts {
                if count >= 2 {
                    pairs.push(v);
                }
            }
            pairs.sort_unstable_by(|a, b| b.cmp(a));
            if pairs.len() >= 2 {
                let v1 = pairs[0];
                let v2 = pairs[1];
                let h1_in = hole_val1 == v1 || hole_val1 == v2;
                let h2_in = hole_val2 == v1 || hole_val2 == v2;
                
                if h1_in && h2_in {
                    HandCategory::TwoPairBothHoleCards
                } else if h1_in || h2_in {
                    HandCategory::TwoPairOneHoleCard
                } else {
                    // Two pair on board, check if hole cards make a better pair
                    let mut board_values: Vec<u8> = board.iter().map(|c| c.value as u8).collect();
                    board_values.sort_unstable_by(|a, b| b.cmp(a));
                    board_values.dedup();

                    let val = if hole_val1 > hole_val2 { hole_val1 } else { hole_val2 };
                    let is_pocket_pair = hole_val1 == hole_val2;
                    let board_pos = board_values.iter().position(|&v| v == val);

                    if is_pocket_pair {
                        if val > board_values[0] {
                            HandCategory::Overpair
                        } else if val < *board_values.last().unwrap() {
                            HandCategory::Underpair
                        } else {
                            HandCategory::IntermediatePair
                        }
                    } else if let Some(pos) = board_pos {
                        match pos {
                            0 => HandCategory::TopPair,
                            1 => HandCategory::SecondPair,
                            2 => HandCategory::ThirdPair,
                            _ => HandCategory::SmallPair,
                        }
                    } else {
                        HandCategory::HighCard
                    }
                }
            } else {
                HandCategory::HighCard
            }
        },
        Rank::OnePair(_) => {
            let mut pair_val = 0;
            for (&v, &count) in &val_counts {
                if count >= 2 {
                    pair_val = v;
                    break;
                }
            }
            
            let mut board_values: Vec<u8> = board.iter().map(|c| c.value as u8).collect();
            board_values.sort_unstable_by(|a, b| b.cmp(a));
            board_values.dedup();

            let is_pocket_pair = hole_val1 == hole_val2 && hole_val1 == pair_val;
            let is_hole_card_pair = hole_val1 == pair_val || hole_val2 == pair_val;

            if is_hole_card_pair {
                if board_values.is_empty() {
                    if is_pocket_pair { HandCategory::Overpair } else { HandCategory::HighCard }
                } else {
                    let board_pos = board_values.iter().position(|&v| v == pair_val);

                    if is_pocket_pair {
                        if pair_val > board_values[0] {
                            HandCategory::Overpair
                        } else if pair_val < *board_values.last().unwrap() {
                            HandCategory::Underpair
                        } else {
                            HandCategory::IntermediatePair
                        }
                    } else if let Some(pos) = board_pos {
                        match pos {
                            0 => HandCategory::TopPair,
                            1 => HandCategory::SecondPair,
                            2 => HandCategory::ThirdPair,
                            _ => HandCategory::SmallPair,
                        }
                    } else {
                        HandCategory::HighCard
                    }
                }
            } else {
                // Pair is on the board
                HandCategory::HighCard
            }
        },
        Rank::HighCard(_) => HandCategory::HighCard,
    };

    let mut categories = vec![];
    if made_hand != HandCategory::HighCard {
        categories.push(made_hand.clone());
    }

    if board.len() >= 4 {
        let turn_val = board[3].value as u8;
        let is_set_on_turn = hole_val1 == hole_val2 && hole_val1 == turn_val;
        if !is_set_on_turn && (hole_val1 == turn_val || hole_val2 == turn_val) {
            categories.push(HandCategory::PairWithTurnCard);
        }
    }

    if board.len() >= 5 {
        let river_val = board[4].value as u8;
        let is_set_on_river = hole_val1 == hole_val2 && hole_val1 == river_val;
        if !is_set_on_river && (hole_val1 == river_val || hole_val2 == river_val) {
            categories.push(HandCategory::PairWithRiverCard);
        }
    }
    
    let max_suit_count_val = max_suit_count(&cards);
    
    // Straight outs helper
    let check_outs = |cards_subset: &[Card]| -> (bool, u8) {
        let mut unique_vals = [false; 14];
        for c in cards_subset {
            let v = c.value as u8;
            unique_vals[(v + 1) as usize] = true;
            if v == 12 { unique_vals[0] = true; }
        }
        
        let mut is_str = false;
        for i in 0..10 {
            if unique_vals[i] && unique_vals[i+1] && unique_vals[i+2] && unique_vals[i+3] && unique_vals[i+4] {
                is_str = true;
                break;
            }
        }
        
        let mut outs = 0;
        if !is_str {
            for out_val in 0..13 {
                let mut temp_vals = unique_vals.clone();
                temp_vals[out_val + 1] = true;
                if out_val == 12 { temp_vals[0] = true; }
                
                let mut makes_straight = false;
                for i in 0..10 {
                    if temp_vals[i] && temp_vals[i+1] && temp_vals[i+2] && temp_vals[i+3] && temp_vals[i+4] {
                        makes_straight = true;
                        break;
                    }
                }
                if makes_straight { outs += 1; }
            }
        }
        (is_str, outs)
    };

    let (is_straight, straight_outs) = check_outs(&cards);
    
    let mut is_bdsd = false;
    if straight_outs == 0 && !is_straight {
        let mut unique_vals = [false; 14];
        for c in &cards {
            let v = c.value as u8;
            unique_vals[(v + 1) as usize] = true;
            if v == 12 { unique_vals[0] = true; }
        }
        for i in 0..10 {
            let mut count = 0;
            for j in 0..5 {
                if unique_vals[i+j] { count += 1; }
            }
            if count >= 3 {
                is_bdsd = true;
                break;
            }
        }
    }
    
    let is_flush = is_made_flush(&cards);
    
    let fd = max_suit_count_val == 4 && !is_flush;
    let mut bdfd1 = false;
    let mut bdfd2 = false;

    let mut suit_counts = HashMap::new();
    for c in &cards {
        *suit_counts.entry(c.suit).or_insert(0) += 1;
    }

    if max_suit_count_val == 3 && (board.len() == 3 || board.len() == 4) && !is_flush {
        let max_suit = suit_counts.iter().max_by_key(|&(_, count)| count).unwrap().0;
        let mut hole_suit_count = 0;
        if hole_cards.0.suit == *max_suit { hole_suit_count += 1; }
        if hole_cards.1.suit == *max_suit { hole_suit_count += 1; }
        
        if hole_suit_count == 1 {
            bdfd1 = true;
        } else if hole_suit_count == 2 {
            bdfd2 = true;
        }
    }
    
    let oesd = straight_outs >= 2 && !is_straight;
    let gutshot = straight_outs == 1 && !is_straight;
    let bdsd = is_bdsd && straight_outs == 0 && board.len() == 3 && !is_straight;
    
    let board_max = board.iter().map(|c| c.value as u8).max().unwrap_or(0);
    let overcard = hole_val1 > board_max && hole_val2 > board_max && hole_val1 != hole_val2;

    let mut oesd1 = false;
    let mut gutshot1 = false;

    if oesd || gutshot {
        let mut cards_h1 = board.to_vec(); cards_h1.push(hole_cards.0);
        let mut cards_h2 = board.to_vec(); cards_h2.push(hole_cards.1);
        
        let (str1, outs1) = check_outs(&cards_h1);
        let (str2, outs2) = check_outs(&cards_h2);
        
        if outs1 >= 2 && !str1 || outs2 >= 2 && !str2 {
            oesd1 = true;
        }
        if outs1 == 1 && !str1 || outs2 == 1 && !str2 {
            gutshot1 = true;
        }
    }

    if board.len() < 5 {
        if fd {
            categories.push(HandCategory::FlushDraw);
            if board.len() == 4 {
                let mut flop_cards = board[0..3].to_vec();
                flop_cards.push(hole_cards.0);
                flop_cards.push(hole_cards.1);
                if has_flush_draw(&flop_cards) && !is_made_flush(&flop_cards) {
                    categories.push(HandCategory::FlopFlushDraw);
                } else {
                    categories.push(HandCategory::TurnFlushDraw);
                }
            }
        }
        if oesd {
            if oesd1 { categories.push(HandCategory::Oesd1Card); }
            else { categories.push(HandCategory::Oesd2Card); }
        }
        if gutshot {
            if gutshot1 { categories.push(HandCategory::Gutshot1Card); }
            else { categories.push(HandCategory::Gutshot2Card); }
        }
        if overcard { categories.push(HandCategory::Overcard); }
        
        if oesd && fd { categories.push(HandCategory::OesdAndFd); }
        if gutshot && fd { categories.push(HandCategory::GutshotAndFd); }
        
        let has_pair = matches!(made_hand, 
            HandCategory::Overpair | 
            HandCategory::TopPair | 
            HandCategory::SecondPair | 
            HandCategory::ThirdPair | 
            HandCategory::IntermediatePair | 
            HandCategory::Underpair | 
            HandCategory::SmallPair |
            HandCategory::TwoPairBothHoleCards | 
            HandCategory::TwoPairOneHoleCard
        );
        if has_pair && (fd || oesd || gutshot) {
            categories.push(HandCategory::ComboDraw);
        }
        
        if bdfd1 { categories.push(HandCategory::BackdoorFlushDraw1Card); }
        if bdfd2 { categories.push(HandCategory::BackdoorFlushDraw2Card); }
        if bdsd { categories.push(HandCategory::BackdoorStraightDraw); }
        
        if !fd && !oesd && !gutshot && !bdfd1 && !bdfd2 && !bdsd && !overcard && made_hand == HandCategory::HighCard {
            categories.push(HandCategory::Nothing);
        }
    } else {
        if overcard {
            categories.push(HandCategory::Overcard);
        }

        let turn_board = &board[0..4];
        let turn_categories = categorize_hand(hole_cards, turn_board);
        let had_draw_on_turn = turn_categories.iter().any(is_draw_category);
        if had_draw_on_turn && !is_flush && !is_straight && made_hand == HandCategory::HighCard {
            categories.push(HandCategory::MissDraw);
        } else if !overcard && made_hand == HandCategory::HighCard {
            categories.push(HandCategory::Nothing);
        }
    }
    
    categories
}
