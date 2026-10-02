import { useMemo, useState } from 'react';
import { ExternalLink, GitBranch, Search, Trophy } from 'lucide-react';
import { Button, EmptyState, Tabs } from './ui/Primitives';
import { ONEONTA_SNAPSHOT_COMMIT, rankingsData, type Position, type Tier } from '../data/oneontaRankings';
import type { AgentProject, LaunchAction } from '../types';

const POSITION_TABS: { id: Position; label: string }[] = [
  { id: 'flex', label: 'Overall / FLEX' },
  { id: 'qb', label: 'QB' },
  { id: 'rb', label: 'RB' },
  { id: 'wr', label: 'WR' },
  { id: 'te', label: 'TE' },
  { id: 'k', label: 'K' },
  { id: 'dst', label: 'D/ST' }
];

const TIER_TONE: Record<Tier, string> = {
  Elite: 'elite',
  'High-end starter': 'high',
  Starter: 'starter',
  Flex: 'flex',
  Streamer: 'streamer',
  'Bench/Avoid': 'bench'
};

/** Rows matching a player or team search, case-insensitive. Empty search keeps every row. */
export function filterRankings<T extends { player: string; team: string }>(rows: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => row.player.toLowerCase().includes(needle) || row.team.toLowerCase().includes(needle));
}

/**
 * Oneonta Weekly Fantasy Rankings, shown inside the project cockpit. The table renders the
 * vendored snapshot so it works offline; the live site stays the source of truth.
 */
export function OneontaRankingsPanel({ project, onLaunch }: { project: AgentProject; onLaunch: (action: LaunchAction) => void }) {
  const [position, setPosition] = useState<Position>('flex');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => filterRankings(rankingsData.rankings[position], query), [position, query]);
  const siteAction = project.launchActions.find((action) => action.id === 'oneonta-live-site');
  const repoAction = project.launchActions.find((action) => action.id === 'oneonta-repo');
  const updated = new Date(rankingsData.updatedAt);

  return (
    <section className="oneonta-panel" aria-label="Oneonta weekly fantasy rankings">
      <div className="oneonta-heading">
        <div>
          <div className="eyebrow"><Trophy size={16} /> League-wide weekly rankings</div>
          <h2>{rankingsData.name}</h2>
          <p>
            <span className="oneonta-week">{rankingsData.season} Week {rankingsData.week}</span>
            {' '}Updated {Number.isNaN(updated.getTime()) ? rankingsData.updatedAt : updated.toLocaleString()} ·
            Methodology v{rankingsData.methodologyVersion} · Weekly data refresh: {rankingsData.refreshSchedule}
          </p>
        </div>
        <div className="oneonta-actions">
          {siteAction && <Button variant="primary" icon={<ExternalLink size={15} />} onClick={() => onLaunch(siteAction)}>Open live site</Button>}
          {repoAction && <Button icon={<GitBranch size={15} />} onClick={() => onLaunch(repoAction)}>Open repo</Button>}
        </div>
      </div>

      <p className="oneonta-help">
        Snapshot of the site&apos;s rankings data from repository commit {ONEONTA_SNAPSHOT_COMMIT}. If the live site shows a newer week, the live site is correct and this snapshot needs a refresh.
      </p>

      <div className="oneonta-toolbar">
        <div className="oneonta-tabs">
          <Tabs items={POSITION_TABS} activeId={position} onChange={setPosition} label="Oneonta positions" />
        </div>
        <label className="oneonta-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search player or team</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or team" maxLength={80} />
        </label>
      </div>

      <div id={`oneonta-positions-${position}`} role="tabpanel" aria-labelledby={`oneonta-positions-tab-${position}`} className="oneonta-table-wrap">
        {rows.length ? (
          <table className="oneonta-table">
            <thead>
              <tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Team</th><th scope="col">Opponent</th><th scope="col">Tier</th><th scope="col">Notes</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.position}-${row.player}`}>
                  <td className="oneonta-rank">{row.rank}</td>
                  <th scope="row">{row.player}{position === 'flex' && <small> {row.position.toUpperCase()}</small>}</th>
                  <td>{row.team}</td>
                  <td>{row.opponent}</td>
                  <td><span className={`oneonta-tier oneonta-tier-${TIER_TONE[row.tier]}`}>{row.tier}</span></td>
                  <td className="oneonta-note">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No players match" detail="Clear the search or switch position." />
        )}
      </div>

      <div className="oneonta-grid">
        <div className="oneonta-card">
          <h3>League scoring lens</h3>
          {rankingsData.scoringRules.map((group) => (
            <div key={group.category}>
              <strong>{group.category}</strong>
              <ul>{group.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="oneonta-card">
          <h3>Methodology</h3>
          <ul>{rankingsData.methodology.map((line) => <li key={line}>{line}</li>)}</ul>
          <p className="oneonta-help">
            Sources: {rankingsData.sources.map((source, index) => (
              <span key={source.name}>{index ? ', ' : ''}{source.name}</span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
