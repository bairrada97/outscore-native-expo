import { transformFixtureData } from '@/utils/transform-fixture-data'
import { CardMatch } from '../CardMatch/CardMatch'
import { CardsBlock } from '../CardsBlock/CardsBlock'
import { CountryItem } from '../CountryItem/CountryItem'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '../ui/accordion'
import { View } from 'react-native'
import { LegendList } from '@legendapp/list'
import { Text } from '../ui/text'
import { memo, useCallback, useMemo, useState } from 'react'
import { Collapsible } from 'react-native-fast-collapsible'
import SimpleCollapsible from '../Collapsible'

type ItemProps = {
	item: Country
	onPress: () => void
	isSelected: boolean
}

// ... existing code ...

// Memoize the Item component to prevent unnecessary re-renders
const Item = memo(({ item, onPress, isSelected }: ItemProps) => (
	<CountryItem
		image={'cenas'}
		name={'cenas'}
		totalMatches={0}
		totalLiveMatches={0}
	/>
	// <AccordionItem key={item.country} value={item.country}>
	// 	<AccordionTrigger onPress={onPress}>

	// 	</AccordionTrigger>
	// 	<AccordionContent>

	// 	</AccordionContent>
	// </AccordionItem>
))

export default function FixturesList({
	data,
	groupBy = true,
}: {
	data: any
	groupBy?: boolean
}) {
	const [selectedId, setSelectedId] = useState<string>()

	// Memoize the renderItem function
	const renderItem = useCallback(
		({ item }: { item: any }) => {
			const isSelected = item.country === selectedId
			return (
				<Item
					item={item}
					onPress={() => setSelectedId(item.country)}
					isSelected={isSelected}
				/>
			)
		},
		[selectedId],
	)

	// Memoize the data array
	const listData = useMemo(
		() => Object.values(data?.response || {}),
		[data?.response],
	)

	return (
		<View>
			<FlashList
				data={listData}
				renderItem={renderItem}
				keyExtractor={item => item.country}
				extraData={selectedId}
				estimatedItemSize={40}
				drawDistance={125}
			/>
		</View>
	)
}
