import { CardMatch } from '../CardMatch/CardMatch'
import { CardsBlock } from '../CardsBlock/CardsBlock'
import CountryItem from '../CountryItem/CountryItem'
import { View } from 'react-native'
import { LegendList } from '@legendapp/list'
import { Text } from '../ui/text'
import { memo, useCallback, useMemo, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion'
import { FormattedCountry, FormattedMatch } from '@outscore/shared-types'

type ItemProps = {
	item: FormattedCountry
	onPress: () => void
	isSelected: boolean
}

// Memoize the Item component to prevent unnecessary re-renders
const Item = memo(({ item, onPress, isSelected }: ItemProps) => {
	// Calculate total matches and live matches
	const totalMatches = item.leagues.reduce((acc, league) => acc + league.matches.length, 0)
	const totalLiveMatches = item.leagues.reduce((acc, league) => {
		return acc + league.matches.filter(match => match.status?.elapsed !== null).length
	}, 0)

	return (
		<AccordionItem value={item.name}>
			<AccordionTrigger onPress={onPress}>
				<CountryItem
					image={item.flag?.toLowerCase() || item.name.toLowerCase()}
					name={item.name}
					totalMatches={totalMatches}
					totalLiveMatches={totalLiveMatches}
				/>
			</AccordionTrigger>
			<AccordionContent>
				{item.leagues.map(league => (
					<CardsBlock key={league.id} title={league.name}>
						{league.matches.map((match, index) => (
							<CardMatch
								key={match.id}
								fixture={match}
								isLastMatch={index === league.matches.length - 1}
							/>
						))}
					</CardsBlock>
				))}
			</AccordionContent>
		</AccordionItem>
	)
})

export default function FixturesList({
	data,
	groupBy = true,
}: {
	data: FormattedCountry[]
	groupBy?: boolean
}) {
	const [selectedIds, setSelectedIds] = useState<string[]>([])

	// Memoize the renderItem function
	const renderItem = useCallback(
		({ item }: { item: FormattedCountry }) => {
			const isSelected = selectedIds.includes(item.name)
			return (
				<Item
					item={item}
					onPress={() => {
						setSelectedIds(prev => 
							isSelected 
								? prev.filter(id => id !== item.name)
								: [...prev, item.name]
						)
					}}
					isSelected={isSelected}
				/>
			)
		},
		[selectedIds],
	)

	return (
		<View className="flex-1">
			<Accordion
				type="multiple"
				value={selectedIds}
				onValueChange={setSelectedIds}
				className="w-full"
			>
				<LegendList
					data={data}
					renderItem={renderItem}
					keyExtractor={item => item.name}
					estimatedItemSize={40}
					drawDistance={125}
				/>
			</Accordion>
		</View>
	)
}
