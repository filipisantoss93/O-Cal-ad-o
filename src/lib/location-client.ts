import {
  cityChangeEventName,
  selectedCityCookieName,
  selectedCityStorageKey,
  type CurrentCoordinates,
  type DetectedCity,
  type SelectedCity,
} from "@/lib/location";

export function readSelectedCity() {
  try {
    const value = window.localStorage.getItem(selectedCityStorageKey);
    return value ? (JSON.parse(value) as SelectedCity) : null;
  } catch {
    return null;
  }
}
export function saveSelectedCity(
  city: SelectedCity,
  coordinates?: CurrentCoordinates,
) {
  const storedCity: SelectedCity = {
    id: city.id,
    name: city.name,
    stateCode: city.stateCode,
    ...(city.ibgeCode ? { ibgeCode: city.ibgeCode } : {}),
  };
  window.localStorage.setItem(
    selectedCityStorageKey,
    JSON.stringify(storedCity),
  );
  document.cookie = `${selectedCityCookieName}=${storedCity.id}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent(cityChangeEventName, {
      detail: { ...storedCity, ...coordinates },
    }),
  );
}

export async function detectCurrentCity(): Promise<DetectedCity> {
  if (!navigator.geolocation) {
    throw new Error("Este aparelho não oferece acesso à localização.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 300_000,
    });
  }).catch((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      throw new Error("Permita o acesso à localização ou escolha a cidade manualmente.");
    }
    if (error.code === error.TIMEOUT) {
      throw new Error("A localização demorou demais. Tente novamente ou escolha manualmente.");
    }
    throw new Error("Não foi possível obter sua localização atual.");
  });

  const response = await fetch("/api/localizacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }),
  });
  const payload = (await response.json()) as {
    city?: SelectedCity;
    error?: string;
  };

  if (!response.ok || !payload.city) {
    throw new Error(
      payload.error ?? "Não encontramos uma cidade para esta localização.",
    );
  }

  return {
    ...payload.city,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
