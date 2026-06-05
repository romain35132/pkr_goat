use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use sqlx::PgPool;
use std::sync::Arc;

use crate::models::{
    CreateProfile, CreateSituation, CreateStrategy, Profile, Situation, Strategy,
};

// AppState to hold the database pool
pub struct AppState {
    pub db: PgPool,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/profiles", get(get_profiles).post(create_profile))
        .route("/profiles/:id", put(update_profile).delete(delete_profile))
        .route("/situations", get(get_situations).post(create_situation))
        .route("/situations/:id", put(update_situation).delete(delete_situation))
        .route("/strategies", get(get_strategies).post(create_strategy))
        .route("/strategies/:id", put(update_strategy).delete(delete_strategy))
        .with_state(state)
}

// --- Profiles ---

async fn get_profiles(State(state): State<Arc<AppState>>) -> Result<Json<Vec<Profile>>, StatusCode> {
    let profiles = sqlx::query_as::<_, Profile>("SELECT * FROM profiles ORDER BY id")
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(profiles))
}

async fn create_profile(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateProfile>,
) -> Result<(StatusCode, Json<Profile>), StatusCode> {
    let profile = sqlx::query_as::<_, Profile>(
        "INSERT INTO profiles (name, description) VALUES ($1, $2) RETURNING *"
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(profile)))
}

async fn update_profile(
    Path(id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateProfile>,
) -> Result<Json<Profile>, StatusCode> {
    let profile = sqlx::query_as::<_, Profile>(
        "UPDATE profiles SET name = $1, description = $2 WHERE id = $3 RETURNING *"
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(profile))
}

async fn delete_profile(
    Path(id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM profiles WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

// --- Situations ---

async fn get_situations(State(state): State<Arc<AppState>>) -> Result<Json<Vec<Situation>>, StatusCode> {
    let situations = sqlx::query_as::<_, Situation>("SELECT * FROM situations ORDER BY id")
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(situations))
}

async fn create_situation(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateSituation>,
) -> Result<(StatusCode, Json<Situation>), StatusCode> {
    let situation = sqlx::query_as::<_, Situation>(
        "INSERT INTO situations (parent_id, street, runout_id, action_history) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(payload.parent_id)
    .bind(&payload.street)
    .bind(payload.runout_id)
    .bind(&payload.action_history)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(situation)))
}

async fn update_situation(
    Path(id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateSituation>,
) -> Result<Json<Situation>, StatusCode> {
    let situation = sqlx::query_as::<_, Situation>(
        "UPDATE situations SET parent_id = $1, street = $2, runout_id = $3, action_history = $4 WHERE id = $5 RETURNING *"
    )
    .bind(payload.parent_id)
    .bind(&payload.street)
    .bind(payload.runout_id)
    .bind(&payload.action_history)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(situation))
}

async fn delete_situation(
    Path(id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM situations WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

// --- Strategies ---

async fn get_strategies(State(state): State<Arc<AppState>>) -> Result<Json<Vec<Strategy>>, StatusCode> {
    let strategies = sqlx::query_as::<_, Strategy>("SELECT * FROM strategies ORDER BY id")
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            eprintln!("Error fetching strategies: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(strategies))
}

async fn create_strategy(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateStrategy>,
) -> Result<(StatusCode, Json<Strategy>), StatusCode> {
    let strategy = sqlx::query_as::<_, Strategy>(
        "INSERT INTO strategies (title, profile_id, parent_strategy_id, street, pot_size_bb, hero_action, action_size, action_vilain, position_relative, position_preflop, strategy_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *"
    )
    .bind(&payload.title)
    .bind(payload.profile_id)
    .bind(payload.parent_strategy_id)
    .bind(&payload.street)
    .bind(payload.pot_size_bb)
    .bind(&payload.hero_action)
    .bind(&payload.action_size)
    .bind(&payload.action_vilain)
    .bind(&payload.position_relative)
    .bind(&payload.position_preflop)
    .bind(&payload.strategy_data)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(strategy)))
}

async fn update_strategy(
    Path(id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateStrategy>,
) -> Result<Json<Strategy>, StatusCode> {
    let strategy = sqlx::query_as::<_, Strategy>(
        "UPDATE strategies SET title = $1, profile_id = $2, parent_strategy_id = $3, street = $4, pot_size_bb = $5, hero_action = $6, action_size = $7, action_vilain = $8, position_relative = $9, position_preflop = $10, strategy_data = $11 WHERE id = $12 RETURNING *"
    )
    .bind(&payload.title)
    .bind(payload.profile_id)
    .bind(payload.parent_strategy_id)
    .bind(&payload.street)
    .bind(payload.pot_size_bb)
    .bind(&payload.hero_action)
    .bind(&payload.action_size)
    .bind(&payload.action_vilain)
    .bind(&payload.position_relative)
    .bind(&payload.position_preflop)
    .bind(&payload.strategy_data)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(strategy))
}

async fn delete_strategy(
    Path(id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM strategies WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
