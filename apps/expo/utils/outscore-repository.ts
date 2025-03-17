export interface Endpoints {
	baseURL: string
	fixtures: string
	h2h: string
	injuries: string
	betsHelper: string
	standings: string
}

export interface Fixture {
	date?: string
	id?: number
	periods?: FixturePeriods
	referee?: string
	status?: FixtureStatus
	timestamp?: number
	timezone?: string
	venue?: FixtureVenue
}

export interface FixtureOverview {
	fixture: Fixture
	goals: FixtureGoals
	league: FixtureLeague
	score: FixtureScore
	teams: FixtureTeams
}

export interface FixturePeriods {
	first?: number
	second?: number
}

export type FixtureStatusShort =
	| 'CANC'
	| 'PST'
	| 'ABD'
	| 'WO'
	| 'FT'
	| 'HT'
	| 'INT'
	| 'PEN'
	| 'NS'
	| 'AET'
	| 'BT'
	| 'P'

export interface FixtureStatus {
	elapsed?: number
	long?: string
	short?: FixtureStatusShort
}

export interface FixtureVenue {
	city?: string
	id?: number
	name?: string
}

export interface FixtureGoals {
	away: number | null
	home: number | null
}

export interface FixtureLeague {
	country: string
	flag: string
	id: number
	logo: string
	name: string
	round: string
	season: number
}

export interface FixtureScore {
	extratime: FixtureGoals
	fulltime: FixtureGoals
	halftime: FixtureGoals
	penalty: FixtureGoals
}

export interface FixtureTeamInfo {
	id: number
	logo?: string
	name?: string
	winner?: boolean | null
}

export interface FixtureTeams {
	away: FixtureTeamInfo
	home: FixtureTeamInfo
}

export interface League {
	[key: string]: FixtureOverview[]
}

export interface Country {
	country: string
	image: string
	league: League
	totalGames: number
	totalLiveGames: number
}

export type FetchFixturesResponse = Record<string, Country> & FixtureByID[]

export interface FetchFixtures {
	error: Error
	response: Record<string, Country> & FixtureByID[]
}

export interface Assist {
	id: number
	name: string
}

export interface Player {
	id: number
	name: string
}
export interface Team {
	id: number
	logo: string
	name: string
}
export interface Time {
	elapsed: number
	extra: number | null
}
export interface FixtureEvents {
	assist?: Assist
	comments?: string | null
	detail?: string
	goal?: any
	penaltiesGoals?: any
	player?: Player
	team: Team
	time: Time
	type?: string
	side?: 'home' | 'away'
}

export interface Statistic {
	type: string
	value: number
}

export interface StatisticTransformed {
	name: string
	value: string
}
export interface FixtureStatisticsInterface {
	statistics: Statistic[]
	team: Team
}

export interface Coach {
	id?: number
	name?: string
	photo?: string
}

export interface LineupsPlayer {
	grid?: string | null
	id?: number
	name?: string
	number?: number
	pos?: string
	photo?: string
}
export interface LineupTeam extends Team {
	colors: {
		goalkeeper: {
			border?: string
			number?: string
			primary?: string
		}
		player: {
			border?: string
			number?: string
			primary?: string
		}
	}
}
export interface LineupsInfo {
	coach: Coach
	formation: string
	startXI: {
		player: LineupsPlayer
	}[]
	substitutes: {
		player: LineupsPlayer
	}[]
	team: LineupTeam
}

export type Side = 'away' | 'home'

export interface FixtureByID {
	events?: FixtureEvents[]
	fixture: Fixture
	goals: FixtureGoals
	league: FixtureLeague
	lineups?: LineupsInfo[]
	players?: any
	score: FixtureScore
	statistics: FixtureStatisticsInterface[]
	teams: FixtureTeams
}

export interface FetchFixtureByIDResponse {
	isBetsHelperInCache: boolean
	response: FixtureByID[]
}

export interface StandingsResults {
	draw: number
	goals: { for: number; against: number }
	lose: number
	played: number
	win: number
}

export interface Standings {
	all: StandingsResults
	away: StandingsResults
	home: StandingsResults
	description: string
	form: string
	goalsDiff: number
	group: string
	points: number
	rank: number
	status: string
	team: Team
	update: string
}

export interface FetchFixtureStandingsResponse {
	response: {
		league: {
			country: string
			flag: string
			id: number
			logo: string
			name: string
			season: number
			standings: [Standings][]
		}
	}[]
}

export interface FixtureInjures {
	fixture: Fixture
	league: FixtureLeague
	player: {
		id: number
		photo: string
		name: string
		reason: string
		type: string
	}
	team: Team
}

export interface FetchFixtureInjuriesResponse {
	response: FixtureInjures[]
}

export interface FetchFixturesBetsHelperResponse {
	h2h: FetchFixtureByIDResponse['response']
	away: FetchFixtureByIDResponse['response']
	home: FetchFixtureByIDResponse['response']
}

export const outscoreRepository = () => {
	const OUTSCORE_ENDPOINTS: Endpoints = {
		baseURL: 'https://outscore.fly.dev/api/v3',
		fixtures: '/fixtures',
		h2h: '/fixtures/headtohead',
		injuries: '/injuries',
		betsHelper: '/betshelper',
		standings: '/standings',
	}

	const fetchFixtureByDate = async (args: any) => {
		const params = new URLSearchParams(args).toString()
		const data = await fetch(
			`https://outscore.fly.dev/api/v3/fixtures?${params}`,
		).then(res => res.json())

		return data as any
	}

	const fetchLiveFixtures = ({ groupBy }: { groupBy: boolean }) => {
		const params = new URLSearchParams({
			live: 'all',
			groupBy: groupBy.toString(),
		}).toString()

		const data = fetch(
			`https://outscore.fly.dev/api/v3/fixtures?${params}`,
		).then(res => res.json())

		return data
	}

	const fetchFixtureById = async (args: any) => {
		const params = new URLSearchParams(args).toString()

		// const params = new URLSearchParams({
		//   id: id.toString(),
		//   timezone: queryToTimezone(timezone),
		// }).toString();

		const data = fetch(
			`https://outscore.fly.dev/api/v3/fixtures?${params}`,
		).then(res => res.json())

		return data
	}

	const fetchFixturesBetsHelper = async ({
		homeID,
		awayID,
	}: {
		homeID: number
		awayID: number
	}) => {
		const params = new URLSearchParams({
			home: homeID.toString(),
			away: awayID.toString(),
		}).toString()
		const res = await fetch(
			`https://outscore.fly.dev/api/v3/betshelper?${params}`,
		)

		const data = await res.json()

		return data
	}

	const fetchH2H = async (args: any) => {
		const params = new URLSearchParams(args).toString()

		const res = await fetch(
			`https://outscore.fly.dev/api/v3/fixtures/headtohead?${params}`,
		)

		const data = await res.json()

		return data
	}

	const fetchFixturesByTeam = async (args: any) => {
		const params = new URLSearchParams(args).toString()

		const res = await fetch(
			`https://outscore.fly.dev/api/v3/fixtures?${params}`,
		)

		const data = await res.json()

		return data
	}

	const fetchStandings = async ({
		season,
		league,
	}: {
		season: number
		league: number
	}) => {
		const params = new URLSearchParams({
			season: season.toString(),
			league: league.toString(),
		}).toString()
		const res = await fetch(
			`https://outscore.fly.dev/api/v3/standings?${params}`,
		)

		const data = await res.json()

		return data
		//  return await $fetch<FetchFixtureStandingsResponse>(
		//    OUTSCORE_ENDPOINTS.standings,
		//    {
		//      baseURL: OUTSCORE_ENDPOINTS.baseURL,
		//      params: {
		//        season,
		//        league,
		//      },
		//    }
		//  );
	}

	const fetchFixturesInjuries = async ({ fixture }: { fixture: number }) => {
		// const params = new URLSearchParams({
		// 	fixture: fixture.toString(),
		// }).toString()
		const res = await fetch(
			`https://outscore.fly.dev/api/v3/injuries?fixture=${fixture}`,
		)

		const data = await res.json()

		return data as FixtureInjures[]
	}

	return {
		OUTSCORE_ENDPOINTS,
		fetchFixtureByDate,
		fetchLiveFixtures,
		fetchFixtureById,
		fetchFixturesBetsHelper,
		fetchH2H,
		fetchFixturesByTeam,
		fetchStandings,
		fetchFixturesInjuries,
	}
}