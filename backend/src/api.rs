use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::time::Instant;

use crate::parser::{parse_card, parse_hand};
use crate::range::{expand_range, parse_range_entries};
use crate::engine::{
    calculate_equity, calculate_equity_combos_vs_range, calculate_equity_range_vs_range,
    equity_from_result,
};
use crate::categorize::{categorize_hand, HandCategory};
use rs_poker::core::{Card, Rankable};
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct EquityRequest {
    #[serde(default)]
    pub player_hand: String,
    #[serde(default)]
    pub player_range: Option<String>,
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

fn parse_board(board_str: &str) -> Result<Vec<Card>, String> {
    let mut board = Vec::new();
    let board_str = board_str.trim();
    if board_str.is_empty() {
        return Ok(board);
    }

    let parts: Vec<&str> = board_str.split_whitespace().collect();
    if parts.len() > 5 {
        return Err("Board cannot have more than 5 cards".to_string());
    }
    for part in parts {
        board.push(parse_card(part)?);
    }
    Ok(board)
}

pub async fn calculate_equity_handler(
    Json(payload): Json<EquityRequest>,
) -> impl IntoResponse {
    let start = Instant::now();

    let opponent_range = match expand_range(&payload.opponent_range) {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    if opponent_range.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Opponent range is empty".to_string() })).into_response();
    }

    let board = match parse_board(&payload.board) {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    let result = if let Some(player_range_str) = payload.player_range.as_ref() {
        if player_range_str.trim().is_empty() {
            return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Player range is empty".to_string() })).into_response();
        }
        let player_range = match expand_range(player_range_str) {
            Ok(r) => r,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
        };
        if player_range.is_empty() {
            return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Player range is empty".to_string() })).into_response();
        }
        match calculate_equity_range_vs_range(&player_range, &opponent_range, &board, payload.iterations) {
            Ok(r) => r,
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e })).into_response(),
        }
    } else {
        if payload.player_hand.trim().is_empty() {
            return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "player_hand or player_range is required".to_string() })).into_response();
        }
        let player_hand = match parse_hand(&payload.player_hand) {
            Ok(h) => h,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
        };
        match calculate_equity(&player_hand, &opponent_range, &board, payload.iterations) {
            Ok(r) => r,
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e })).into_response(),
        }
    };

    let response = EquityResponse {
        equity: equity_from_result(&result),
        wins: result.wins,
        ties: result.ties,
        losses: result.losses,
        iterations: result.iterations,
        time_ms: start.elapsed().as_millis(),
    };

    (StatusCode::OK, Json(response)).into_response()
}

#[derive(Deserialize)]
pub struct HandMatrixRequest {
    pub player_range: String,
    pub opponent_range: String,
    #[serde(default)]
    pub board: String,
    #[serde(default = "default_matrix_iterations")]
    pub iterations: u32,
}

fn default_matrix_iterations() -> u32 {
    15000
}

#[derive(Serialize)]
pub struct HandEquityEntry {
    pub hand: String,
    pub equity: f64,
    pub combos: u32,
    pub weight: u8,
}

#[derive(Serialize)]
pub struct HandMatrixResponse {
    pub hands: Vec<HandEquityEntry>,
    pub aggregate_equity: f64,
    pub time_ms: u128,
}

pub async fn hand_matrix_handler(
    Json(payload): Json<HandMatrixRequest>,
) -> impl IntoResponse {
    let start = Instant::now();

    let entries = match parse_range_entries(&payload.player_range) {
        Ok(e) => e,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    if entries.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Player range is empty".to_string() })).into_response();
    }

    let opponent_range = match expand_range(&payload.opponent_range) {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    if opponent_range.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Opponent range is empty".to_string() })).into_response();
    }

    let board = match parse_board(&payload.board) {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
    };

    let mut hands = Vec::new();
    let mut weighted_equity_sum = 0.0f64;
    let mut total_combo_weight = 0.0f64;

    for (notation, weight) in entries {
        let player_combos = match expand_range(&notation) {
            Ok(c) => c,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })).into_response(),
        };

        let valid_combos = player_combos
            .iter()
            .filter(|(h, _)| !board.contains(&h.0) && !board.contains(&h.1))
            .count() as u32;

        if valid_combos == 0 {
            continue;
        }

        let weighted_combos = valid_combos as f64 * (weight as f64 / 100.0);

        let result = match calculate_equity_combos_vs_range(&player_combos, &opponent_range, &board, payload.iterations) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let equity = equity_from_result(&result);
        weighted_equity_sum += equity * weighted_combos;
        total_combo_weight += weighted_combos;

        hands.push(HandEquityEntry {
            hand: notation,
            equity,
            combos: valid_combos,
            weight,
        });
    }

    let aggregate_equity = if total_combo_weight > 0.0 {
        weighted_equity_sum / total_combo_weight
    } else {
        0.0
    };

    let response = HandMatrixResponse {
        hands,
        aggregate_equity,
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
