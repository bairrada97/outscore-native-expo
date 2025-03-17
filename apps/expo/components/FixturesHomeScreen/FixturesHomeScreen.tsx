import React, { memo, useState } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTimeZone } from '@/context/timezone-context'
import { useAtomValue } from 'jotai'
import { todaysDateAtom } from '@/store/datepicker-store'
import { getFixturesByDate } from '@/queries/get-fixtures-by-date'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { useRefreshByUser } from '@/hooks/useRefreshByUser'
import { useRefreshOnFocus } from '@/hooks/useRefetchOnFocus'
import { FIFTEEN_SECONDS_CACHE, ONE_DAY_CACHE } from '@/utils/constants'
import FixturesByDate from '../FixturesByDate/FixturesByDate'

export default function FixturesHomeScreen({ day }: { day: string }) {
	const { timeZone } = useTimeZone()
	const isLive = day === 'live'
	const todaysDate = useAtomValue(todaysDateAtom)

	// const { isPending, error, data, refetch } = useQuery<any[], Error>({
	// 	queryKey: ['fixtures-by-date', day],
	// 	queryFn: async () => {
	// 		return getFixturesByDate(
	// 			isLive
	// 				? {
	// 						live: 'all',
	// 					}
	// 				: {
	// 						date: day,
	// 						timezone: timeZone,
	// 					},
	// 		)
	// 	},
	// 	enabled: !!timeZone,
	// 	refetchInterval: day === todaysDate ? FIFTEEN_SECONDS_CACHE : ONE_DAY_CACHE,
	// })

	// const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch)
	// useRefreshOnFocus(refetch)

	// if (isPending) return <LoadingIndicator />

	return <FixturesByDate data={{}} />
}
