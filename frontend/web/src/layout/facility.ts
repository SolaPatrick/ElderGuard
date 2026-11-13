import { useSettings } from '../api/queries';

/** Used until the settings load, and on a server that has no settings yet. */
export const FACILITY_NAME = 'Demo Home for the Aged';

/** The facility name from Settings (SET-01), shown in the top bar and on printed reports. */
export function useFacilityName(): string {
  return useSettings().data?.general.facilityName ?? FACILITY_NAME;
}
