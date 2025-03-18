import {
	DarkTheme,
	DefaultTheme,
	NavigationContainer,
	ThemeProvider,
} from '@react-navigation/native'

import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import 'react-native-reanimated'
import React from 'react'
import { isSameDay } from 'date-fns'

import { useColorScheme } from '@/hooks/useColorScheme'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TimeZoneProvider, useTimeZone } from '@/context/timezone-context'
import {
	focusManager,
	QueryClient,
	QueryClientProvider,
	QueryCache,
} from '@tanstack/react-query'
import { PaperProvider } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppStateStatus } from 'react-native'
import { isWeb } from '@gluestack-ui/nativewind-utils/IsWeb'
import { useOnlineManager } from '@/hooks/useOnlineManager'
import { useAppState } from '@/hooks/useAppState'
import { SourceSansPro_400Regular } from '@expo-google-fonts/source-sans-pro'
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider'
import { Header } from '@/components/Header/Header'
import '../global.css'
import { Heading } from '@/components/ui/heading'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
	persistQueryClient,
	PersistQueryClientProvider,
} from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { prefetchFixtureData } from '@/queries/prefetch-utils'

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

function onAppStateChange(status: AppStateStatus) {
	// React Query already supports in web browser refetch on window focus by default
	if (!isWeb) {
		focusManager.setFocused(status === 'active')
	}
}

// Setup persistent queries with appropriate defaults
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Keep fetched data in memory for a longer time
			gcTime: 1000 * 60 * 60 * 24, // 24 hours
			// Don't retry forever to avoid excessive API requests
			retry: 2,
			// Keep normal refetch behavior controlled by individual queries
			refetchOnReconnect: true,
			// Add this setting to improve caching behavior
			staleTime: 1000 * 60 * 5, // 5 minutes for most data
		},
	},
})

// Create the persister for AsyncStorage with more robust configuration
const asyncStoragePersister = createAsyncStoragePersister({
	storage: AsyncStorage,
	key: 'outscore-query-cache',
	serialize: data => JSON.stringify(data),
	deserialize: data => JSON.parse(data),
	throttleTime: 500, // Faster persistence
})

// Set up persistence options
const persistOptions = {
	persister: asyncStoragePersister,
	maxAge: 1000 * 60 * 60 * 24 * 3, // Keep persisted data for 3 days
	dehydrateOptions: {
		shouldDehydrateQuery: (query: any) => {
			// Don't persist today's data since it changes frequently
			if (query.queryKey && 
				Array.isArray(query.queryKey) && 
				query.queryKey.length >= 2 && 
				query.queryKey[0] === 'fixtures-by-date') {
				const dateString = query.queryKey[1];
				if (typeof dateString === 'string') {
					return !isSameDay(new Date(dateString), new Date());
				}
			}
			return true; // Persist everything else
		},
	}, 
}

// App content that depends on the TimeZone being loaded
function AppContent() {
	const { timeZone, isLoading } = useTimeZone();
	const [dataLoaded, setDataLoaded] = useState(false);
	const [prefetchStarted, setPrefetchStarted] = useState(false);
	
	// Debug: Check cache on startup
	useEffect(() => {
		const debugCacheState = async () => {
			try {
				const cacheData = await AsyncStorage.getItem('outscore-query-cache');
				if (cacheData) {
					console.log('Found cached data in AsyncStorage');
					
					// Check if cache contains fixture data
					const parsedCache = JSON.parse(cacheData);
					const queryKeys = Object.keys(parsedCache.clientState.queries || {});
					const fixtureQueries = queryKeys.filter(key => key.includes('fixtures-by-date'));
					
					console.log(`Cache contains ${fixtureQueries.length} fixture queries`);
					fixtureQueries.forEach(key => {
						console.log(`- Cached query: ${key}`);
					});
				} else {
					console.log('No cache data found in AsyncStorage');
				}
			} catch (error) {
				console.error('Error checking cache:', error);
			}
		};
		
		debugCacheState();
	}, []);
	
	// Prefetch data only once after timezone is loaded
	useEffect(() => {
		if (!isLoading && timeZone && !prefetchStarted) {
			setPrefetchStarted(true);
			console.log("TimeZone loaded, prefetching with timezone:", timeZone);
			
			prefetchFixtureData(queryClient).then(success => {
				console.log("Prefetch completed with timezone:", timeZone);
				setDataLoaded(success);
			}).catch(error => {
				console.error("Prefetch error:", error);
				// Still mark as loaded to prevent app from hanging
				setDataLoaded(true);
			});
		}
	}, [isLoading, timeZone, prefetchStarted]);
	
	// Hide splash screen when ready
	useEffect(() => {
		if (dataLoaded && !isLoading) {
			SplashScreen.hideAsync();
		}
	}, [dataLoaded, isLoading]);
	
	if (isLoading || !dataLoaded) {
		return null;
	}
	
	return (
		<Stack>
			<Stack.Screen
				name="(tabs)"
				options={{
					header: ({ route }) => (
						<Header
							classNames="sticky z-[9999]"
							innerContainerClassName=" justify-between"
						>
							<Heading variant="title-01" className="text-neu-01">
								Football Matches
							</Heading>
							<Header.RightIcons>
								<></>
							</Header.RightIcons>
						</Header>
					),
				}}
			/>
			<Stack.Screen name="+not-found" />
		</Stack>
	);
}

export default function RootLayout() {
	useOnlineManager()
	useAppState(onAppStateChange)
	const colorScheme = useColorScheme()

	const [fontsLoaded, fontsError] = useFonts({
		sourceSansPro_regular: SourceSansPro_400Regular,
	})

	// Show splash screen until fonts are loaded
	useEffect(() => {
		if (fontsLoaded || fontsError) {
			// Note: The splash screen will be hidden in AppContent when data is loaded
			console.log("Fonts loaded, waiting for data to load...");
		}
	}, [fontsLoaded, fontsError])

	if (!fontsLoaded && !fontsError) {
		return null;
	}
	
	return (
		<PersistQueryClientProvider
			client={queryClient}
			persistOptions={persistOptions}
		>
			<GestureHandlerRootView
				style={{ flex: 1, maxWidth: 800, margin: 'auto', width: '100%' }}
			>
				<TimeZoneProvider>
					<GluestackUIProvider mode="light">
						<ThemeProvider
							value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
						>
							<PaperProvider>
								<SafeAreaView
									className="m-auto w-full max-w-[800px]"
									style={{ flex: 1 }}
								>
									<AppContent />
								</SafeAreaView>
							</PaperProvider>
						</ThemeProvider>
					</GluestackUIProvider>
				</TimeZoneProvider>
			</GestureHandlerRootView>
		</PersistQueryClientProvider>
	)
}  
