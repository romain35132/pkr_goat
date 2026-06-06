use crate::parser::{parse_card, parse_hand, HoleCards};
use rs_poker::core::{Card, Suit, Value};
use std::collections::HashMap;

/// Parse a range string preserving original hand notations (e.g. "AKs", "QQ:75").
pub fn parse_range_entries(range_str: &str) -> Result<Vec<(String, u8)>, String> {
    let mut entries = Vec::new();
    let parts: Vec<&str> = range_str.split(',').map(|s| s.trim()).collect();

    for part in parts {
        if part.is_empty() {
            continue;
        }

        let mut weight = 100u8;
        let mut hand_part = part;
        if let Some(idx) = part.find(':') {
            hand_part = &part[..idx];
            if let Ok(w) = part[idx + 1..].parse::<u8>() {
                weight = w;
            }
        }

        if hand_part.is_empty() {
            continue;
        }

        entries.push((hand_part.to_string(), weight));
    }

    Ok(entries)
}

pub fn expand_range(range_str: &str) -> Result<Vec<(HoleCards, u8)>, String> {
    let mut all_hands = HashMap::new();
    let parts: Vec<&str> = range_str.split(',').map(|s| s.trim()).collect();

    for part in parts {
        if part.is_empty() {
            continue;
        }

        let mut weight = 100;
        let mut hand_part = part;
        if let Some(idx) = part.find(':') {
            hand_part = &part[..idx];
            if let Ok(w) = part[idx+1..].parse::<u8>() {
                weight = w;
            }
        }

        let hands = parse_range_part(hand_part)?;
        for h in hands {
            all_hands.insert(h, weight);
        }
    }

    Ok(all_hands.into_iter().collect())
}

fn parse_range_part(part: &str) -> Result<Vec<HoleCards>, String> {
    // Specific hand, e.g., AhKd
    if part.len() == 4 && !part.contains('+') && !part.contains('-') {
        let hand = parse_hand(part)?;
        return Ok(vec![hand]);
    }

    // Pair, e.g., QQ, QQ+, 22-55
    if part.len() >= 2 && part.chars().nth(0) == part.chars().nth(1) {
        let val = parse_value(part.chars().nth(0).unwrap())?;
        if part.len() == 2 {
            return Ok(generate_pairs(val, val));
        } else if part.ends_with('+') {
            return Ok(generate_pairs(val, Value::Ace));
        } else if part.contains('-') {
            let end_val = parse_value(part.chars().nth(3).unwrap())?;
            // Usually written as 22-55, so val is 2, end_val is 5
            let (min_v, max_v) = if val < end_val { (val, end_val) } else { (end_val, val) };
            return Ok(generate_pairs(min_v, max_v));
        }
    }

    // Suited or Offsuit, e.g., AKs, AKo, AQs+, JTo-KQo
    if part.len() >= 3 {
        let v1 = parse_value(part.chars().nth(0).unwrap())?;
        let v2 = parse_value(part.chars().nth(1).unwrap())?;
        let suitedness = part.chars().nth(2).unwrap();
        
        if suitedness == 's' || suitedness == 'o' {
            let is_suited = suitedness == 's';
            if part.len() == 3 {
                return Ok(generate_unpaired(v1, v2, v2, is_suited));
            } else if part.ends_with('+') {
                // e.g., AQs+ -> AQs, AKs. v1 is A, v2 is Q. max is A-1 (K)
                // Wait, if v1 is A, v2 is Q, the max v2 is K.
                let max_v2 = <Value as ValueExt>::from_u8(v1 as u8 - 1).unwrap();
                return Ok(generate_unpaired(v1, v2, max_v2, is_suited));
            } else if part.contains('-') {
                // e.g., JTs-KQs. v1=J, v2=T. end_v1=K, end_v2=Q.
                // Actually, we iterate the gap.
                let end_v1 = parse_value(part.chars().nth(4).unwrap())?;
                let end_v2 = parse_value(part.chars().nth(5).unwrap())?;
                let (min_v1, max_v1) = if v1 < end_v1 { (v1, end_v1) } else { (end_v1, v1) };
                let (min_v2, max_v2) = if v2 < end_v2 { (v2, end_v2) } else { (end_v2, v2) };
                
                let mut hands = Vec::new();
                let gap = (min_v1 as i8) - (min_v2 as i8);
                for v in (min_v1 as u8)..=(max_v1 as u8) {
                    let v1_curr = <Value as ValueExt>::from_u8(v).unwrap();
                    let v2_curr = <Value as ValueExt>::from_u8((v as i8 - gap) as u8).unwrap();
                    hands.extend(generate_unpaired(v1_curr, v2_curr, v2_curr, is_suited));
                }
                return Ok(hands);
            }
        }
    }

    Err(format!("Unsupported range format: {}", part))
}

fn parse_value(c: char) -> Result<Value, String> {
    match c {
        '2' => Ok(Value::Two),
        '3' => Ok(Value::Three),
        '4' => Ok(Value::Four),
        '5' => Ok(Value::Five),
        '6' => Ok(Value::Six),
        '7' => Ok(Value::Seven),
        '8' => Ok(Value::Eight),
        '9' => Ok(Value::Nine),
        'T' | 't' => Ok(Value::Ten),
        'J' | 'j' => Ok(Value::Jack),
        'Q' | 'q' => Ok(Value::Queen),
        'K' | 'k' => Ok(Value::King),
        'A' | 'a' => Ok(Value::Ace),
        _ => Err(format!("Invalid value: {}", c)),
    }
}

fn generate_pairs(min_v: Value, max_v: Value) -> Vec<HoleCards> {
    let mut hands = Vec::new();
    for v in (min_v as u8)..=(max_v as u8) {
        let val = <Value as ValueExt>::from_u8(v).unwrap();
        let suits = [Suit::Spade, Suit::Heart, Suit::Diamond, Suit::Club];
        for i in 0..4 {
            for j in (i + 1)..4 {
                hands.push(HoleCards::new(
                    Card { value: val, suit: suits[i] },
                    Card { value: val, suit: suits[j] },
                ));
            }
        }
    }
    hands
}

fn generate_unpaired(v1: Value, min_v2: Value, max_v2: Value, suited: bool) -> Vec<HoleCards> {
    let mut hands = Vec::new();
    let suits = [Suit::Spade, Suit::Heart, Suit::Diamond, Suit::Club];
    
    for v in (min_v2 as u8)..=(max_v2 as u8) {
        let v2 = <Value as ValueExt>::from_u8(v).unwrap();
        if v1 == v2 { continue; }
        
        if suited {
            for s in suits {
                hands.push(HoleCards::new(
                    Card { value: v1, suit: s },
                    Card { value: v2, suit: s },
                ));
            }
        } else {
            for s1 in suits {
                for s2 in suits {
                    if s1 != s2 {
                        hands.push(HoleCards::new(
                            Card { value: v1, suit: s1 },
                            Card { value: v2, suit: s2 },
                        ));
                    }
                }
            }
        }
    }
    hands
}

trait ValueExt {
    fn from_u8(v: u8) -> Option<Value>;
}

impl ValueExt for Value {
    fn from_u8(v: u8) -> Option<Value> {
        match v {
            0 => Some(Value::Two),
            1 => Some(Value::Three),
            2 => Some(Value::Four),
            3 => Some(Value::Five),
            4 => Some(Value::Six),
            5 => Some(Value::Seven),
            6 => Some(Value::Eight),
            7 => Some(Value::Nine),
            8 => Some(Value::Ten),
            9 => Some(Value::Jack),
            10 => Some(Value::Queen),
            11 => Some(Value::King),
            12 => Some(Value::Ace),
            _ => None,
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_range_pair() {
        let hands = expand_range("QQ").unwrap();
        assert_eq!(hands.len(), 6); // 4 suits, 4*3/2 = 6 combinations
    }

    #[test]
    fn test_expand_range_pair_plus() {
        let hands = expand_range("QQ+").unwrap();
        assert_eq!(hands.len(), 18); // QQ, KK, AA -> 3 * 6 = 18 combinations
    }

    #[test]
    fn test_expand_range_suited() {
        let hands = expand_range("AKs").unwrap();
        assert_eq!(hands.len(), 4); // 4 suits
    }

    #[test]
    fn test_expand_range_offsuit() {
        let hands = expand_range("AKo").unwrap();
        assert_eq!(hands.len(), 12); // 4 suits * 3 suits = 12 combinations
    }

    #[test]
    fn test_expand_range_with_weight() {
        let hands = expand_range("AKs:50").unwrap();
        assert_eq!(hands.len(), 4);
        for (_, weight) in hands {
            assert_eq!(weight, 50);
        }
    }
}
