"""coordinator_profile.py — Team-level coordinator scheme profiles from nflfastR.

Analyzes play-calling tendencies (PROE, personnel, tempo, target distribution)
to classify offensive schemes and flag fantasy-relevant impacts per position.
"""
from __future__ import annotations

import json
import os
from collections import defaultdict
from typing import Any, Dict, List, Set

from analysis.loader import (
    load_plays,
    mean,
    pass_plays,
    rush_plays,
    safe_div,
    stdev,
)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _team_plays(plays: List[Dict], team: str) -> List[Dict]:
    """All offensive plays for a team (pass or run only)."""
    return [
        p for p in plays
        if p.get('posteam') == team
        and p.get('play_type') in ('pass', 'run')
    ]


def _identify_rbs(team_all: List[Dict]) -> Set[str]:
    """Heuristic: players with 10+ rush attempts who are NOT the primary passer.

    Excludes QBs (who show up on designed runs) and WRs/TEs with occasional
    jet sweeps or end-arounds. Threshold of 10 carries filters gadget usage.
    """
    rush_counts: Dict[str, int] = defaultdict(int)
    pass_counts: Dict[str, int] = defaultdict(int)
    for p in team_all:
        if p.get('play_type') == 'run' and p.get('rusher_player_name'):
            rush_counts[p['rusher_player_name']] += 1
        if p.get('play_type') == 'pass' and p.get('passer_player_name'):
            pass_counts[p['passer_player_name']] += 1

    # primary passer is whoever threw the most passes
    primary_qb = max(pass_counts, key=pass_counts.get) if pass_counts else None

    rushers: Set[str] = set()
    for name, count in rush_counts.items():
        if count >= 10 and name != primary_qb:
            rushers.add(name)
    return rushers


# ---------------------------------------------------------------------------
# core builder
# ---------------------------------------------------------------------------

def build_team_profiles(plays: List[Dict]) -> Dict[str, Dict[str, Any]]:
    """Build coordinator scheme profiles keyed by team abbreviation."""
    profiles: Dict[str, Dict[str, Any]] = {}

    # pre-collect teams
    teams: Set[str] = set()
    for p in plays:
        t = p.get('posteam')
        if t and p.get('play_type') in ('pass', 'run'):
            teams.add(t)

    for team in sorted(teams):
        tp = _team_plays(plays, team)
        if not tp:
            continue

        passes = [p for p in tp if p.get('play_type') == 'pass']
        rushes = [p for p in tp if p.get('play_type') == 'run']

        total = len(tp)
        n_pass = len(passes)
        n_rush = len(rushes)

        # --- game-level grouping ---
        games: Dict[str, List[Dict]] = defaultdict(list)
        for p in tp:
            gid = p.get('game_id')
            if gid:
                games[gid].append(p)
        n_games = max(len(games), 1)

        # --- Pass / Run tendency ---
        pass_rate = safe_div(n_pass, total)
        rush_rate = safe_div(n_rush, total)

        # PROE proxy: mean xpass tells us expected pass rate; compare to actual
        xpass_vals = [p['xpass'] for p in tp if p.get('xpass') is not None]
        expected_pass_rate = mean(xpass_vals) if xpass_vals else pass_rate
        proe = pass_rate - expected_pass_rate

        # Neutral-script pass rate (score_diff between -7 and +7)
        neutral = [
            p for p in tp
            if p.get('score_differential') is not None
            and -7 <= p['score_differential'] <= 7
        ]
        neutral_passes = [p for p in neutral if p.get('play_type') == 'pass']
        neutral_pass_rate = safe_div(len(neutral_passes), len(neutral)) if neutral else 0.0

        # --- Passing scheme ---
        deep = [p for p in passes if p.get('pass_length') == 'deep']
        short = [p for p in passes if p.get('pass_length') == 'short']
        passes_with_length = [p for p in passes if p.get('pass_length') in ('deep', 'short')]
        deep_pass_rate = safe_div(len(deep), len(passes_with_length)) if passes_with_length else 0.0
        short_pass_rate = safe_div(len(short), len(passes_with_length)) if passes_with_length else 0.0

        air_yards_vals = [p['air_yards'] for p in passes if p.get('air_yards') is not None]
        mean_air_yards = mean(air_yards_vals)

        shotgun_plays = [p for p in tp if p.get('shotgun') is True]
        shotgun_rate = safe_div(len(shotgun_plays), total)

        # pass location breakdown
        loc_counts: Dict[str, int] = defaultdict(int)
        passes_with_loc = 0
        for p in passes:
            loc = p.get('pass_location')
            if loc in ('left', 'middle', 'right'):
                loc_counts[loc] += 1
                passes_with_loc += 1
        pass_location_tendency = {
            d: round(safe_div(loc_counts[d], passes_with_loc), 3)
            for d in ('left', 'middle', 'right')
        }

        epa_pass_vals = [p['epa'] for p in passes if p.get('epa') is not None]
        team_epa_per_pass = mean(epa_pass_vals)

        cpoe_vals = [p['cpoe'] for p in passes if p.get('cpoe') is not None]
        team_cpoe = mean(cpoe_vals)

        # --- Rushing scheme ---
        epa_rush_vals = [p['epa'] for p in rushes if p.get('epa') is not None]
        team_epa_per_rush = mean(epa_rush_vals)

        ypc_vals = [p['yards_gained'] for p in rushes if p.get('yards_gained') is not None]
        mean_yards_per_carry = mean(ypc_vals)

        # --- Tempo / Volume ---
        plays_per_game = safe_div(total, n_games)
        pass_per_game = safe_div(n_pass, n_games)

        # --- Target distribution ---
        target_counts: Dict[str, int] = defaultdict(int)
        for p in passes:
            recv = p.get('receiver_player_name')
            if recv:
                target_counts[recv] += 1
        total_targets = sum(target_counts.values()) or 1

        sorted_targets = sorted(target_counts.values(), reverse=True)
        top_target_share = safe_div(sorted_targets[0], total_targets) if sorted_targets else 0.0
        top3 = sum(sorted_targets[:3])
        target_concentration = safe_div(top3, total_targets)

        # RB target share
        rbs = _identify_rbs(tp)
        rb_targets = sum(c for name, c in target_counts.items() if name in rbs)
        rb_target_share = safe_div(rb_targets, total_targets)

        # --- Efficiency ---
        epa_all = [p['epa'] for p in tp if p.get('epa') is not None]
        team_epa_per_play = mean(epa_all)

        rz = [p for p in tp if p.get('yardline_100') is not None and p['yardline_100'] <= 20]
        rz_passes = [p for p in rz if p.get('play_type') == 'pass']
        red_zone_pass_rate = safe_div(len(rz_passes), len(rz)) if rz else 0.0

        third = [p for p in tp if p.get('down') == 3]
        third_passes = [p for p in third if p.get('play_type') == 'pass']
        third_down_pass_rate = safe_div(len(third_passes), len(third)) if third else 0.0

        # --- Weekly consistency ---
        weekly_games: Dict[int, List[Dict]] = defaultdict(list)
        for p in tp:
            w = p.get('week')
            if w is not None:
                weekly_games[w].append(p)

        weekly_epa: List[float] = []
        weekly_pass_rate: List[float] = []
        for w in sorted(weekly_games):
            wplays = weekly_games[w]
            w_epa_vals = [p['epa'] for p in wplays if p.get('epa') is not None]
            weekly_epa.append(mean(w_epa_vals))
            w_passes = [p for p in wplays if p.get('play_type') == 'pass']
            weekly_pass_rate.append(safe_div(len(w_passes), len(wplays)))

        scheme_consistency = stdev(weekly_pass_rate)

        profiles[team] = {
            # pass/run tendency
            'total_plays': total,
            'pass_rate': round(pass_rate, 3),
            'rush_rate': round(rush_rate, 3),
            'pass_rate_over_expected': round(proe, 4),
            'neutral_pass_rate': round(neutral_pass_rate, 3),
            # passing scheme
            'deep_pass_rate': round(deep_pass_rate, 3),
            'short_pass_rate': round(short_pass_rate, 3),
            'mean_air_yards': round(mean_air_yards, 2),
            'shotgun_rate': round(shotgun_rate, 3),
            'pass_location_tendency': pass_location_tendency,
            'team_epa_per_pass': round(team_epa_per_pass, 4),
            'team_cpoe': round(team_cpoe, 3),
            # rushing scheme
            'team_epa_per_rush': round(team_epa_per_rush, 4),
            'mean_yards_per_carry': round(mean_yards_per_carry, 2),
            # tempo / volume
            'plays_per_game': round(plays_per_game, 1),
            'pass_attempts_per_game': round(pass_per_game, 1),
            # target distribution
            'top_target_share': round(top_target_share, 3),
            'target_concentration': round(target_concentration, 3),
            'rb_target_share': round(rb_target_share, 3),
            # efficiency
            'team_epa_per_play': round(team_epa_per_play, 4),
            'red_zone_pass_rate': round(red_zone_pass_rate, 3),
            'third_down_pass_rate': round(third_down_pass_rate, 3),
            # weekly consistency
            'weekly_epa': [round(v, 4) for v in weekly_epa],
            'weekly_pass_rate': [round(v, 3) for v in weekly_pass_rate],
            'scheme_consistency': round(scheme_consistency, 4),
        }

    return profiles


# ---------------------------------------------------------------------------
# classifiers
# ---------------------------------------------------------------------------

def classify_scheme(profile: Dict[str, Any]) -> str:
    """Classify offensive scheme from coordinator tendencies."""
    npr = profile.get('neutral_pass_rate', 0)
    dpr = profile.get('deep_pass_rate', 0)
    may = profile.get('mean_air_yards', 0)
    sgr = profile.get('shotgun_rate', 0)
    rr = profile.get('rush_rate', 0)

    if npr > 0.58 and dpr > 0.18:
        return 'Air Raid'
    if npr > 0.55 and may < 7.5:
        return 'West Coast'
    if sgr > 0.55 and rr > 0.42:
        return 'Shanahan Zone'
    if sgr < 0.50 and rr > 0.45:
        return 'Pro-Style Heavy'
    return 'Balanced'


def fantasy_impact(profile: Dict[str, Any]) -> Dict[str, bool]:
    """Flag which fantasy positions benefit from this scheme."""
    return {
        'qb_boost': profile.get('plays_per_game', 0) > 65
                     and profile.get('pass_rate', 0) > 0.55,
        'wr1_boost': profile.get('top_target_share', 0) > 0.25,
        'rb_receiving_boost': profile.get('rb_target_share', 0) > 0.20,
        'te_boost': profile.get('target_concentration', 1) < 0.55,
        'rb_rush_boost': profile.get('rush_rate', 0) > 0.45
                         and profile.get('team_epa_per_rush', -1) > 0,
    }


# ---------------------------------------------------------------------------
# save + main
# ---------------------------------------------------------------------------

def save_profiles(profiles: Dict[str, Dict], path: str) -> None:
    """Persist profiles to JSON."""
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Attach scheme and fantasy impact before saving
    enriched: Dict[str, Any] = {}
    for team, prof in profiles.items():
        enriched[team] = dict(prof)
        enriched[team]['scheme'] = classify_scheme(prof)
        enriched[team]['fantasy_impact'] = fantasy_impact(prof)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(enriched, f, indent=2)
    print(f"Saved {len(enriched)} team profiles to {path}")


def main() -> None:
    print("Loading play-by-play data ...")
    plays = load_plays(seasons=[2024, 2025])
    print(f"  {len(plays)} total rows loaded")

    all_plays = pass_plays(plays) + rush_plays(plays)
    print(f"  {len(all_plays)} pass + rush plays")

    print("\nBuilding team profiles ...")
    profiles = build_team_profiles(all_plays)
    print(f"  {len(profiles)} teams profiled\n")

    # Print summary table
    header = f"{'Team':<5} {'Scheme':<18} {'Pass%':>6} {'NPR':>6} {'Deep%':>6} " \
             f"{'AvgAY':>6} {'SG%':>5} {'PPG':>5} {'EPA/P':>7} {'Consist':>8}  Fantasy Boosts"
    print(header)
    print('-' * len(header) + '----------')

    for team in sorted(profiles):
        p = profiles[team]
        scheme = classify_scheme(p)
        fi = fantasy_impact(p)
        boosts = ', '.join(k.replace('_boost', '').upper()
                           for k, v in fi.items() if v)
        print(
            f"{team:<5} {scheme:<18} "
            f"{p['pass_rate']:>5.1%} {p['neutral_pass_rate']:>5.1%} "
            f"{p['deep_pass_rate']:>5.1%} {p['mean_air_yards']:>6.2f} "
            f"{p['shotgun_rate']:>4.1%} {p['plays_per_game']:>5.1f} "
            f"{p['team_epa_per_play']:>+7.4f} {p['scheme_consistency']:>8.4f}  "
            f"{boosts or '(none)'}"
        )

    # Save
    out_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'team_profiles.json')
    save_profiles(profiles, out_path)


if __name__ == '__main__':
    main()
