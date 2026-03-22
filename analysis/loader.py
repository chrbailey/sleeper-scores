"""loader.py — Load and prepare nflfastR play-by-play data for analysis.

Shared by all position-specific analysis modules. Handles CSV loading,
type conversion, and common filters.
"""
from __future__ import annotations
import csv
import os
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DATA_PATH = os.path.join(DATA_DIR, 'pbp_2024.csv')
DATA_PATHS = {
    2024: os.path.join(DATA_DIR, 'pbp_2024.csv'),
    2025: os.path.join(DATA_DIR, 'pbp_2025.csv'),
}

# Columns we actually use (skip the other 350+ to save memory)
USED_COLUMNS = {
    'play_id', 'game_id', 'week', 'posteam', 'defteam', 'play_type',
    'down', 'ydstogo', 'yardline_100', 'shotgun', 'no_huddle',
    'pass_attempt', 'rush_attempt', 'complete_pass', 'incomplete_pass',
    'interception', 'sack', 'qb_hit', 'qb_scramble',
    'passer_player_name', 'passer_player_id',
    'receiver_player_name', 'receiver_player_id',
    'rusher_player_name', 'rusher_player_id',
    'pass_length', 'pass_location', 'air_yards', 'yards_after_catch',
    'epa', 'cpoe', 'wp', 'wpa', 'score_differential',
    'td_player_name', 'fumble_lost', 'penalty',
    'yards_gained', 'xpass', 'pass_oe',
}

FLOAT_COLS = {'air_yards', 'yards_after_catch', 'epa', 'cpoe', 'wp', 'wpa',
              'score_differential', 'yards_gained', 'xpass', 'pass_oe'}
INT_COLS = {'down', 'ydstogo', 'yardline_100', 'week'}
BOOL_COLS = {'shotgun', 'no_huddle', 'pass_attempt', 'rush_attempt',
             'complete_pass', 'incomplete_pass', 'interception',
             'sack', 'qb_hit', 'qb_scramble', 'fumble_lost', 'penalty'}


def _convert(row: Dict[str, str]) -> Dict:
    """Convert string values to appropriate types."""
    out = {}
    for k, v in row.items():
        if k not in USED_COLUMNS:
            continue
        if v == '' or v == 'NA':
            out[k] = None
            continue
        if k in FLOAT_COLS:
            try:
                out[k] = float(v)
            except ValueError:
                out[k] = None
        elif k in INT_COLS:
            try:
                out[k] = int(float(v))
            except ValueError:
                out[k] = None
        elif k in BOOL_COLS:
            out[k] = v == '1' or v == 'TRUE' or v == 'True'
        else:
            out[k] = v
    return out


def load_plays(path: Optional[str] = None, seasons: Optional[List[int]] = None) -> List[Dict]:
    """Load plays from CSV(s). If seasons provided, loads multiple years."""
    if seasons:
        plays = []
        for year in seasons:
            p = DATA_PATHS.get(year)
            if p and os.path.exists(p):
                plays.extend(_load_single(p))
        return plays
    path = path or DATA_PATH
    return _load_single(path)


def _load_single(path: str) -> List[Dict]:
    """Load all plays from a single CSV."""
    plays = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            plays.append(_convert(row))
    return plays


def pass_plays(plays: List[Dict]) -> List[Dict]:
    """Filter to pass plays only (excludes sacks, scrambles counted separately)."""
    return [p for p in plays if p.get('play_type') == 'pass' and p.get('passer_player_name')]


def rush_plays(plays: List[Dict]) -> List[Dict]:
    """Filter to rush plays only."""
    return [p for p in plays if p.get('play_type') == 'run' and p.get('rusher_player_name')]


def plays_by_week(plays: List[Dict]) -> Dict[int, List[Dict]]:
    """Group plays by week number."""
    by_week = {}
    for p in plays:
        w = p.get('week')
        if w is not None:
            by_week.setdefault(w, []).append(p)
    return by_week


def plays_by_team(plays: List[Dict]) -> Dict[str, List[Dict]]:
    """Group plays by offensive team."""
    by_team = {}
    for p in plays:
        t = p.get('posteam')
        if t:
            by_team.setdefault(t, []).append(p)
    return by_team


def safe_div(a: float, b: float, default: float = 0.0) -> float:
    """Safe division, returns default if divisor is 0."""
    return a / b if b != 0 else default


def mean(values: List[float]) -> float:
    """Mean of a list, returns 0 if empty."""
    return sum(values) / len(values) if values else 0.0


def stdev(values: List[float]) -> float:
    """Population standard deviation."""
    if len(values) < 2:
        return 0.0
    m = mean(values)
    return (sum((v - m) ** 2 for v in values) / len(values)) ** 0.5


def median(values: List[float]) -> float:
    """Median of a list."""
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    if n % 2 == 0:
        return (s[n // 2 - 1] + s[n // 2]) / 2
    return s[n // 2]
