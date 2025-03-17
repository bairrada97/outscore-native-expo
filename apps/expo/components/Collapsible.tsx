import {
	StyleSheet,
	Text,
	TouchableWithoutFeedback,
	View,
	UIManager,
	Platform,
	LayoutAnimation,
} from 'react-native'
import React, { useState } from 'react'

export default function Accordion({
	children,
	title,
}: {
	children: any
	title: any
}) {
	const [opened, setOpened] = useState(false)

	if (
		Platform.OS === 'android' &&
		UIManager.setLayoutAnimationEnabledExperimental
	) {
		UIManager.setLayoutAnimationEnabledExperimental(true)
	}

	function toggleAccordion() {
		LayoutAnimation.configureNext({
			duration: 300,
			create: { type: 'easeIn', property: 'opacity' },
			update: { type: 'linear', springDamping: 0.3, duration: 250 },
		})
		setOpened(!opened)
	}

	return (
		<View>
			<TouchableWithoutFeedback onPress={toggleAccordion}>
				<View>{title}</View>
			</TouchableWithoutFeedback>

			{opened && (
				<View>
					<Text>{children}</Text>
				</View>
			)}
		</View>
	)
}
