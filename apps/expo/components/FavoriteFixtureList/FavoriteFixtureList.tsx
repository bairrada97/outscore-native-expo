import { transformFixtureData } from '@/utils/transform-fixture-data'
import { CardMatch } from '../CardMatch/CardMatch'
import { CardsBlock } from '../CardsBlock/CardsBlock'
import { FixtureOverview, League } from '@/utils/outscore-repository'
import { NoResultsBox } from '../NoResultsBox/NoResultsBox'
import { View } from 'react-native'

const List = ({ data, groupBy }: { data: any; groupBy?: boolean }) => {
	return (
		<>
			{groupBy
				? data?.map((dataItem: any, index: number) => {
						return (
							<CardsBlock
								key={dataItem[0].league.name + index}
								title={dataItem[0].league.name}
							>
								{Object.values(dataItem).map((fixture: any) => {
									return (
										<CardMatch
											key={fixture.fixture.id}
											fixture={transformFixtureData(fixture)}
											shouldPrefetch={true}
											isLastMatch={false}
										/>
									)
								})}
							</CardsBlock>
						)
					})
				: Object.entries(data)?.map(([leagueName, dataItem]) => {
						return (
							<CardsBlock key={leagueName} title={leagueName}>
								{Object.values(dataItem as any).map((fixture: any) => {
									return (
										<CardMatch
											key={fixture.fixture.id}
											fixture={transformFixtureData(fixture)}
											shouldPrefetch={true}
											isLastMatch={false}
										/>
									)
								})}
							</CardsBlock>
						)
					})}
		</>
	)
}

export const FavoriteFixtureList = ({
	data,
	groupBy = true,
}: {
	data: any
	groupBy?: boolean
}) => {
	const favoriteLeaguesID = [1, 2, 3, 94, 39, 88, 140, 135, 61, 78, 743, 960]

	let formatFavoriteData: League | FixtureOverview[] | FixtureOverview[][]

	if (groupBy) {
		formatFavoriteData = Object.values(data.response!)
			?.map((country: any) => Object.values(country.league))
			?.flat(1)
			?.filter((item: any) =>
				item?.find((league: any) =>
					favoriteLeaguesID.includes(league.league.id),
				),
			) as any
	} else {
		formatFavoriteData = data.reduce((acc: any, match: FixtureOverview) => {
			acc[match.league.name] = acc[match.league.name] || []
			acc[match.league.name]?.push(match)

			return acc
		}, {}) as any
	}

	return (
		<View>
			{Object.keys(formatFavoriteData).length ? (
				Array(formatFavoriteData).length ? (
					<List data={formatFavoriteData!} groupBy={groupBy} />
				) : true ? (
					<NoResultsBox text="There are no ongoing matches on your favorite competitions." />
				) : (
					<NoResultsBox text="There are no matches happening today on your favorite competitions." />
				)
			) : (
				<NoResultsBox
					text="You don’t have any favorite competitions yet."
					ctaText="Search more teams to follow"
				/>
			)}
		</View>
	)
}
