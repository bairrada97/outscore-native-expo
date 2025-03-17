import { DEFAULT_TIMEZONE } from './constants'
import { Fixture, FixtureEvents, FixtureGoals, FixtureLeague, FixtureScore, FixtureStatus, FixtureTeams } from './outscore-repository'


interface transformFixtureDataProps {
	league?: FixtureLeague
	fixture: Fixture
	teams: FixtureTeams
	score: FixtureScore
	goals: FixtureGoals
	events?: FixtureEvents[]
}

export interface transformFixtureData
	extends Omit<transformFixtureDataProps, 'fixture'> {
	leagueId: number
	id?: number
	status?: FixtureStatus
	date?: string | number
	timestamp?: number
	timezone: string
}

export const transformFixtureData = ({
	league,
	fixture,
	teams,
	score,
	goals,
	events,
}: transformFixtureDataProps): transformFixtureData => {
	return {
		id: fixture.id,
		leagueId: league!.id,
		status: fixture.status,
		date: fixture.date,
		timestamp: fixture.timestamp,
		teams,
		score,
		goals,
		events: events,
		timezone: fixture.timezone != 'UTC' ? fixture.timezone! : DEFAULT_TIMEZONE,
	}
}