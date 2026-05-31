use rs_poker::core::{Card, Suit, Value, Deck, Hand};
use rs_poker::core::Rankable;

fn main() {
    let mut deck = Deck::default();
    let c1 = deck.deal().unwrap();
    println!("Dealt: {:?}", c1);
}
