use rs_poker::core::{Card, Suit, Value};
use std::collections::HashSet;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct HoleCards(pub Card, pub Card);

impl HoleCards {
    pub fn new(c1: Card, c2: Card) -> Self {
        // Ensure consistent ordering (e.g., higher value first) to avoid duplicates
        if c1.value > c2.value || (c1.value == c2.value && c1.suit > c2.suit) {
            HoleCards(c1, c2)
        } else {
            HoleCards(c2, c1)
        }
    }
}

pub fn parse_card(s: &str) -> Result<Card, String> {
    if s.len() != 2 {
        return Err(format!("Invalid card string: {}", s));
    }
    let chars: Vec<char> = s.chars().collect();
    let value = match chars[0] {
        '2' => Value::Two,
        '3' => Value::Three,
        '4' => Value::Four,
        '5' => Value::Five,
        '6' => Value::Six,
        '7' => Value::Seven,
        '8' => Value::Eight,
        '9' => Value::Nine,
        'T' | 't' => Value::Ten,
        'J' | 'j' => Value::Jack,
        'Q' | 'q' => Value::Queen,
        'K' | 'k' => Value::King,
        'A' | 'a' => Value::Ace,
        _ => return Err(format!("Invalid card value: {}", chars[0])),
    };
    let suit = match chars[1] {
        's' | 'S' => Suit::Spade,
        'h' | 'H' => Suit::Heart,
        'd' | 'D' => Suit::Diamond,
        'c' | 'C' => Suit::Club,
        _ => return Err(format!("Invalid card suit: {}", chars[1])),
    };
    Ok(Card { value, suit })
}

pub fn parse_hand(s: &str) -> Result<HoleCards, String> {
    if s.len() != 4 {
        return Err(format!("Invalid hand string: {}", s));
    }
    let c1 = parse_card(&s[0..2])?;
    let c2 = parse_card(&s[2..4])?;
    Ok(HoleCards::new(c1, c2))
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hand() {
        let hand = parse_hand("AhKd").unwrap();
        assert_eq!(hand.0.value, Value::Ace);
        assert_eq!(hand.0.suit, Suit::Heart);
        assert_eq!(hand.1.value, Value::King);
        assert_eq!(hand.1.suit, Suit::Diamond);
    }
}
