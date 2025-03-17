import {
	DarkTheme,
	DefaultTheme,
	NavigationContainer,
	ThemeProvider,
} from '@react-navigation/native'

import { useFonts } from 'expo-font'
import { Slot, Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import 'react-native-reanimated'
import React from 'react'

import { useColorScheme } from '@/hooks/useColorScheme'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TimeZoneProvider } from '@/context/timezone-context'
import {
	focusManager,
	QueryClient,
	QueryClientProvider,
} from '@tanstack/react-query'
import { PaperProvider } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppStateStatus, Dimensions } from 'react-native'
import { isWeb } from '@gluestack-ui/nativewind-utils/IsWeb'
import { useOnlineManager } from '@/hooks/useOnlineManager'
import { useAppState } from '@/hooks/useAppState'
import { SourceSansPro_400Regular } from '@expo-google-fonts/source-sans-pro'
import { initializeTimeZone } from '@/utils/store-user-timezone'
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider'
import { Header } from '@/components/Header/Header'
import '../global.css'
import { Heading } from '@/components/ui/heading'
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

function onAppStateChange(status: AppStateStatus) {
	// React Query already supports in web browser refetch on window focus by default
	if (!isWeb) {
		focusManager.setFocused(status === 'active')
	}
}

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: 2 } },
})
export default function RootLayout() {
	useOnlineManager()
	useAppState(onAppStateChange)
	const colorScheme = useColorScheme()

	const [fontsLoaded, fontsError] = useFonts({
		sourceSansPro_regular: SourceSansPro_400Regular,
	})
  

	useEffect(() => {
		if (fontsLoaded || fontsError) {
			SplashScreen.hideAsync()
		}
	}, [fontsLoaded, fontsError])

	if (!fontsLoaded && !fontsError) {
		return null
	}
	return (
		<GestureHandlerRootView
			style={{ flex: 1, maxWidth: 800, margin: 'auto', width: '100%' }}
		>
			<TimeZoneProvider>
				<GluestackUIProvider mode="light">
					<ThemeProvider
						value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
					>
						<QueryClientProvider client={queryClient}>
							<PaperProvider>
								<SafeAreaView
									className="m-auto w-full max-w-[800px]"
									style={{ flex: 1 }}
								>
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
								</SafeAreaView>
							</PaperProvider>
						</QueryClientProvider>
					</ThemeProvider>
				</GluestackUIProvider>
			</TimeZoneProvider>
		</GestureHandlerRootView>
	)
} 
