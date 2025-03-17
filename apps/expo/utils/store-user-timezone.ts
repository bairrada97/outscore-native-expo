import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { DEFAULT_TIMEZONE } from './constants';
const TIMEZONE_KEY = 'userTimeZone';

export async function storeTimeZone() {
  const { timeZone } = Localization.getCalendars()[0];
  console.log(Localization)
  try {
   
    return await AsyncStorage.setItem(TIMEZONE_KEY, timeZone || DEFAULT_TIMEZONE);
    
  } catch (error) {
    return DEFAULT_TIMEZONE
    console.error('Failed to store the time zone', error);
  }
}
export async function getStoredTimeZone() {
  try {
    const timeZone = await AsyncStorage.getItem(TIMEZONE_KEY);
    if (timeZone !== null) {
      console.log('Stored Time Zone:', timeZone);
      return timeZone
    } else {
      console.log('No time zone found');
      
    }
  } catch (error) {
    console.error('Failed to retrieve the time zone', error);
  }
}

export async function initializeTimeZone() {
  let timeZone = await getStoredTimeZone();
  console.log(Localization.getCalendars()[0].timeZone)
  if (!timeZone) {
    const timezone = await storeTimeZone();
    timeZone = timezone!
  }

  return timeZone;
}