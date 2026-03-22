"""qb_profile.py — Build predictive QB profiles from nflfastR play-by-play data.

Analyzes pass plays to produce per-QB profiles covering EPA efficiency,
throw complexity, pressure performance, situational splits, consistency,
and system dependency. Composite scoring weights metrics by predictive power.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from analysis.loader import load_plays, mean, pass_plays, safe_div, stdev

MIN_PASS_ATTEMPTS = 100


def _qb_pass_plays(passes: List[Dict], qb_name: str) -> List[Dict]:
    """Filter pass plays to a single QB by passer_player_name."""
    return [p for p in passes if p.get('passer_player_name') == qb_name]


def _weekly_epa(qb_plays: List[Dict]) -> List[float]:
    """Compute per-week mean EPA for a QB's pass plays."""
    by_week = {}  # type: Dict[int, List[float]]
    for p in qb_plays:
        w = p.get('week')
        epa = p.get('epa')
        if w is not None and epa is not None:
            by_week.setdefault(w, []).append(epa)
    weeks_sorted = sorted(by_week.keys())
    return [mean(by_week[w]) for w in weeks_sorted]


def _build_single_profile(qb_plays: List[Dict]) -> Dict[str, Any]:
    """Build a full profile dict for one QB's pass plays."""

    # --- helpers to extract EPA/CPOE lists ---
    all_epa = [p['epa'] for p in qb_plays if p.get('epa') is not None]
    all_cpoe = [p['cpoe'] for p in qb_plays if p.get('cpoe') is not None]
    total_attempts = len(qb_plays)

    # --- Tier 1 Predictive Metrics ---
    epa_per_dropback = mean(all_epa)
    total_epa = sum(all_epa)
    cpoe = mean(all_cpoe)

    # --- Throw Complexity Profile ---
    deep_plays = [p for p in qb_plays if p.get('pass_length') == 'deep']
    short_plays = [p for p in qb_plays if p.get('pass_length') == 'short']

    deep_epa_vals = [p['epa'] for p in deep_plays if p.get('epa') is not None]
    deep_cpoe_vals = [p['cpoe'] for p in deep_plays if p.get('cpoe') is not None]
    short_epa_vals = [p['epa'] for p in short_plays if p.get('epa') is not None]

    deep_ball_rate = safe_div(len(deep_plays), total_attempts)
    deep_ball_epa = mean(deep_epa_vals)
    deep_ball_cpoe = mean(deep_cpoe_vals)
    short_pass_epa = mean(short_epa_vals)

    # Pass location distribution (field vision)
    loc_counts = {'left': 0, 'middle': 0, 'right': 0}
    for p in qb_plays:
        loc = p.get('pass_location')
        if loc in loc_counts:
            loc_counts[loc] += 1
    loc_total = sum(loc_counts.values())
    pass_location_distribution = {
        k: round(safe_div(v, loc_total), 3) for k, v in loc_counts.items()
    }

    # --- Pressure Performance ---
    pressure_plays = [p for p in qb_plays if p.get('qb_hit') is True]
    clean_plays = [p for p in qb_plays if not p.get('qb_hit')]

    pressure_epa_vals = [p['epa'] for p in pressure_plays if p.get('epa') is not None]
    clean_epa_vals = [p['epa'] for p in clean_plays if p.get('epa') is not None]

    pressure_epa = mean(pressure_epa_vals)
    clean_epa = mean(clean_epa_vals)
    pressure_delta = clean_epa - pressure_epa

    # Sack rate: sacks / (pass_attempts + sacks)
    # In nflfastR, sacks are separate from pass plays (play_type != 'pass'),
    # but the passer_player_name is still populated on sack plays.
    # Since pass_plays() filters to play_type == 'pass', sacks are excluded.
    # We count sacks from the qb_plays where sack == True (should be 0 here
    # since loader filters them out). We'll compute sack_rate as 0 and note
    # it needs the full play set. This gets patched in build_qb_profiles().
    sack_rate = 0.0  # placeholder — patched by build_qb_profiles

    # --- Situational ---
    third_down = [p for p in qb_plays if p.get('down') == 3]
    third_epa_vals = [p['epa'] for p in third_down if p.get('epa') is not None]
    third_completions = sum(1 for p in third_down if p.get('complete_pass'))
    third_down_epa = mean(third_epa_vals)
    third_down_conversion_rate = safe_div(third_completions, len(third_down))

    red_zone = [p for p in qb_plays if (p.get('yardline_100') or 100) <= 20]
    rz_epa_vals = [p['epa'] for p in red_zone if p.get('epa') is not None]
    red_zone_epa = mean(rz_epa_vals)

    shotgun_plays = [p for p in qb_plays if p.get('shotgun') is True]
    under_center = [p for p in qb_plays if not p.get('shotgun')]
    shotgun_rate = safe_div(len(shotgun_plays), total_attempts)
    shotgun_epa_val = mean([p['epa'] for p in shotgun_plays if p.get('epa') is not None])
    under_center_epa = mean([p['epa'] for p in under_center if p.get('epa') is not None])

    # --- Consistency ---
    weekly = _weekly_epa(qb_plays)
    weekly_var = stdev(weekly)
    m = mean(weekly)
    if m > 0 and weekly_var > 0:
        consistency_score = max(0.0, min(1.0, 1.0 - (weekly_var / m)))
    else:
        consistency_score = 0.0

    boom_rate = safe_div(sum(1 for w in weekly if w > 0.15), len(weekly))
    bust_rate = safe_div(sum(1 for w in weekly if w < -0.10), len(weekly))

    # --- System Dependency ---
    # play_action_rate: nflfastR does not have a direct play_action column
    # in the standard USED_COLUMNS. Marking as unavailable.
    play_action_rate = None  # type: Optional[float]

    # screen proxy: short passes to the middle
    screen_proxy = [
        p for p in qb_plays
        if p.get('pass_length') == 'short' and p.get('pass_location') == 'middle'
    ]
    screen_epa = mean([p['epa'] for p in screen_proxy if p.get('epa') is not None])

    return {
        # Tier 1
        'epa_per_dropback': round(epa_per_dropback, 4),
        'total_epa': round(total_epa, 2),
        'pass_attempts': total_attempts,
        'cpoe': round(cpoe, 3),
        # Throw Complexity
        'deep_ball_rate': round(deep_ball_rate, 4),
        'deep_ball_epa': round(deep_ball_epa, 4),
        'deep_ball_cpoe': round(deep_ball_cpoe, 3),
        'short_pass_epa': round(short_pass_epa, 4),
        'pass_location_distribution': pass_location_distribution,
        # Pressure
        'pressure_epa': round(pressure_epa, 4),
        'clean_epa': round(clean_epa, 4),
        'pressure_delta': round(pressure_delta, 4),
        'sack_rate': round(sack_rate, 4),
        # Situational
        'third_down_epa': round(third_down_epa, 4),
        'third_down_conversion_rate': round(third_down_conversion_rate, 4),
        'red_zone_epa': round(red_zone_epa, 4),
        'shotgun_rate': round(shotgun_rate, 4),
        'shotgun_epa': round(shotgun_epa_val, 4),
        'under_center_epa': round(under_center_epa, 4),
        # Consistency
        'weekly_epa': [round(w, 4) for w in weekly],
        'weekly_epa_variance': round(weekly_var, 4),
        'consistency_score': round(consistency_score, 4),
        'boom_rate': round(boom_rate, 4),
        'bust_rate': round(bust_rate, 4),
        # System Dependency
        'play_action_rate': play_action_rate,
        'screen_epa': round(screen_epa, 4),
    }


def build_qb_profiles(plays: List[Dict]) -> Dict[str, Dict[str, Any]]:
    """Build profiles for all QBs with >= MIN_PASS_ATTEMPTS pass attempts.

    Args:
        plays: Full play-by-play dataset (all play types).

    Returns:
        Dict keyed by QB name, values are profile dicts.
    """
    passes = pass_plays(plays)

    # Collect unique QB names and their pass play counts
    qb_counts = {}  # type: Dict[str, int]
    for p in passes:
        name = p.get('passer_player_name')
        if name:
            qb_counts[name] = qb_counts.get(name, 0) + 1

    # Count sacks per QB from the full play set (sacks have play_type != 'pass')
    qb_sacks = {}  # type: Dict[str, int]
    for p in plays:
        if p.get('sack'):
            name = p.get('passer_player_name')
            if name:
                qb_sacks[name] = qb_sacks.get(name, 0) + 1

    profiles = {}  # type: Dict[str, Dict[str, Any]]
    for qb_name, count in qb_counts.items():
        if count < MIN_PASS_ATTEMPTS:
            continue
        qb_plays = _qb_pass_plays(passes, qb_name)
        profile = _build_single_profile(qb_plays)

        # Patch sack rate with full-dataset sack counts
        sacks = qb_sacks.get(qb_name, 0)
        profile['sack_rate'] = round(
            safe_div(sacks, count + sacks), 4
        )

        profiles[qb_name] = profile

    return profiles


def qb_rankings(profiles: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rank QBs by composite score weighted toward predictive metrics.

    composite = (epa_per_dropback * 40) + (cpoe * 0.3) +
                (consistency_score * 20) + (deep_ball_epa * 10) -
                (pressure_delta * 5)
    """
    ranked = []
    for name, p in profiles.items():
        composite = (
            p['epa_per_dropback'] * 40
            + p['cpoe'] * 0.3
            + p['consistency_score'] * 20
            + p['deep_ball_epa'] * 10
            - p['pressure_delta'] * 5
        )
        ranked.append({
            'name': name,
            'composite': round(composite, 3),
            'epa_per_dropback': p['epa_per_dropback'],
            'cpoe': p['cpoe'],
            'consistency_score': p['consistency_score'],
            'deep_ball_epa': p['deep_ball_epa'],
            'pressure_delta': p['pressure_delta'],
            'pass_attempts': p['pass_attempts'],
        })
    ranked.sort(key=lambda x: x['composite'], reverse=True)
    return ranked


def save_qb_profiles(
    profiles: Dict[str, Dict[str, Any]],
    path: Optional[str] = None,
) -> str:
    """Write QB profiles to a JSON file.

    Args:
        profiles: Dict of QB profiles from build_qb_profiles().
        path: Output file path. Defaults to data/qb_profiles.json.

    Returns:
        The absolute path of the written file.
    """
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '..', 'data', 'qb_profiles.json')
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(profiles, f, indent=2, default=str)
    return path


if __name__ == '__main__':
    print('Loading play-by-play data...')
    all_plays = load_plays(seasons=[2024, 2025])
    print(f'  {len(all_plays):,} total plays loaded.')

    print('Building QB profiles (min {0} attempts)...'.format(MIN_PASS_ATTEMPTS))
    profiles = build_qb_profiles(all_plays)
    print(f'  {len(profiles)} QBs qualified.\n')

    rankings = qb_rankings(profiles)

    print('=' * 78)
    print(f'{"Rank":<5} {"QB":<22} {"Comp":>7} {"EPA/DB":>8} {"CPOE":>7} '
          f'{"Consist":>8} {"DeepEPA":>8} {"PrDelta":>8} {"Att":>5}')
    print('-' * 78)
    for i, r in enumerate(rankings[:20], 1):
        print(f'{i:<5} {r["name"]:<22} {r["composite"]:>7.3f} '
              f'{r["epa_per_dropback"]:>8.4f} {r["cpoe"]:>7.3f} '
              f'{r["consistency_score"]:>8.4f} {r["deep_ball_epa"]:>8.4f} '
              f'{r["pressure_delta"]:>8.4f} {r["pass_attempts"]:>5}')
    print('=' * 78)

    out_path = save_qb_profiles(profiles)
    print(f'\nProfiles saved to {out_path}')
