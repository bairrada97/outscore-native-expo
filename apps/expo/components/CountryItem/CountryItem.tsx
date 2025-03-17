'use dom'

import { View } from 'react-native'

import { Text } from '../ui/text'
import { Image } from '../ui/image'
import { memo } from 'react'
import { SvgUri } from 'react-native-svg'
import { cn } from '@/utils/misc'

export interface CountryItemProps {
	image: string
	name: string
	totalMatches: number
	totalLiveMatches?: number
}
export default function CountryItem({
	image,
	name,
	totalMatches,
	totalLiveMatches,
}: CountryItemProps) {
	return (
		<div className="flex h-40 flex-1 flex-row items-center">
			<div className="flex flex-1 flex-row items-center gap-x-16">
				<div className="rounded-1/2 before:rounded-1/2 dark:shadow-sha-06 dark:before:border-neu-10 dark:[[data-state=open]_&]:before:shadow-sha-06 relative box-border flex h-24 w-24 flex-row items-center justify-center shadow-sha-01 will-change-transform before:absolute before:left-1/2 before:top-1/2 before:h-[28px] before:w-[28px] before:-translate-x-1/2 before:-translate-y-1/2 before:border-2 before:border-neu-01 before:content-[''] [[data-state=open]_&]:before:border-m-01--light-03 [[data-state=open]_&]:before:shadow-sha-01">
					<div className="rounded-1/2 before:rounded-1/2 absolute flex h-full w-full flex-row items-center justify-center overflow-hidden before:absolute before:left-[0] before:top-[0] before:z-10 before:h-full before:w-full before:bg-neu-10 before:opacity-[0.08] before:content-['']">
						{/* <Image
								source={{ uri: image }}
								className="h-40 w-40"
								resizeMode="cover"
							/> */}
					</div>
				</div>
				<h2
					// variant="body-01--semi"
					className="dark:text-neu-06 text-left font-semibold text-neu-10 [[data-state=open]_&]:text-neu-01"
				>
					{name}
				</h2>
			</div>

			{/* <CountryDailyMatches
				liveMatchesLength={totalLiveMatches}
				dailyMatchesLength={totalMatches}
			/> */}
		</div>
	)
}

// const StyledCountryItem = styled("div", {
//   display: "grid",
//   alignItems: "center",
//   gridTemplateColumns: "auto 1fr auto",
//   gap: "0 $spacing3",
//   width: "100%",
//   "& .countryItem__image-border": {
//     borderRadius: "50%",
//     boxSizing: "border-box",
//     boxShadow: "$sha-01",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     position: "relative",
//     width: "$sizes4",
//     height: "$sizes4",
//     [`[data-theme="dark"] &`]: {
//       boxShadow: "$sha-06",
//     },

//     "&:before": {
//       content: "",
//       width: "100%",
//       height: "100%",
//       position: "absolute",
//       top: "50%",
//       left: "50%",
//       transform: "translate(-50%, -50%)",
//       border: "2px solid rgb($neu-01)",
//       borderRadius: "50%",
//       [`[data-theme="dark"] &`]: {
//         border: "2px solid rgb($neu-10)",
//       },
//       '[data-state="open"] &': {
//         border: "2px solid rgb($m-01--light-03)",
//         boxShadow: "$sha-01",
//         [`[data-theme="dark"] &`]: {
//           boxShadow: "$sha-06",
//         },
//       },
//     },
//   },
//   "& .countryItem__image": {
//     width: "100%",
//     height: "100%",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     position: "absolute",
//     overflow: "hidden",
//     borderRadius: "50%",

//     "&:before": {
//       content: "",
//       position: "absolute",
//       top: 0,
//       left: 0,
//       width: "100%",
//       height: "100%",
//       background: "rgb($neu-10)",
//       opacity: 0.08,
//       borderRadius: "50%",
//       zIndex: "$1",
//     },

//     "& img": {
//       width: "100%",
//       height: "100%",
//       objectFit: "cover",
//     },
//   },
//   "& .countryItem__matchesLength": {
//     display: "flex",
//     justifyContent: "center",
//     alignItems: "center",
//     gap: "0 $spacing1",
//     color: "rgb($neu-09)",
//     borderRadius: "32px",
//     minWidth: "$sizes4",
//     padding: "0 $spacing2",
//     height: "$sizes4",
//     boxShadow: "inset 0px 0px 0px 1px rgb(240, 241, 241)",
//     boxSizing: "border-box",

//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-01)",
//       boxShadow: "inset 0px 0px 0px 1px rgb(49, 53, 52)",
//     },
//   },
//   "& .countryItem__title": {
//     color: "rgb($neu-10)",
//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-06)",
//     },
//   },
//   "& .countryItem__liveMatchLength": {
//     color: "rgb($neu-01)",
//     background: "rgb($m-01)",
//     boxShadow: "none",

//     [`[data-theme="dark"] &`]: {
//       boxShadow: "none",
//     },
//   },

//   '[data-state="open"] &': {
//     "& .countryItem__matchesLength": {
//       color: "rgb($neu-01)",
//       boxShadow: "inset 0px 0px 0px 1px rgb(240, 241, 241, 0.3)",
//     },
//     "& .countryItem__liveMatchLength": {
//       boxShadow: "none",
//     },
//     "& .countryItem__title": {
//       color: "rgb($neu-01)",
//     },
//   },
// });
