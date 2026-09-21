export type StateOption = {
  code: string;
  name: string;
};

export type CityOption = {
  id: number;
  name: string;
  stateCode: string;
};

export type SelectedCity = CityOption & {
  ibgeCode?: number;
};

export type CurrentCoordinates = {
  latitude: number;
  longitude: number;
};

export type DetectedCity = SelectedCity & CurrentCoordinates;

export type CitySelectionDetail = SelectedCity & Partial<CurrentCoordinates>;

export type LocationSelectionMode = "auto" | "manual";

export const selectedCityStorageKey = "ocalcadao:selected-city";
export const selectedCoordinatesStorageKey = "ocalcadao:current-coordinates";
export const locationSelectionModeStorageKey = "ocalcadao:location-mode";
export const locationRequestHandledSessionKey =
  "ocalcadao:location-request-handled";
export const locationPermissionDeniedSessionKey =
  "ocalcadao:location-permission-denied";
export const locationPermissionDeniedEventName =
  "ocalcadao:location-permission-denied";
export const selectedCityCookieName = "ocalcadao_city_id";
export const selectedCoordinatesCookieName = "ocalcadao_coordinates";
export const cityChangeEventName = "ocalcadao:city-change";

function validCoordinate(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function serializeCoordinatesCookie(coordinates: CurrentCoordinates) {
  if (
    !validCoordinate(coordinates.latitude, -90, 90) ||
    !validCoordinate(coordinates.longitude, -180, 180)
  ) {
    return null;
  }

  return `${coordinates.latitude.toFixed(6)}:${coordinates.longitude.toFixed(6)}`;
}

export function parseCoordinatesCookie(value?: string | null) {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (
    !validCoordinate(latitude, -90, 90) ||
    !validCoordinate(longitude, -180, 180)
  ) {
    return null;
  }

  return { latitude, longitude } satisfies CurrentCoordinates;
}
