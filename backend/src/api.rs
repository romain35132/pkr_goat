use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::time::Instant;

use crate::parser::{parse_card, parse_hand};
use crate::range::expand_range;
use crate::engine::calculate_equity;
use crate::categorize::{categorize_hand, HandCategory};
use rs_poker::core::{Card, Rankable};
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct EquityRequest {
    pub player_hand: String,
    pub opponent_range: String,
    #[serde(default)]
    pub board: String,
    #[serde(default = "default_iterations")]
    pub iterations: u32,
}

fn default_iterations() -> u32 {
    100000
}

#[derive(Serialize)]
pub struct EquityResponse {
    pub equity: f64,
    pub wins: u32,
    pub ties: u32,
    pub losses: u32,
    pub iterations: u32,
    pub time_ms: u128,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub async fn calculate_equity_handler(
    Json(payload): Json<EquityRequest>,
) -> impl IntoResponse {
    let start = Instant::now();

    // Parse player hand
    let player_hand = match parse_hand(&payload.player_hand) {
        Ok(h) => h,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    // Parse opponent range
    let opponent_range = match expand_range(&payload.opponent_range) {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    if opponent_range.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Opponent range is empty".to_string() })).into_response();
    }

    // Parse board
    let mut board = Vec::new();
    let board_str = payload.board.trim();
    if !board_str.is_empty() {
        let parts: Vec<&str> = board_str.split_whitespace().collect();
        if parts.len() > 5 {
            return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Board cannot have more than 5 cards".to_string() })).into_response();
        }
        for part in parts {
            match parse_card(part) {
                Ok(c) => board.push(c),
                Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
            }
        }
    }

    // Calculate equity
    let result = match calculate_equity(&player_hand, &opponent_range, &board, payload.iterations) {
        Ok(r) => r,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e })).into_response(),
    };

    let total = result.wins + result.ties + result.losses;
    let equity = if total > 0 {
        (result.wins as f64 + (result.ties as f64 / 2.0)) / total as f64
    } else {
        0.0
    };

    let response = EquityResponse {
        equity,
        wins: result.wins,
        ties: result.ties,
        losses: result.losses,
        iterations: result.iterations,
        time_ms: start.elapsed().as_millis(),
    };

    (StatusCode::OK, Json(response)).into_response()
}

#[derive(Deserialize)]
pub struct CategorizeRequest {
    pub opponent_range: String,
    pub board: String,
    #[serde(default)]
    pub dead_cards: String,
}

#[derive(Serialize)]
pub struct CategorizedHand {
    pub hand: String,
    pub weight: u8,
}

#[derive(Serialize)]
pub struct CategoryResult {
    pub category: HandCategory,
    pub hands: Vec<CategorizedHand>,
}

#[derive(Serialize)]
pub struct CategorizeResponse {
    pub categories: Vec<CategoryResult>,
}

pub async fn categorize_handler(
    Json(payload): Json<CategorizeRequest>,
) -> impl IntoResponse {
    // Parse opponent range
    let opponent_range = match expand_range(&payload.opponent_range) {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    if opponent_range.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Opponent range is empty".to_string() })).into_response();
    }

    // Parse board
    let mut board = Vec::new();
    let board_str = payload.board.trim();
    if board_str.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Board is required for categorization".to_string() })).into_response();
    }
    
    let parts: Vec<&str> = board_str.split_whitespace().collect();
    if parts.len() > 5 {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Board cannot have more than 5 cards".to_string() })).into_response();
    }
    for part in parts {
        match parse_card(part) {
            Ok(c) => board.push(c),
            Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
        }
    }

    let mut dead = Vec::new();
    let dead_str = payload.dead_cards.trim();
    if !dead_str.is_empty() {
        let parts: Vec<&str> = dead_str.split_whitespace().collect();
        for part in parts {
            match parse_card(part) {
                Ok(c) => dead.push(c),
                Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
            }
        }
    }

    let mut map: HashMap<HandCategory, Vec<(CategorizedHand, rs_poker::core::Rank)>> = HashMap::new();

    for (hole_cards, weight) in opponent_range {
        let c1 = hole_cards.0;
        let c2 = hole_cards.1;
        
        if dead.contains(&c1) || dead.contains(&c2) || board.contains(&c1) || board.contains(&c2) {
            continue;
        }

        let categories = categorize_hand(&hole_cards, &board);
        let hand_str = format!("{}{}", hole_cards.0, hole_cards.1);
        
        let mut eval_cards = board.clone();
        eval_cards.push(c1);
        eval_cards.push(c2);
        let rank = rs_poker::core::Hand::new_with_cards(eval_cards).rank();
        
        for category in categories {
            map.entry(category).or_insert_with(Vec::new).push((CategorizedHand {
                hand: hand_str.clone(),
                weight,
            }, rank.clone()));
        }
    }

    let mut categories: Vec<CategoryResult> = map
        .into_iter()
        .map(|(category, mut hands_with_rank)| {
            hands_with_rank.sort_by(|a, b| b.1.cmp(&a.1));
            let hands = hands_with_rank.into_iter().map(|(h, _)| h).collect();
            CategoryResult { category, hands }
        })
        .collect();

    // Optionally sort categories here or handle in frontend

    (StatusCode::OK, Json(CategorizeResponse { categories })).into_response()
}
