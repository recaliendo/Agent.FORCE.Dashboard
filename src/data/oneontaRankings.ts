// Vendored from recaliendo/oneonta-analytics-hub src/data/rankings.ts (commit ef8cc1a).
// The live site (https://oneontafantasy.live) is the source of truth; this snapshot lets the
// cockpit show the current week offline. Replace this file whole when the site's data changes.
export const ONEONTA_SNAPSHOT_COMMIT = 'ef8cc1a';
export type Position = 'flex' | 'qb' | 'rb' | 'wr' | 'te' | 'k' | 'dst';
export type Trend = 'up' | 'down' | 'same';
export type Tier = 'Elite' | 'High-end starter' | 'Starter' | 'Flex' | 'Streamer' | 'Bench/Avoid';
export type Ranking = {
  rank: number;
  player: string;
  team: string;
  opponent: string;
  position: Exclude<Position, 'flex'>;
  tier: Tier;
  trend: Trend;
  note: string;
  flag?: string;
};

type Entry = [name: string, team: string, opponent: string];

const qbEntries: Entry[] = [
  ['Josh Allen','BUF','vs NE'],['Lamar Jackson','BAL','vs TEN'],['Trevor Lawrence','JAC','at CIN'],['Patrick Mahomes','KC','at LV'],['Joe Burrow','CIN','vs JAC'],['Jared Goff','DET','at CAR'],['Dak Prescott','DAL','at HOU'],['Brock Purdy','SF','vs DEN'],['Tyler Shough','NO','vs ATL'],['Jalen Hurts','PHI','vs LAR'],['Bryce Young','CAR','vs DET'],['Kyler Murray','ARI','at NYG'],['Matthew Stafford','LAR','at PHI'],['Jordan Love','GB','at TB'],['C.J. Stroud','HOU','vs DAL'],['Bo Nix','DEN','at SF'],['Drake Maye','NE','at BUF'],['Marcus Mariota','WAS','vs IND'],['Aaron Rodgers','PIT','at CLE'],['Daniel Jones','IND','at WAS'],
];
const rbEntries: Entry[] = [
  ['Jahmyr Gibbs','DET','at CAR'],['Bijan Robinson','ATL','at NO'],['Kenneth Walker III','KC','at LV'],['Jonathan Taylor','IND','at WAS'],['Derrick Henry','BAL','vs TEN'],['Christian McCaffrey','SF','vs DEN'],['Jeremiyah Love','ARI','at NYG'],['James Cook','BUF','vs NE'],['Ashton Jeanty','LV','vs KC'],['Kyren Williams','LAR','at PHI'],['Jaylen Warren','PIT','at CLE'],["D'Andre Swift",'CHI','vs NYJ'],['Chuba Hubbard','CAR','vs DET'],['Saquon Barkley','PHI','vs LAR'],['Chase Brown','CIN','vs JAC'],['Bucky Irving','TB','vs GB'],['Aaron Jones Sr.','MIN','vs MIA'],['Braelon Allen','NYJ','at CHI'],['Javonte Williams','DAL','at HOU'],['Bhayshul Tuten','JAC','at CIN'],['Cam Skattebo','NYG','vs ARI'],['Omarion Hampton','LAC','at SEA'],['David Montgomery','HOU','vs DAL'],['Jacory Croskey-Merritt','WAS','vs IND'],['Ollie Gordon II','MIA','at MIN'],
];
const wrEntries: Entry[] = [
  ['Jaxon Smith-Njigba','SEA','vs LAC'],["Ja'Marr Chase",'CIN','vs JAC'],['Amon-Ra St. Brown','DET','at CAR'],['Chris Olave','NO','vs ATL'],['Puka Nacua','LAR','at PHI'],['CeeDee Lamb','DAL','at HOU'],['Drake London','ATL','at NO'],['Justin Jefferson','MIN','vs MIA'],['Christian Watson','GB','at TB'],['Zay Flowers','BAL','vs TEN'],['Nico Collins','HOU','vs DAL'],['Garrett Wilson','NYJ','at CHI'],['Tetairoa McMillan','CAR','vs DET'],['Parker Washington','JAC','at CIN'],['George Pickens','DAL','at HOU'],['Davante Adams','LAR','at PHI'],['Rashee Rice','KC','at LV'],['DeVonta Smith','PHI','vs LAR'],['Matthew Golden','GB','at TB'],['Tee Higgins','CIN','vs JAC'],['Michael Wilson','ARI','at NYG'],['Jaylen Waddle','DEN','at SF'],['Malik Nabers','NYG','vs ARI'],['Josh Downs','IND','at WAS'],['DJ Moore','BUF','vs NE'],['Mike Evans','SF','vs DEN'],['Ladd McConkey','LAC','at SEA'],['Jalen Coker','CAR','vs DET'],['Keenan Allen','IND','at WAS'],['DK Metcalf','PIT','at CLE'],
];
const teEntries: Entry[] = [
  ['Trey McBride','ARI','at NYG'],['Brock Bowers','LV','vs KC'],['George Kittle','SF','vs DEN'],['Tyler Warren','IND','at WAS'],['Travis Kelce','KC','at LV'],['Juwan Johnson','NO','vs ATL'],['Sam LaPorta','DET','at CAR'],['Kenyon Sadiq','NYJ','at CHI'],['Harold Fannin Jr.','CLE','vs PIT'],['Tucker Kraft','GB','at TB'],['Dalton Kincaid','BUF','vs NE'],['Colston Loveland','CHI','vs NYJ'],['Isaiah Likely','NYG','vs ARI'],['Mark Andrews','BAL','vs TEN'],['Darren Waller','CAR','vs DET'],['Dalton Schultz','HOU','vs DAL'],['Jake Ferguson','DAL','at HOU'],['Tyler Higbee','LAR','at PHI'],['Brenton Strange','JAC','at CIN'],['Pat Freiermuth','PIT','at CLE'],
];
const kEntries: Entry[] = [
  ['Brandon Aubrey','DAL','at HOU'],["Ka'imi Fairbairn",'HOU','vs DAL'],['Evan McPherson','CIN','vs JAC'],['Jason Myers','SEA','vs LAC'],['Will Reichard','MIN','vs MIA'],['Tyler Loop','BAL','vs TEN'],['Spencer Shrader','IND','at WAS'],['Harrison Butker','KC','at LV'],['Trey Smack','GB','at TB'],['Cam Little','JAC','at CIN'],['Chris Boswell','PIT','at CLE'],['Ryan Fitzgerald','CAR','vs DET'],['Jake Bates','DET','at CAR'],['Drew Stevens','WAS','vs IND'],['Nick Folk','ATL','at NO'],['Daniel Carlson','NO','vs ATL'],['Chad Ryland','ARI','at NYG'],['Cairo Santos','CHI','vs NYJ'],['Eddy Pineiro','SF','vs DEN'],['Dominic Zvada','NYG','vs ARI'],
];
const dstEntries: Entry[] = [
  ['Vikings','MIN','vs MIA'],['Seahawks','SEA','vs LAC'],['Ravens','BAL','vs TEN'],['Bills','BUF','vs NE'],['Steelers','PIT','at CLE'],['Packers','GB','at TB'],['Chiefs','KC','at LV'],['Cardinals','ARI','at NYG'],['Browns','CLE','vs PIT'],['Saints','NO','vs ATL'],['Lions','DET','at CAR'],['Texans','HOU','vs DAL'],['Rams','LAR','at PHI'],['Eagles','PHI','vs LAR'],['Buccaneers','TB','vs GB'],['Giants','NYG','vs ARI'],['Broncos','DEN','at SF'],['49ers','SF','vs DEN'],['Bears','CHI','vs NYJ'],['Cowboys','DAL','at HOU'],['Jaguars','JAC','at CIN'],['Colts','IND','at WAS'],['Patriots','NE','at BUF'],['Bengals','CIN','vs JAC'],['Jets','NYJ','at CHI'],['Commanders','WAS','vs IND'],['Falcons','ATL','at NO'],['Chargers','LAC','at SEA'],['Raiders','LV','vs KC'],['Titans','TEN','at BAL'],['Dolphins','MIA','at MIN'],['Panthers','CAR','vs DET'],
];

const notes: Partial<Record<Exclude<Position, 'flex'>, string[]>> = {
  qb: ['Passing TDs carry extra weight in this format.', 'Passing volume and touchdown ceiling matter here.', 'Six-point passing TDs support this placement.', 'Passing production remains a key scoring lever.'],
  rb: ['Volume-driven upside in this matchup.', 'Touch opportunities shape the weekly floor.', 'Usage and scoring chances anchor this range.', 'Matchup and workload inform the projection.'],
  wr: ['Target opportunity drives the outlook.', 'Receiving volume supports this range.', 'Matchup and target share shape the ceiling.', 'Role and game environment matter here.'],
  te: ['Route involvement drives this placement.', 'Target opportunity matters at tight end.', 'Scoring chances shape the weekly ceiling.'],
  k: ['Game environment informs the projection.', 'Field-goal chances shape the outlook.'],
  dst: ['Opponent matchup shapes the outlook.', 'Pressure and turnover potential matter here.'],
};

function tierFor(position: Exclude<Position, 'flex'>, rank: number): Tier {
  const cuts: Record<Exclude<Position, 'flex'>, number[]> = {
    qb: [3, 7, 12, 16, 20], rb: [5, 12, 20, 25, 25], wr: [6, 16, 26, 30, 30],
    te: [3, 7, 12, 16, 20], k: [3, 8, 12, 17, 20], dst: [4, 10, 16, 24, 28],
  };
  const labels: Tier[] = ['Elite', 'High-end starter', 'Starter', 'Flex', 'Streamer', 'Bench/Avoid'];
  return labels[cuts[position].findIndex(cut => rank <= cut)] ?? 'Bench/Avoid';
}

function makeRankings(entries: Entry[], position: Exclude<Position, 'flex'>): Ranking[] {
  return entries.map(([player, team, opponent], index) => ({
    rank: index + 1, player, team, opponent, position,
    tier: tierFor(position, index + 1),
    // No numeric consensus rank was provided, so leave the comparison neutral until verified.
    trend: 'same',
    note: notes[position]?.[index % (notes[position]?.length ?? 1)] ?? 'Matchup and role inform this ranking.',
  }));
}

const qb = makeRankings(qbEntries, 'qb');
const rb = makeRankings(rbEntries, 'rb');
const wr = makeRankings(wrEntries, 'wr');
const te = makeRankings(teEntries, 'te');
const k = makeRankings(kEntries, 'k');
const dst = makeRankings(dstEntries, 'dst');

// FLEX is explicitly ordered; these identifiers resolve to the position lists above.
const flexOrder: [Exclude<Position, 'flex'>, number][] = [
  ['rb',1],['rb',2],['wr',1],['rb',3],['rb',4],['rb',5],['rb',6],['wr',2],['wr',3],['wr',4],['wr',5],['rb',7],['rb',8],['wr',6],['rb',9],['wr',7],['te',1],['wr',8],['wr',9],['wr',10],['rb',10],['rb',11],['wr',11],['wr',12],['wr',13],['wr',14],['te',2],['rb',12],['rb',13],['wr',15],
];
const byPosition = { qb, rb, wr, te, k, dst };
const flex: Ranking[] = flexOrder.map(([position, sourceRank], index) => {
  const source = byPosition[position][sourceRank - 1];
  if (!source) throw new Error(`Missing FLEX source: ${position} #${sourceRank}`);
  return { ...source, rank: index + 1, tier: index < 10 ? 'Elite' : index < 20 ? 'High-end starter' : 'Starter', trend: 'same' };
});

export const rankingsData = {
  name: 'Oneonta Weekly Fantasy Rankings',
  season: 2026,
  week: 4,
  updatedAt: '2026-10-01T23:37:00Z',
  methodologyVersion: '1.0',
  refreshSchedule: 'Tuesday 8:00 AM ET',
  scoringRules: [
    { category: 'Passing', rules: ['6 pts / passing TD', '1 pt / 25 passing yards', '−2 pts / interception', '300 & 400-yard bonuses'] },
    { category: 'Rushing + receiving', rules: ['Production-based scoring', 'Long-play bonuses'] },
    { category: 'Defense + special teams', rules: ['Defensive scoring', 'Special-teams scoring'] },
  ],
  methodology: [
    'These are league-wide rankings, not recommendations tailored to a specific roster.',
    'Our scoring lens weighs the league’s custom rules alongside matchup quality, injuries, recent usage and performance, projected game environment, role changes, red-zone opportunity, turnovers, and expert consensus.',
    'Quarterbacks are reordered for six-point passing touchdowns. Other positions start from the supplied Week 4 expert order and remain adjustable as scoring details are refined.',
    'Trend comparisons stay neutral until a verified numeric consensus baseline is included in the weekly data. No injury status is shown unless verified and explicitly included in the weekly data.',
  ],
  sources: [
    { name: 'FantasyPros', url: 'https://www.fantasypros.com/nfl/rankings/' },
    { name: 'Sports Illustrated', url: 'https://www.si.com/fantasy' },
  ],
  rankings: { flex, qb, rb, wr, te, k, dst },
};
