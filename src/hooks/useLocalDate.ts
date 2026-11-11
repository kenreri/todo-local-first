import { useSyncExternalStore } from 'react';
import { todayKey } from '../lib/dates';
import { currentMinute, subscribeLocalClock } from '../lib/localClock';

const dateSnapshot = () => todayKey(new Date(currentMinute()));
export function useLocalDate() {
  return useSyncExternalStore(subscribeLocalClock, dateSnapshot);
}
export function useLocalMinute() {
  return useSyncExternalStore(subscribeLocalClock, currentMinute);
}
