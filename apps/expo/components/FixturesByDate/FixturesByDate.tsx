import { useQuery } from '@tanstack/react-query'

import { Dimensions, ScrollView, SectionList, View } from 'react-native'
import { TitleSection } from '../ui/title-section'
import FixturesList from '../FixturesList/FixturesList'

import { Text } from '../ui/text'
import { memo, useMemo } from 'react'
import { FavoriteFixtureList } from '../FavoriteFixtureList/FavoriteFixtureList'

export default function FixturesByDate({
	data,
	groupBy,
}: {
	data: any
	groupBy?: boolean 
}) {
	return (
		<>
			<ScrollView className="bg-neu-02 pt-16">
				<TitleSection>Favorite Competitions</TitleSection>
				<View className="px-16">
					{/* <FavoriteFixtureList data={data} /> */}
				</View>
				<TitleSection>All Competitions</TitleSection>
				<View className="px-16">
					{/* <FixturesList data={data} /> */}
				</View>
			</ScrollView>
		</>
	)
}
