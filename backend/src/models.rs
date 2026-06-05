use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Profile {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProfile {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Runout {
    pub id: i32,
    pub name: String,
    pub category: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Situation {
    pub id: i32,
    pub parent_id: Option<i32>,
    pub street: String,
    pub runout_id: Option<i32>,
    pub action_history: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSituation {
    pub parent_id: Option<i32>,
    pub street: String,
    pub runout_id: Option<i32>,
    pub action_history: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Strategy {
    pub id: i32,
    pub title: Option<String>,
    pub profile_id: i32,
    pub parent_strategy_id: Option<i32>,
    pub street: String,
    pub pot_size_bb: Option<f64>,
    pub hero_action: Option<String>,
    pub action_size: Option<String>,
    pub action_vilain: Option<String>,
    pub position_relative: Option<String>,
    pub position_preflop: Option<String>,
    pub strategy_data: Value,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateStrategy {
    pub title: Option<String>,
    pub profile_id: i32,
    pub parent_strategy_id: Option<i32>,
    pub street: String,
    pub pot_size_bb: Option<f64>,
    pub hero_action: Option<String>,
    pub action_size: Option<String>,
    pub action_vilain: Option<String>,
    pub position_relative: Option<String>,
    pub position_preflop: Option<String>,
    pub strategy_data: Value,
}
