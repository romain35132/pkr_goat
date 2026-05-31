mod parser;
mod range;
mod engine;
mod api;
mod categorize;

use axum::{
    routing::post,
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use axum::http::Method;

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST])
        .allow_headers(Any);

    let static_dir = std::env::var("STATIC_FILES_DIR").unwrap_or_else(|_| "../frontend/dist".to_string());

    let api_routes = Router::new()
        .route("/v1/equity/monte-carlo", post(api::calculate_equity_handler))
        .route("/v1/range/categorize", post(api::categorize_handler));

    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new(&static_dir).fallback(ServeFile::new(format!("{}/index.html", static_dir))))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Server running on {}", addr);
    println!("Serving static files from {}", static_dir);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
