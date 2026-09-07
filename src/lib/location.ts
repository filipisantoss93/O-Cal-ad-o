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
export const selectedCityCookieName = "ocalcadao_city_id";
export const cityChangeEventName = "ocalcadao:city-change";
