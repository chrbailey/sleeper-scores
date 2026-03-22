"""receiver_profile.py — Build predictive receiver profiles from nflfastR play-by-play.

Analyzes WR and TE target data to produce profiles with opportunity metrics
(target share, WOPR, air yards share), efficiency metrics (EPA/target, ADOT,
RACR), role indicators, consistency scores, and situational context.
"""
from __future__ import annotations

import json
import os
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from analysis.loader import (
    load_plays,
    mean,
    pass_plays,
    plays_by_team,
    plays_by_week,
    safe_div,
    stdev,
)


def _team_pass_totals(passes: List[Dict]) -> Dict[str, Dict[str, Any]]:
    """Pre-compute per-team aggregates needed for share calculations.

    Returns dict keyed by team with:
        total_targets, total_air_yards, rz_pass_attempts
    """
    teams = {}  # type: Dict[str, Dict[str, Any]]
    for p in passes:
        team = p.get('posteam')
        if not team:
            continue
        if team not in teams:
            teams[team] = {
                'total_targets': 0,
                'total_air_yards': 0.0,
                'rz_pass_attempts': 0,
            }
        teams[team]['total_targets'] += 1
        ay = p.get('air_yards')
        if ay is not None:
            teams[team]['total_air_yards'] += ay
        yl = p.get('yardline_100')
        if yl is not None and yl <= 20:
            teams[team]['rz_pass_attempts'] += 1
    return teams


def _most_common(items: List[str]) -> str:
    """Return the most common non-None item, or empty string."""
    filtered = [i for i in items if i]
    if not filtered:
        return ''
    return Counter(filtered).most_common(1)[0][0]


def build_receiver_profiles(plays: List[Dict]) -> Dict[str, Dict[str, Any]]:
    """Build a dict of receiver profiles keyed by player name.

    Takes the full play list (all play types). Filters internally to pass plays
    with a receiver_player_name. Returns profiles with opportunity, efficiency,
    role, consistency, and context metrics.
    """
    passes = pass_plays(plays)
    team_totals = _team_pass_totals(passes)

    # Collect per-receiver play lists
    receiver_plays = {}  # type: Dict[str, List[Dict]]
    for p in passes:
        name = p.get('receiver_player_name')
        if not name:
            continue
        receiver_plays.setdefault(name, []).append(p)

    profiles = {}  # type: Dict[str, Dict[str, Any]]

    for name, rplays in receiver_plays.items():
        # --- Tier 1: Opportunity ---
        targets = len(rplays)
        completions = [p for p in rplays if p.get('complete_pass')]
        receptions = len(completions)
        catch_rate = safe_div(receptions, targets)

        air_yards_vals = [p['air_yards'] for p in rplays if p.get('air_yards') is not None]
        air_yards_total = sum(air_yards_vals)

        # Team context
        teams_seen = [p.get('posteam') for p in rplays]
        team = _most_common(teams_seen)
        tt = team_totals.get(team, {})
        team_targets = tt.get('total_targets', 0)
        team_air_yards = tt.get('total_air_yards', 0.0)

        target_share = safe_div(targets, team_targets)
        air_yards_share = safe_div(air_yards_total, team_air_yards)
        wopr = safe_div(1.5 * target_share + 0.7 * air_yards_share, 2.2)

        # --- Tier 2: Efficiency ---
        epa_vals = [p['epa'] for p in rplays if p.get('epa') is not None]
        epa_per_target = mean(epa_vals)

        rec_yards_vals = [p.get('yards_gained', 0) or 0 for p in completions]
        total_rec_yards = sum(p.get('yards_gained', 0) or 0 for p in completions)
        yards_per_target = safe_div(total_rec_yards, targets)

        adot = mean(air_yards_vals)

        yac_vals = [p['yards_after_catch'] for p in completions if p.get('yards_after_catch') is not None]
        yac_per_reception = mean(yac_vals)

        racr = safe_div(total_rec_yards, air_yards_total) if air_yards_total > 0 else 0.0

        # --- Role Profile ---
        deep = [p for p in rplays if p.get('pass_length') == 'deep']
        short = [p for p in rplays if p.get('pass_length') == 'short']
        deep_target_rate = safe_div(len(deep), targets)
        deep_epa_vals = [p['epa'] for p in deep if p.get('epa') is not None]
        deep_target_epa = mean(deep_epa_vals)
        short_target_rate = safe_div(len(short), targets)

        # Location distribution
        loc_counts = Counter(p.get('pass_location') for p in rplays if p.get('pass_location'))
        loc_total = sum(loc_counts.values())
        location_distribution = {
            'left': safe_div(loc_counts.get('left', 0), loc_total),
            'middle': safe_div(loc_counts.get('middle', 0), loc_total),
            'right': safe_div(loc_counts.get('right', 0), loc_total),
        }

        # --- Consistency ---
        by_week = {}  # type: Dict[int, List[Dict]]
        for p in rplays:
            w = p.get('week')
            if w is not None:
                by_week.setdefault(w, []).append(p)

        weekly_targets = [len(wp) for w, wp in sorted(by_week.items())]
        weekly_epa = [
            mean([p['epa'] for p in wp if p.get('epa') is not None])
            for w, wp in sorted(by_week.items())
        ]

        target_consistency = stdev(weekly_targets) if weekly_targets else 0.0
        mean_weekly_epa = mean(weekly_epa) if weekly_epa else 0.0
        std_weekly_epa = stdev(weekly_epa) if weekly_epa else 0.0
        if abs(mean_weekly_epa) > 0:
            raw_consistency = 1.0 - (std_weekly_epa / abs(mean_weekly_epa))
        else:
            raw_consistency = 0.0
        consistency_score = max(0.0, min(1.0, raw_consistency))

        # --- Context ---
        rz_plays = [p for p in rplays
                     if p.get('yardline_100') is not None and p['yardline_100'] <= 20]
        red_zone_targets = len(rz_plays)
        team_rz = tt.get('rz_pass_attempts', 0)
        red_zone_target_share = safe_div(red_zone_targets, team_rz)

        third_down_targets = len([p for p in rplays if p.get('down') == 3])

        qbs_seen = [p.get('passer_player_name') for p in rplays]
        qb = _most_common(qbs_seen)

        profiles[name] = {
            # Tier 1
            'targets': targets,
            'target_share': round(target_share, 4),
            'receptions': receptions,
            'catch_rate': round(catch_rate, 4),
            'air_yards_total': round(air_yards_total, 1),
            'air_yards_share': round(air_yards_share, 4),
            'wopr': round(wopr, 4),
            # Tier 2
            'epa_per_target': round(epa_per_target, 4),
            'yards_per_target': round(yards_per_target, 2),
            'adot': round(adot, 2),
            'yac_per_reception': round(yac_per_reception, 2),
            'racr': round(racr, 4),
            # Role
            'deep_target_rate': round(deep_target_rate, 4),
            'deep_target_epa': round(deep_target_epa, 4),
            'short_target_rate': round(short_target_rate, 4),
            'location_distribution': {
                k: round(v, 4) for k, v in location_distribution.items()
            },
            # Consistency
            'weekly_targets': weekly_targets,
            'weekly_epa': [round(v, 4) for v in weekly_epa],
            'target_consistency': round(target_consistency, 2),
            'consistency_score': round(consistency_score, 4),
            # Context
            'red_zone_targets': red_zone_targets,
            'red_zone_target_share': round(red_zone_target_share, 4),
            'third_down_targets': third_down_targets,
            'team': team,
            'qb': qb,
        }

    return profiles


def receiver_rankings(
    profiles: Dict[str, Dict[str, Any]],
    min_targets: int = 50,
) -> List[Tuple[str, float, Dict[str, Any]]]:
    """Rank receivers by composite score.

    composite = (target_share * 100) + (wopr * 50) + (epa_per_target * 20)
                + (consistency_score * 15) + (adot * 0.5)

    Returns list of (name, composite, profile) sorted descending.
    """
    ranked = []
    for name, prof in profiles.items():
        if prof['targets'] < min_targets:
            continue
        composite = (
            prof['target_share'] * 100
            + prof['wopr'] * 50
            + prof['epa_per_target'] * 20
            + prof['consistency_score'] * 15
            + prof['adot'] * 0.5
        )
        ranked.append((name, round(composite, 4), prof))
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked


def save_receiver_profiles(
    profiles: Dict[str, Dict[str, Any]],
    path: Optional[str] = None,
) -> str:
    """Write profiles dict to JSON. Returns the path written."""
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '..', 'data', 'receiver_profiles.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(profiles, f, indent=2)
    return path


if __name__ == '__main__':
    print('Loading play-by-play data...')
    all_plays = load_plays(seasons=[2024, 2025])
    print(f'  {len(all_plays):,} total plays loaded')

    print('Building receiver profiles...')
    profiles = build_receiver_profiles(all_plays)
    print(f'  {len(profiles)} receivers profiled')

    print('\nRanking receivers (min 50 targets)...')
    rankings = receiver_rankings(profiles, min_targets=50)

    print(f'\n{"#":>3}  {"Player":<24} {"Comp":>7}  {"Tgt":>4} {"TgtShr":>6} {"WOPR":>6} '
          f'{"EPA/T":>7} {"ADOT":>5} {"CatchR":>6} {"RACR":>6} {"Cons":>5} {"Team":<4} {"QB":<20}')
    print('-' * 125)

    for i, (name, composite, p) in enumerate(rankings[:30], 1):
        print(f'{i:>3}  {name:<24} {composite:>7.2f}  {p["targets"]:>4} '
              f'{p["target_share"]:>6.3f} {p["wopr"]:>6.3f} '
              f'{p["epa_per_target"]:>7.3f} {p["adot"]:>5.1f} '
              f'{p["catch_rate"]:>6.3f} {p["racr"]:>6.3f} '
              f'{p["consistency_score"]:>5.2f} {p["team"]:<4} {p["qb"]:<20}')

    out_path = save_receiver_profiles(profiles)
    print(f'\nProfiles saved to {out_path}')
