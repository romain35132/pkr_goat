import { themeColors } from '../utils/themeColors';
import React from 'react';
import {
  StrategyNode,
  DbStreet,
  STREET_ORDER,
  computePotAtStrategy,
  getParentForVillainActions,
  getSelectedStrategyForStreet,
  getVillainActionNodes,
  getHeroActionNodes,
  getVillainNodeForHero,
  formatHeroAction,
  formatVillainAction,
} from '../utils/strategyUtils';

const STREET_LABELS: Record<DbStreet, string> = {
  PREFLOP: 'Preflop',
  FLOP: 'Flop',
  TURN: 'Turn',
  RIVER: 'River',
};

interface ActionTreeNavigatorProps {
  allStrategies: StrategyNode[];
  strategyPath: number[];
  selectedPreflopId: string;
  currentStreetDb: DbStreet;
  pendingVillainNodeId: number | null;
  onSelectVillain: (strategy: StrategyNode) => void;
  onSelectHero: (strategy: StrategyNode) => void;
  onGoBack: () => void;
  onResetPath: () => void;
}

export const ActionTreeNavigator: React.FC<ActionTreeNavigatorProps> = ({
  allStrategies,
  strategyPath,
  selectedPreflopId,
  currentStreetDb,
  pendingVillainNodeId,
  onSelectVillain,
  onSelectHero,
  onGoBack,
  onResetPath,
}) => {
  if (currentStreetDb === 'PREFLOP') return null;

  if (!selectedPreflopId) {
    return (
      <div style={{
        padding: '15px',
        backgroundColor: themeColors.surfaceAlt,
        borderRadius: '8px',
        color: themeColors.textMuted,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: '20px',
      }}>
        Sélectionnez d'abord une stratégie Preflop pour naviguer dans les actions.
      </div>
    );
  }

  const parentId = getParentForVillainActions(
    allStrategies,
    strategyPath,
    selectedPreflopId,
    currentStreetDb
  );

  const villainActions = parentId
    ? getVillainActionNodes(allStrategies, parentId, currentStreetDb)
    : [];

  const selectedHeroForStreet = getSelectedStrategyForStreet(
    allStrategies,
    strategyPath,
    currentStreetDb
  );

  const selectedVillainForStreet = selectedHeroForStreet
    ? getVillainNodeForHero(allStrategies, selectedHeroForStreet)
    : undefined;

  const activeVillainId = pendingVillainNodeId
    ?? selectedVillainForStreet?.id
    ?? null;

  const heroActions = activeVillainId
    ? getHeroActionNodes(allStrategies, activeVillainId, currentStreetDb)
    : [];

  const breadcrumbItems: { label: string; street: DbStreet }[] = [];
  const preflop = allStrategies.find(s => s.id.toString() === selectedPreflopId);
  if (preflop) {
    breadcrumbItems.push({
      label: preflop.title || `Preflop #${preflop.id}`,
      street: 'PREFLOP',
    });
  }

  for (const street of STREET_ORDER.slice(1)) {
    if (STREET_ORDER.indexOf(street) > STREET_ORDER.indexOf(currentStreetDb)) break;
    const hero = getSelectedStrategyForStreet(allStrategies, strategyPath, street);
    if (hero) {
      const villain = getVillainNodeForHero(allStrategies, hero);
      if (villain && villain.id !== hero.id) {
        breadcrumbItems.push({
          label: formatVillainAction(villain),
          street,
        });
      }
      breadcrumbItems.push({
        label: formatHeroAction(hero),
        street,
      });
    }
  }

  const previousStreetsWithSelection = STREET_ORDER.slice(1, STREET_ORDER.indexOf(currentStreetDb))
    .map(street => {
      const hero = getSelectedStrategyForStreet(allStrategies, strategyPath, street);
      if (!hero) return null;
      return {
        street,
        villain: getVillainNodeForHero(allStrategies, hero),
        hero,
      };
    })
    .filter((item): item is { street: DbStreet; villain: StrategyNode | undefined; hero: StrategyNode } => item !== null);

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <label style={{ fontSize: '14px', color: themeColors.text, fontWeight: 'bold', margin: 0 }}>
          Arbre d'actions
        </label>
        {strategyPath.length > 0 && (
          <button
            type="button"
            onClick={onResetPath}
            style={{
              fontSize: '12px',
              color: '#e74c3c',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {breadcrumbItems.length > 1 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          alignItems: 'center',
          fontSize: '12px',
          color: themeColors.textMuted,
          marginBottom: '12px',
          padding: '8px 10px',
          backgroundColor: themeColors.surfaceAlt,
          borderRadius: '6px',
        }}>
          {breadcrumbItems.map((item, idx) => (
            <React.Fragment key={`${item.street}-${idx}`}>
              {idx > 0 && <span style={{ color: themeColors.borderInput }}>›</span>}
              <span style={{
                color: item.street === currentStreetDb ? '#3498db' : themeColors.textMuted,
                fontWeight: item.street === currentStreetDb ? 'bold' : 'normal',
              }}>
                {item.street !== 'PREFLOP' && <span style={{ color: '#95a5a6' }}>Vilain: </span>}
                {item.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {previousStreetsWithSelection.map(({ street, villain, hero }) => (
        <div
          key={street}
          style={{
            padding: '10px 12px',
            marginBottom: '8px',
            backgroundColor: '#eaf4fb',
            borderRadius: '6px',
            border: '1px solid #d4e6f1',
            fontSize: '13px',
          }}
        >
          <span style={{ color: themeColors.textMuted }}>{STREET_LABELS[street]} — Vilain: </span>
          <strong style={{ color: themeColors.text }}>{villain ? formatVillainAction(villain) : '—'}</strong>
          <span style={{ color: themeColors.textMuted, margin: '0 8px' }}>|</span>
          <span style={{ color: themeColors.textMuted }}>Hero: </span>
          <strong style={{ color: '#27ae60' }}>{formatHeroAction(hero)}</strong>
        </div>
      ))}

      {parentId === null && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fef9e7',
          borderRadius: '6px',
          border: '1px solid #f9e79f',
          fontSize: '13px',
          color: '#7d6608',
          marginBottom: '10px',
        }}>
          Sélectionnez d'abord l'action vilain à la rue précédente pour continuer.
        </div>
      )}

      {villainActions.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', color: themeColors.textMuted, marginBottom: '8px', fontWeight: 'bold' }}>
            Action Vilain — {STREET_LABELS[currentStreetDb]}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {villainActions.map(strategy => {
              const isSelected = activeVillainId === strategy.id;
              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => onSelectVillain(strategy)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: `2px solid ${isSelected ? '#3498db' : themeColors.borderInput}`,
                    backgroundColor: isSelected ? themeColors.activeBg : themeColors.surface,
                    color: isSelected ? themeColors.activeText : themeColors.text,
                    fontWeight: isSelected ? 'bold' : 'normal',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? '0 2px 4px rgba(52, 152, 219, 0.2)' : 'none',
                  }}
                >
                  {formatVillainAction(strategy)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {parentId !== null && villainActions.length === 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: themeColors.surfaceAlt,
          borderRadius: '6px',
          fontSize: '13px',
          color: themeColors.textMuted,
          fontStyle: 'italic',
        }}>
          Aucune action vilain configurée pour {STREET_LABELS[currentStreetDb]}.
        </div>
      )}

      {activeVillainId && heroActions.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '13px', color: themeColors.textMuted, marginBottom: '8px', fontWeight: 'bold' }}>
            Action Hero — {STREET_LABELS[currentStreetDb]}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {heroActions.map(strategy => {
              const isSelected = selectedHeroForStreet?.id === strategy.id;
              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => onSelectHero(strategy)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: `2px solid ${isSelected ? themeColors.filterActiveBorder : themeColors.borderInput}`,
                    backgroundColor: isSelected ? themeColors.filterActiveBg : themeColors.surface,
                    color: isSelected ? themeColors.filterActiveText : themeColors.text,
                    fontWeight: isSelected ? 'bold' : 'normal',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? '0 2px 4px rgba(39, 174, 96, 0.2)' : 'none',
                  }}
                >
                  {formatHeroAction(strategy)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeVillainId && heroActions.length === 0 && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#fef9e7',
          borderRadius: '6px',
          border: '1px solid #f9e79f',
          fontSize: '13px',
          color: '#7d6608',
        }}>
          Aucune action hero configurée pour cette ligne vilain.
        </div>
      )}

      {selectedHeroForStreet && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: themeColors.filterActiveBg,
          borderRadius: '6px',
          border: `1px solid ${themeColors.filterActiveBorder}`,
          fontSize: '13px',
        }}>
          <div>
            <span style={{ color: themeColors.textMuted }}>Ligne sélectionnée ({STREET_LABELS[currentStreetDb]}): </span>
            <strong style={{ color: themeColors.text }}>
              {selectedVillainForStreet ? `${formatVillainAction(selectedVillainForStreet)} → ` : ''}
            </strong>
            <strong style={{ color: themeColors.filterActiveText }}>{formatHeroAction(selectedHeroForStreet)}</strong>
          </div>
          {(() => {
            const pot = computePotAtStrategy(selectedHeroForStreet, allStrategies)
              ?? selectedHeroForStreet.pot_size_bb;
            return pot != null ? (
              <div style={{ marginTop: '4px', color: themeColors.textMuted }}>
                Pot: <strong style={{ color: themeColors.text }}>{pot} bb</strong>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {strategyPath.length > 0 && (
        <button
          type="button"
          onClick={onGoBack}
          style={{
            marginTop: '10px',
            padding: '6px 12px',
            fontSize: '12px',
            color: themeColors.textMuted,
            backgroundColor: themeColors.inputBg,
            border: `1px solid ${themeColors.borderInput}`,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Retour
        </button>
      )}
    </div>
  );
};
