// const favoriteMatchesAtom = focusAtom(userPreferencesState, (optic) =>
//   optic.prop("favorite_matches")
// );
// const favoriteTeamsAtom = focusAtom(userPreferencesState, (optic) =>
//   optic.prop("favorite_teams")
// );

import { useDelay } from "@/hooks/useDelay";
import { useFixtureStatus } from "@/hooks/useFixtureStatus";
import usePrevious from "@/hooks/usePrevious";
import {
  FIXTURE_IS_FINISHED_STATUS,
  FIXTURE_IS_LIVE_STATUS,
} from "@/utils/fixturesStatusConstants";
import { cn } from "@/utils/misc";
import { transformFixtureData } from "@/utils/transform-fixture-data";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FixtureStatus } from "../FixtureStatus/FixtureStatus";
import { FixtureTeam } from "../FixtureTeam/FixtureTeam";
import { Pressable, TouchableOpacity, View } from "react-native";
import { Text } from "../ui/text";
import SvgB004 from "../ui/SvgIcons/B004";
import { FavoritesIcon } from "../FavoritesIcon/FavoritesIcon";

// const globalUserPreferencesAtom = atom(
//   (get) => get(userPreferencesState).notification_settings
// );

const cardMatch = tva({
  base: ".cardMatch",
  variants: {
    isMatchLive: {
      true: [
        'before:content-[""]',
        "before:absolute",
        "before:top-[calc(50%_/_48px_/_2)]",
        "before:left-[6px]",
        "before:bg-m-01--light-03",
        "before:h-48",
        "before:w-[2px]",
        "before:rounded-[4px]",
        "before:z-[0]",
      ],
    },
  },
});

export interface CardMatchProps {
  fixture: transformFixtureData;
  type?: "H2H" | "favorite-team" | null;
  matchOutcome?: MatchOutcomeType | null;
  shouldPrefetch?: boolean;
  isLastMatch: boolean;
}

export const CardMatch = ({
  fixture,
  type = null,
  matchOutcome = null,
  shouldPrefetch = true,
  isLastMatch,
}: CardMatchProps) => {
  // const [notificationBarMessage, showNotificationBarMessage] = useState<
  // 	string | null
  // >(null)
  // const [notificationBarShowed, showNotificationBar] = useState(false)
  const [, setPopupOpen] = useState(false);
  // const [openInstallAppAdvice, setOpenInstallAppAdvice] = useState(false)

  // const [userClickedFavorites, setUserClickedFavorites] = useAtom(
  //   userClickedFavoritesAtom
  // );
  // const [favoriteMatches, setFavoriteMatchesAtom] = useAtom(favoriteMatchesAtom)

  // const [favoriteTeams, setFavoriteTeams] = useAtom(favoriteTeamsAtom)
  // const [userPreferencesId, setUserPreferencesId] = useAtom(
  // 	userPreferencesIdAtom,
  // )

  // const [userPreferences, setUserPreferencesStore] =
  // 	useAtom(userPreferencesState)
  // const [globalUserPreferences] = useAtom(globalUserPreferencesAtom)
  const { status, teams, score, goals, timestamp, date, id } = fixture;

  const [statusState, setStatus] = useState<string | null>(null);
  const [teamScored, setTeamScore] = useState({
    home: false,
    away: false,
  });

  const { renderFixtureStatus, fixtureStatus } = useFixtureStatus({
    status,
    date,
    type,
    timezone: fixture.timezone,
  });

  const delay = useDelay();

  const TIME_TO_RESET_GOAL_STYLES = 60_000; //1 minute;

  const homeTeamGoals = score.penalty.home || goals.home;
  const awayTeamGoals = score.penalty.away || goals.away;
  const matchCurrentTime = status?.elapsed;
  const notH2H = type != "H2H";

  const goalScored = async () => {
    if (!previousState) return;
    setValues();
    await delay(TIME_TO_RESET_GOAL_STYLES);
    resetValues();
  };

  const previousState = usePrevious({
    homeTeamGoals,
    awayTeamGoals,
    matchCurrentTime,
  });

  const setValues = () => {
    if (awayTeamGoals! > previousState?.awayTeamGoals! || null) {
      setTeamScore({ home: false, away: true });
    }
    if (homeTeamGoals! > previousState?.homeTeamGoals! || null) {
      setTeamScore({ home: true, away: false });
    }
  };

  const resetValues = () => {
    setTeamScore({
      home: false,
      away: false,
    });
  };

  // const toggleMatchToFavorites = async (id: number) => {
  // 	let favoritesArray = favoriteMatches
  // 	let favoritesMatchesIds = favoritesArray.map(match => match.match_id)
  // 	const updatedNotificationSettings =
  // 		userPreferences.notification_settings.map(item => {
  // 			return JSON.parse(JSON.stringify(item))
  // 		}) as UserNotificationPreferences['notification_settings']
  // 	if (favoritesMatchesIds.includes(id)) {
  // 		favoritesMatchesIds = deleteFavoriteMatch(favoritesMatchesIds, id)
  // 		favoritesArray = favoritesArray.filter(match =>
  // 			favoritesMatchesIds.includes(match.match_id),
  // 		)
  // 		//  showNotificationBar(true);
  // 		//  showNotificationBarMessage(NOTIFICATION_BAR_MATCH_REMOVED);
  // 		//  setTimeout(() => {
  // 		//    showNotificationBar(false);
  // 		//  }, NOTIFICATION_BAR_SHOWED_TIMER);
  // 	} else {
  // 		//  if (!favoritesMatchesIds.length) {
  // 		//    OneSignalReact.showNativePrompt();
  // 		//  }

  // 		favoritesArray.push({
  // 			alerts: updatedNotificationSettings,
  // 			addedFrom: 'match',
  // 			match_id: id,
  // 		})

  // 		// showNotificationBar(true)
  // 		// showNotificationBarMessage(NOTIFICATION_BAR_MATCH_ADDED)
  // 		// setUserClickedFavorites(true)

  // 		// setTimeout(() => {
  // 		// 	showNotificationBar(false)
  // 		// }, NOTIFICATION_BAR_SHOWED_TIMER)
  // 	}

  // 	let userNotificationPreferences: UserNotificationPreferences
  // 	setFavoriteMatchesAtom(favoritesArray)
  // 	setFavoriteTeams(favoriteTeams)

  // 	userNotificationPreferences = {
  // 		//user_id: await OneSignalReact.getUserId(),
  // 		user_id: '',
  // 		notification_settings: updatedNotificationSettings,
  // 		favorite_matches: favoritesArray,
  // 		favorite_teams: favoriteTeams,
  // 	}

  // 	setUserPreferencesStore(userNotificationPreferences)
  // 	//  addUserNotificationPreferencesToDB(userNotificationPreferences);
  // }

  useMemo(() => {
    setStatus(renderFixtureStatus()!);
  }, [status, timestamp, type]);

  useEffect(() => {
    goalScored();

    return () => {
      resetValues();
    };
  }, [homeTeamGoals, awayTeamGoals, matchCurrentTime]);

  const url = `/match/${id}/${teams.home
    .name!.toLowerCase()
    .replace("/", "")
    .split(" ")
    .join("-")}-vs-${teams.away
    .name!.toLowerCase()
    .replace("/", "")
    .split(" ")
    .join("-")}`;

  return (
    <Link href={url} className="h-64 font-sourceSansPro text-16" asChild>
      <Pressable>
        <View
          className={cn(
            "dark:text-neu-04 cardMatch relative box-border flex flex-1 flex-row items-center gap-x-8 px-16",
            !isLastMatch ? "border-b-[1px] border-neu-04" : "",
          )}
        >
          {fixtureStatus.isLive && (
            <View className="absolute left-[6px] top-[calc(50%-48px/2)] z-10 h-48 w-[2px] rounded-[4px] bg-m-01--light-03" />
          )}

          {(teamScored.home || teamScored.away) && (
            <View
              className={cn(
                "",
                teamScored.home || teamScored.away
                  ? "absolute left-4 top-4 h-[calc(100%_-_8px)] w-[calc(100%_-_8px)] rounded-[4px] bg-m-01--light-02 opacity-[0.1]"
                  : "",
              )}
            ></View>
          )}
          <FixtureStatus
            status={statusState!}
            matchIsLiveOrFinished={
              FIXTURE_IS_LIVE_STATUS.includes(fixture.status?.short!) ||
              (FIXTURE_IS_FINISHED_STATUS.includes(fixture.status?.short!) &&
                notH2H)
            }
          />

          <View className="flex min-w-0 flex-1 flex-col gap-y-4 self-center">
            <FixtureTeam
              isGoal={teamScored.home}
              score={homeTeamGoals!}
              name={teams.home.name!}
              winner={
                FIXTURE_IS_FINISHED_STATUS.includes(statusState!) &&
                teams.home.winner!
              }
            />
            <FixtureTeam
              isGoal={teamScored.away}
              score={awayTeamGoals!}
              name={teams.away.name!}
              winner={
                FIXTURE_IS_FINISHED_STATUS.includes(statusState!) &&
                teams.away.winner!
              }
            />
          </View>
          {notH2H && (
            <>
              <FavoritesIcon
                handlePress={(e: MouseEvent) => {
                  e.preventDefault();
                  // toggleMatchToFavorites(id!);
                }}
                isActive={
                  // !!isMatchInFavorites({ favoriteMatches, matchId: id! })
                  false
                }
              />

              <Pressable
                className=""
                onPress={(e) => {
                  e.preventDefault();
                  setPopupOpen(true);
                }}
              >
                <SvgB004
                  width={24}
                  height={24}
                  aria-label="View More Icon"
                  className="z-70 dark:text-neu-04 ml-8 text-neu-07"
                />
              </Pressable>
            </>
          )}
          {/* Additional commented code remains unchanged */}
        </View>
      </Pressable>
    </Link>
  );
};

// const StyledCardMatch = styled(Link, {
//   display: "grid",
//   gridTemplateColumns: "$sizes6 1fr auto auto",
//   alignItems: "center",
//   gap: "0 $spacing2",
//   height: "$sizes9",
//   boxSizing: "border-box",
//   color: "inherit",
//   position: "relative",
//   padding: "0 $spacing3",
//   [`[data-theme="dark"] &`]: {
//     color: "rgb($neu-04)",
//   },

//   "&:not(last-of-type)": {
//     "&:after": {
//       content: "",
//       position: "absolute",
//       bottom: "0",
//       left: "50%",
//       transform: "translateX(-50%)",
//       background: "rgb($neu-04)",
//       height: "1px",
//       width: "calc(100% - $sizes3)",
//       [`[data-theme="dark"] &`]: {
//         background: "rgb($neu-12)",
//       },
//     },
//   },
//   "& .cardMatch__teamsContainer": {
//     display: "flex",
//     flexDirection: "column",
//     gap: "$spacing1 0",
//     minWidth: "0",
//     width: "100%",
//   },
//   "& .favoriteIcon": {
//     color: "rgb($neu-06)",
//     zIndex: "9",
//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-08)",
//     },
//     "&.isFavorite": {
//       "&:before": {
//         content: "",
//         position: "absolute",
//         top: "50%",
//         transform: "translateY(-50%)",
//         linearGradient: "gra-02",
//         height: "100%",
//         width: "100%",
//         zIndex: "0",
//       },
//     },
//   },
//   "& .viewMoreIcon": {
//     color: "rgb($neu-07)",
//     zIndex: "9",
//     marginLeft: "$spacing2",
//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-04)",
//     },
//   },

//   "& .isGoal": {
//     position: "absolute",
//     top: "4px",
//     left: "4px",
//     width: "calc(100% - 8px)",
//     height: "calc(100% - 8px)",
//     backgroundColor: "rgb($m-01--light-02)",
//     opacity: 0.1,
//     borderRadius: "4px",
//     [`[data-theme="dark"] &`]: {
//       backgroundColor: "rgb($m-01--light-04)",
//     },
//   },

//   variants: {
//     isMatchLive: {
//       true: {
//         "&:before": {
//           content: "",
//           position: "absolute",
//           top: "calc(50% - 48px / 2)",
//           left: "6px",
//           background: "rgb($m-01--light-03)",
//           height: "$sizes7",
//           width: "2px",
//           borderRadius: "4px",
//           zIndex: "0",
//         },
//       },
//     },
//   },
// });
