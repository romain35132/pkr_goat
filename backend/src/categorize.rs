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
    OnePair, // Keep it for fallback or generic
    HighCard,
    
    Oesd1Card,
    Oesd2Card,
    FlushDraw,
    Gutshot1Card,
    Gutshot2Card,
    ComboDraw,
    OesdAndFd,
    GutshotAndFd,
    BackdoorFlushDraw,
    BackdoorStraightDraw,
    Overcard,
    Nothing,
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
                    if is_pocket_pair { HandCategory::Overpair } else { HandCategory::OnePair }
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
                        HandCategory::OnePair
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
    
    // Suit count
    let mut suit_counts = HashMap::new();
    for c in &cards {
        *suit_counts.entry(c.suit).or_insert(0) += 1;
    }
    let max_suit_count = *suit_counts.values().max().unwrap_or(&0);
    
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
    
    let is_flush = max_suit_count >= 5;
    
    let fd = max_suit_count == 4 && !is_flush;
    let bdfd = max_suit_count == 3 && board.len() == 3 && !is_flush;
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

    if fd { categories.push(HandCategory::FlushDraw); }
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
        HandCategory::OnePair | 
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
    
    if bdfd { categories.push(HandCategory::BackdoorFlushDraw); }
    if bdsd { categories.push(HandCategory::BackdoorStraightDraw); }
    
    if !fd && !oesd && !gutshot && !bdfd && !bdsd && !overcard && made_hand == HandCategory::HighCard {
        categories.push(HandCategory::Nothing);
    }
    
    categories
}
