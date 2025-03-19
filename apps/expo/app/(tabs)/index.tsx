import {Dimensions, useWindowDimensions, View } from 'react-native'

import { ReactNode, useEffect, useState, useMemo, useCallback, memo } from 'react'
import { TabView, SceneMap, TabBarProps, Route, TabBar, TabDescriptor } from 'react-native-tab-view';
import { format } from 'date-fns'
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { isWeb } from '@gluestack-ui/nativewind-utils/IsWeb';
import { LIVE_BUTTON_LABEL } from '@/utils/constants';
import SvgB021 from '@/components/ui/SvgIcons/B021';
import { CalendarBarButton } from '@/components/CalendarBarButton/CalendarBarButton';
import SvgB022 from '@/components/ui/SvgIcons/B022';
import { cn } from '@/utils/misc';
import FixturesHomeScreen from '@/components/FixturesHomeScreen/FixturesHomeScreen';
import { getDateRange, getInitialTabIndex } from '@/utils/date-utils';

type CustomRoute = Route & {
  key: string;
  title: string;
  weekDay: string | null;
  date: Date | null;
}

export const CalendarBarButtonScreen = () => {
	const screenWidth = Dimensions.get('screen').width

	return (
		<View
			className={cn(
				'absolute left-0 z-10 flex h-48 flex-row items-center justify-start',
			)}
			style={{
				width: (isWeb ? 800 : screenWidth) / 7,
			}}
		>
			<CalendarBarButton
				icon={<SvgB022 width={24} height={24} className="text-m-01" />}
				onPress={() => {}}
			/>
		</View>
	)
}

// Memoized fixture screen component
const MemoizedFixturesScreen = memo(FixturesHomeScreen);

export default function HomeScreen() {
	const { date } = useGlobalSearchParams()

	const router = useRouter()
	const layout = useWindowDimensions();

	const todayDate = new Date();
	const isLive = date === 'live'
	const currentDate = isLive ? 'live' : date ? new Date(date as string) : todayDate;
	
	// Use the utility function to get the date range
	const dates = getDateRange(todayDate); 

	// Use the utility function to get the initial tab index
	const initialIndex = getInitialTabIndex(currentDate, todayDate);
	const [index, setIndex] = useState(initialIndex);
	
	// Memoize the tabs array to prevent recreating on each render
	const tabs = useMemo<CustomRoute[]>(() => [
		...dates.map((date, index) => ({
		  key: `tab-${index}`,
		  title: format(date, 'EEE'),
		  weekDay: format(date, 'd'),
		  date
		})),
		{
		  key: 'tab-live',
		  title: LIVE_BUTTON_LABEL,
		  weekDay: null,
		  date: null
		}
	], [dates]);

	const [routes] = useState<CustomRoute[]>(tabs);

	// Add state to track if navigation is in progress
	const [isNavigating, setIsNavigating] = useState(false);
	
	// Improve the tab change handler with debouncing and navigation state
	const handleIndexChange = useCallback((newIndex: number) => {
		
		setIndex(newIndex);

    if (newIndex === 5) {
      router.setParams({ date: "live" });
    } else {
      const selectedDate = dates[newIndex];
      router.setParams({ date: format(selectedDate, 'yyyy-MM-dd') });
    }
	
	}, [dates, router, isNavigating]);

	// Memoize the tab bar render function with improved press handling
	const renderTabBar = useCallback((props: TabBarProps<CustomRoute>) => (
		<TabBar
			{...props}
			style={{
				elevation: 5,
				shadowColor: 'rgb(19, 20, 19)',
				shadowOffset: { width: 0, height: 5 },
				shadowOpacity: 0.12,
				shadowRadius: 10,
				left: (isWeb ? 800 : layout.width) / 7 
			}}
			indicatorContainerStyle={{
				backgroundColor: 'white'
			}}
			indicatorStyle={{
				height: '100%',
				backgroundColor: 'rgb(24,124,86)',
			}}
			contentContainerStyle={{
				overflow: 'hidden',
			}}
			tabStyle={{
				width: (isWeb ? 800 : layout.width) / 7,
				padding: 0,
				alignContent: 'center',
				marginHorizontal: 0,
				marginVertical: 0,
				borderLeftWidth: 1,
				borderLeftColor: 'rgb(218,221,219)'
			}}
			pressColor='transparent'
			pressOpacity={1}
			activeColor='white'
			inactiveColor='rgba(94,103,99, 0.7)'
		/>
	), [layout.width, isNavigating]);

	// Memoize the scene map
	const renderScene = useMemo(() => 
		SceneMap(
			routes.reduce<Record<string, () => ReactNode>>((scenes, route) => {
				scenes[route.key] = () => {
					if (route.key === 'tab-live') {
						return <MemoizedFixturesScreen day="live" />;
					} else {
						const formattedDate = route.date ? format(route.date, 'yyyy-MM-dd') : '';
						return <MemoizedFixturesScreen day={formattedDate} />;
					}
				};
				return scenes;
			}, {})
		),
		[routes]
	); 

	// Memoize common options
	const commonOptions = useMemo((): TabDescriptor<CustomRoute> => ({
		icon: ({ route, focused, color }) => {
			if(route.title === LIVE_BUTTON_LABEL) {
				return <SvgB021
					width={24}
					height={24}
					className={focused ? 'text-neu-01' : 'text-m-01'}
					color={focused ? 'white' : 'rgb(24,124,86)'}
				/>;
			}
			return (
				<Text
					style={{
						color,
						fontSize: 20,
						alignItems: 'center',
						textAlign: 'center',
						marginHorizontal: 0,
						marginVertical: 0,
					}}
				>
					{route.weekDay}
				</Text>
			);
		},
		label: ({route, focused, color}) => (
			<Text
				style={{
					color: focused ? 'white' : 'rgba(94,103,99,0.7)',
					textAlign: 'center',
					fontSize: 12,
					fontWeight: 'regular',
					textTransform: 'uppercase',
					alignItems: 'center',
					marginHorizontal: 0,
					marginVertical: 0,
				}}
			>
				{route.title}
			</Text>
		),
	}), []);

	return (
		<View style={{ height: "100%", flexDirection: 'row' }}>
			<CalendarBarButtonScreen/>
			<View style={{ flex: 1 }}>
				<TabView
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={handleIndexChange}
					initialLayout={{ width: layout.width - (layout.width / 7) }}
					lazy={true}
					lazyPreloadDistance={1}
					swipeEnabled={!isWeb}
					commonOptions={commonOptions}
					renderTabBar={renderTabBar}
				/>
			</View>
		</View>
	);
}

