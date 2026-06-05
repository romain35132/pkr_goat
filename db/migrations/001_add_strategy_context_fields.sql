-- Migration: ajout des champs contexte aux stratégies
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS action_vilain TEXT;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS position_relative VARCHAR(3) CHECK (position_relative IN ('OOP', 'IP'));
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS position_preflop VARCHAR(10) CHECK (position_preflop IN ('UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'));
