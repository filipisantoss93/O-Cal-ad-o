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

export const selectedCityStorageKey = "ocalcadao:selected-city";
export const selectedCityCookieName = "ocalcadao_city_id";
export const cityChangeEventName = "ocalcadao:city-change";
