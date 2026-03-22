"""rb_profile.py — Analyze RB play-by-play data from nflfastR.

Builds comprehensive RB profiles from rushing AND receiving data.
Research shows receiving work predicts RB fantasy success better than
rushing efficiency alone. Weighted opportunities (R^2=0.82) is the
single most predictive RB metric.
"""
from __future__ import annotations

import json
import os
from collections import Counter
from typing import Dict, List, Optional, Tuple

from analysis.loader import (
    load_plays,
    mean,
    pass_plays,
    rush_plays,
    safe_div,
    stdev,
)


def _rb_rush_plays(plays: List[Dict]) -> Dict[str, List[Dict]]:
    """Group rush plays by rusher_player_name."""
    rushes = rush_plays(plays)
    by_rb = {}  # type: Dict[str, List[Dict]]
    for p in rushes:
        name = p.get('rusher_player_name')
        if name:
            by_rb.setdefault(name, []).append(p)
    return by_rb


def _rb_receiving_plays(plays: List[Dict]) -> Dict[str, List[Dict]]:
    """Group pass plays by receiver_player_name (for RB targets)."""
    passes = pass_plays(plays)
    by_rb = {}  # type: Dict[str, List[Dict]]
    for p in passes:
        name = p.get('receiver_player_name')
        if name:
            by_rb.setdefault(name, []).append(p)
    return by_rb


def _team_goal_line_rushes(plays: List[Dict]) -> Dict[str, int]:
    """Count goal-line rush attempts (yardline_100 <= 5) per team."""
    counts = {}  # type: Dict[str, int]
    for p in rush_plays(plays):
        yl = p.get('yardline_100')
        team = p.get('posteam')
        if yl is not None and yl <= 5 and team:
            counts[team] = counts.get(team, 0) + 1
    return counts


def _team_red_zone_touches(plays: List[Dict]) -> Dict[str, int]:
    """Count red-zone touches (rush + target, yardline_100 <= 20) per team."""
    counts = {}  # type: Dict[str, int]
    for p in plays:
        yl = p.get('yardline_100')
        team = p.get('posteam')
        if yl is None or yl > 20 or not team:
            continue
        if p.get('play_type') == 'run' and p.get('rusher_player_name'):
            counts[team] = counts.get(team, 0) + 1
        elif p.get('play_type') == 'pass' and p.get('receiver_player_name'):
            counts[team] = counts.get(team, 0) + 1
    return counts


def _team_total_plays(plays: List[Dict]) -> Dict[str, int]:
    """Count total offensive plays per team (for snap share proxy)."""
    counts = {}  # type: Dict[str, int]
    for p in plays:
        team = p.get('posteam')
        pt = p.get('play_type')
        if team and pt in ('run', 'pass'):
            counts[team] = counts.get(team, 0) + 1
    return counts


def build_rb_profiles(plays: List[Dict]) -> Dict[str, Dict]:
    """Build comprehensive RB profiles from play-by-play data.

    Analyzes both rush and receiving plays. Returns a dict keyed by
    player name with full statistical profiles.
    """
    rush_by_rb = _rb_rush_plays(plays)
    recv_by_rb = _rb_receiving_plays(plays)
    team_gl_rushes = _team_goal_line_rushes(plays)
    team_rz_touches = _team_red_zone_touches(plays)
    team_plays = _team_total_plays(plays)

    # Union of all RB names appearing in either rushing or receiving
    all_rbs = set(rush_by_rb.keys()) | set(recv_by_rb.keys())

    profiles = {}  # type: Dict[str, Dict]

    for name in all_rbs:
        r_plays = rush_by_rb.get(name, [])
        c_plays = recv_by_rb.get(name, [])

        # --- Tier 1 Predictive ---
        rush_attempts = len(r_plays)
        targets = len(c_plays)
        receptions = sum(1 for p in c_plays if p.get('complete_pass'))
        weighted_opportunities = rush_attempts + (targets * 1.5)
        total_touches = rush_attempts + receptions
        receiving_work_rate = safe_div(targets, rush_attempts + targets)

        # --- Rushing Profile ---
        rush_epas = [p['epa'] for p in r_plays if p.get('epa') is not None]
        rush_epa = mean(rush_epas)
        rush_yards_list = [p.get('yards_gained', 0) or 0 for p in r_plays]
        total_rush_yards = sum(rush_yards_list)
        yards_per_carry = safe_div(total_rush_yards, rush_attempts)
        negative_plays = sum(1 for y in rush_yards_list if y < 0) if rush_attempts > 0 else 0
        negative_play_rate = safe_div(negative_plays, rush_attempts)
        explosive_runs = sum(1 for y in rush_yards_list if y >= 10) if rush_attempts > 0 else 0
        explosive_run_rate = safe_div(explosive_runs, rush_attempts)

        # --- Receiving Profile ---
        rec_epas = [p['epa'] for p in c_plays if p.get('epa') is not None]
        rec_epa = mean(rec_epas)
        rec_yards_list = [p.get('yards_gained', 0) or 0 for p in c_plays]
        rec_yards = sum(rec_yards_list)
        rec_yards_per_target = safe_div(rec_yards, targets)
        catch_rate = safe_div(receptions, targets)

        # --- Team context ---
        all_player_plays = r_plays + c_plays
        team_counter = Counter(p.get('posteam') for p in all_player_plays if p.get('posteam'))
        team = team_counter.most_common(1)[0][0] if team_counter else 'UNK'

        # --- Goal Line / Red Zone ---
        # Per-team accounting so multi-team players don't exceed 1.0
        goal_line_carries = 0
        gl_by_team = {}  # type: Dict[str, int]
        for p in r_plays:
            yl = p.get('yardline_100')
            tm = p.get('posteam')
            if yl is not None and yl <= 5 and tm:
                goal_line_carries += 1
                gl_by_team[tm] = gl_by_team.get(tm, 0) + 1
        goal_line_share = sum(
            safe_div(cnt, team_gl_rushes.get(tm, 0))
            for tm, cnt in gl_by_team.items()
        )

        rz_by_team = {}  # type: Dict[str, int]
        red_zone_touches = 0
        for p in r_plays:
            yl = p.get('yardline_100')
            tm = p.get('posteam')
            if yl is not None and yl <= 20 and tm:
                red_zone_touches += 1
                rz_by_team[tm] = rz_by_team.get(tm, 0) + 1
        for p in c_plays:
            yl = p.get('yardline_100')
            tm = p.get('posteam')
            if yl is not None and yl <= 20 and tm:
                red_zone_touches += 1
                rz_by_team[tm] = rz_by_team.get(tm, 0) + 1
        red_zone_share = sum(
            safe_div(cnt, team_rz_touches.get(tm, 0))
            for tm, cnt in rz_by_team.items()
        )

        # --- Snap share proxy ---
        player_play_count = len(all_player_plays)
        snap_share_proxy = safe_div(player_play_count, team_plays.get(team, 0))

        # --- Weekly consistency ---
        week_touches = {}  # type: Dict[int, int]
        week_epas = {}  # type: Dict[int, float]

        for p in r_plays:
            w = p.get('week')
            if w is not None:
                week_touches[w] = week_touches.get(w, 0) + 1
                epa_val = p.get('epa')
                if epa_val is not None:
                    week_epas[w] = week_epas.get(w, 0.0) + epa_val

        for p in c_plays:
            w = p.get('week')
            if w is not None:
                if p.get('complete_pass'):
                    week_touches[w] = week_touches.get(w, 0) + 1
                epa_val = p.get('epa')
                if epa_val is not None:
                    week_epas[w] = week_epas.get(w, 0.0) + epa_val

        weeks_active = sorted(set(week_touches.keys()) | set(week_epas.keys()))
        weekly_touches = [week_touches.get(w, 0) for w in weeks_active]
        weekly_epa = [round(week_epas.get(w, 0.0), 4) for w in weeks_active]

        touch_consistency = stdev(weekly_touches) if weekly_touches else 0.0

        # Use per-touch EPA rate for consistency (raw sums scale with volume)
        # Scored as 1/(1+CV) so lower variance relative to mean -> higher score
        weekly_epa_rate = [
            safe_div(week_epas.get(w, 0.0), week_touches.get(w, 0))
            for w in weeks_active
            if week_touches.get(w, 0) > 0
        ]
        epa_rate_mean = mean(weekly_epa_rate)
        epa_rate_std = stdev(weekly_epa_rate)
        if abs(epa_rate_mean) > 0:
            cv = epa_rate_std / abs(epa_rate_mean)
            consistency_score = max(0.0, min(1.0, 1.0 / (1.0 + cv)))
        else:
            consistency_score = 0.0

        profiles[name] = {
            # Tier 1 Predictive
            'rush_attempts': rush_attempts,
            'targets': targets,
            'weighted_opportunities': round(weighted_opportunities, 1),
            'total_touches': total_touches,
            'receiving_work_rate': round(receiving_work_rate, 4),
            # Rushing Profile
            'rush_epa': round(rush_epa, 4),
            'total_rush_yards': total_rush_yards,
            'yards_per_carry': round(yards_per_carry, 2),
            'negative_play_rate': round(negative_play_rate, 4),
            'explosive_run_rate': round(explosive_run_rate, 4),
            # Receiving Profile
            'receptions': receptions,
            'rec_epa': round(rec_epa, 4),
            'rec_yards': rec_yards,
            'rec_yards_per_target': round(rec_yards_per_target, 2),
            'catch_rate': round(catch_rate, 4),
            # Goal Line / Red Zone
            'goal_line_carries': goal_line_carries,
            'goal_line_share': round(goal_line_share, 4),
            'red_zone_touches': red_zone_touches,
            'red_zone_share': round(red_zone_share, 4),
            # Consistency
            'weekly_touches': weekly_touches,
            'weekly_epa': weekly_epa,
            'touch_consistency': round(touch_consistency, 2),
            'consistency_score': round(consistency_score, 4),
            # Context
            'team': team,
            'snap_share_proxy': round(snap_share_proxy, 4),
        }

    return profiles


def rb_rankings(
    profiles: Dict[str, Dict],
    min_touches: int = 50,
) -> List[Tuple[str, float, Dict]]:
    """Rank RBs by composite score.

    composite = (weighted_opportunities * 0.5)
              + (receiving_work_rate * 30)
              + (rush_epa * 15)
              + (consistency_score * 15)
              + (goal_line_share * 20)

    Returns list of (name, composite, profile) sorted descending.
    """
    ranked = []  # type: List[Tuple[str, float, Dict]]
    for name, prof in profiles.items():
        if prof['total_touches'] < min_touches:
            continue
        composite = (
            prof['weighted_opportunities'] * 0.5
            + prof['receiving_work_rate'] * 30
            + prof['rush_epa'] * 15
            + prof['consistency_score'] * 15
            + prof['goal_line_share'] * 20
        )
        ranked.append((name, round(composite, 2), prof))
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked


def save_profiles(profiles: Dict[str, Dict], path: Optional[str] = None) -> str:
    """Save profiles to JSON file."""
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '..', 'data', 'rb_profiles.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(profiles, f, indent=2)
    return path


if __name__ == '__main__':
    print('Loading play-by-play data...')
    all_plays = load_plays(seasons=[2024, 2025])
    print(f'  {len(all_plays):,} plays loaded')

    print('Building RB profiles...')
    profiles = build_rb_profiles(all_plays)
    print(f'  {len(profiles)} RBs profiled')

    print('Ranking RBs (min 50 touches)...')
    ranked = rb_rankings(profiles)
    print(f'  {len(ranked)} qualify\n')

    # Print top 20
    print(f'{"Rank":<5} {"Player":<22} {"Team":<5} {"Composite":>9} '
          f'{"WtdOpp":>7} {"RecWR%":>7} {"RshEPA":>7} {"Consist":>7} '
          f'{"GL%":>7} {"Tch":>5} {"Tgt":>5} {"YPC":>5}')
    print('-' * 108)

    for i, (name, composite, prof) in enumerate(ranked[:20], 1):
        print(
            f'{i:<5} {name:<22} {prof["team"]:<5} {composite:>9.2f} '
            f'{prof["weighted_opportunities"]:>7.1f} '
            f'{prof["receiving_work_rate"] * 100:>6.1f}% '
            f'{prof["rush_epa"]:>7.4f} '
            f'{prof["consistency_score"]:>7.4f} '
            f'{prof["goal_line_share"] * 100:>6.1f}% '
            f'{prof["total_touches"]:>5} '
            f'{prof["targets"]:>5} '
            f'{prof["yards_per_carry"]:>5.1f}'
        )

    # Save
    out_path = save_profiles(profiles)
    print(f'\nSaved {len(profiles)} RB profiles to {out_path}')
