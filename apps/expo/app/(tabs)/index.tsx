import {Dimensions, useWindowDimensions, View } from 'react-native'

import { ReactNode, useEffect, useState } from 'react'
import { TabView, SceneMap, TabBarProps, Route, TabBar } from 'react-native-tab-view';
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
	
	const tabs = [
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
	];
	
	const [routes] = useState(tabs)

	const renderScene = SceneMap(
		routes.reduce<Record<string, () => ReactNode>>((scenes, route) => {
			scenes[route.key] = () => {
				if (route.key === 'tab-live') {
					return <FixturesHomeScreen day="live" />
				} else {
					// Format date to 'yyyy-MM-dd' for the fixture query
					const formattedDate = route.date ? format(route.date, 'yyyy-MM-dd') : ''
					return <FixturesHomeScreen day={formattedDate} />
				}
			}
			return scenes;
		}, {})
	);

  return (
	<View style={{ height: "100%", flexDirection: 'row' }}>
		<CalendarBarButtonScreen/>
    
      <View style={{ flex: 1 }}>
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={(index) => {
            setIndex(index)
            if (index === 5) {
              router.setParams({date: "live"});
            } else {
              const selectedDate = dates[index];
              router.setParams({date: format(selectedDate, 'yyyy-MM-dd')});
            }
          }}
          initialLayout={{ width: layout.width - (layout.width / 7) }}
          lazy={true}
          lazyPreloadDistance={1}
          swipeEnabled={!isWeb}
		  
          commonOptions={{
            icon: ({ route, focused, color }) => {
              if(route.title === LIVE_BUTTON_LABEL) {
                return <SvgB021
                  width={24}
                  height={24}
                  className={focused ? 'text-neu-01' : 'text-m-01'}
                  color={focused ? 'white' : 'rgb(24,124,86)'}
                />
              } else {
                return <Text
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
              }
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
          }}
          renderTabBar={props => (
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
                width: (isWeb ? 800 : layout.width) / 7 ,
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
          )}
        />
      </View>
    </View>
   
  );
}

