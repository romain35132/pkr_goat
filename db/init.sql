-- Initialization script for PostgreSQL Database: pkr_goat

-- ==============================================================================
-- 1. PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. RUNOUTS (Cartes communes / Flop, Turn, River)
-- ==============================================================================
-- Représente les cartes communes de manière exacte ou heuristique.
CREATE TABLE IF NOT EXISTS runouts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. SITUATIONS (Arbre de jeu unifié)
-- ==============================================================================
-- Remplace situations_preflop et situations_postflop.
-- Décrit les noeuds de l'arbre (le contexte du coup) indépendamment du joueur.
-- ex: parent_id pointe vers la situation précédente (Flop -> Preflop).
CREATE TABLE IF NOT EXISTS situations (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES situations(id) ON DELETE CASCADE,
    street VARCHAR(10) NOT NULL CHECK (street IN ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
    runout_id INTEGER REFERENCES runouts(id) ON DELETE SET NULL, -- NULL pour PREFLOP
    action_history TEXT NOT NULL, -- ex: "BTN open, BB call" ou "Check, Bet 33%"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. STRATEGIES (Unifiée)
-- ==============================================================================
-- Remplace preflop_strategies et postflop_strategies.
-- Associe un profil à une situation.
-- On ajoute parent_strategy_id pour relier explicitement une stratégie (ex: Turn) 
-- à la stratégie précédente (ex: Flop / Preflop) comme demandé.
-- strategy_data: stocke la range (matrice) ou les fréquences de réactions en JSONB.
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    parent_strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    street VARCHAR(10) NOT NULL CHECK (street IN ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
    pot_size_bb DOUBLE PRECISION,
    hero_action VARCHAR(10) CHECK (hero_action IN ('BET', 'CALL', 'CHECK')),
    action_size VARCHAR(50),
    strategy_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
