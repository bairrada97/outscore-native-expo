
import { FIFTEEN_SECONDS_CACHE } from '@/utils/constants'
import { getFixturesByDate } from './get-fixtures-by-date'

export const fixturesByDateQuery = (args: any) => {
	const queryKey = ['matches-by-date', args.date || args.live]
	const queryFn = async () => {
		return getFixturesByDate(args)
	}
	const refetchInterval = FIFTEEN_SECONDS_CACHE
	return { queryKey, queryFn, refetchInterval }
}