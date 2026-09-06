import {
  cityChangeEventName,
  selectedCityCookieName,
  selectedCityStorageKey,
  selectedCoordinatesStorageKey,
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
  if (coordinates) {
    window.sessionStorage.setItem(
      selectedCoordinatesStorageKey,
      JSON.stringify(coordinates),
    );
  } else {
    window.sessionStorage.removeItem(selectedCoordinatesStorageKey);
  }
  document.cookie = `${selectedCityCookieName}=${storedCity.id}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent(cityChangeEventName, {
      detail: { ...storedCity, ...coordinates },
    }),
  );
}

export async function detectCurrentCity(): Promise<DetectedCity> {
  if (!window.isSecureContext) {
    throw new Error(
      "A localização só funciona em uma conexão segura (HTTPS).",
    );
  }

  if (!navigator.geolocation) {
    throw new Error("Este aparelho não oferece acesso à localização.");
  }

  const getPosition = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  let position: GeolocationPosition;
  try {
    // A leitura aproximada costuma responder mais rápido no Safari do iPhone e
    // já é suficiente para identificar município e ordenar lojas próximas.
    position = await getPosition({
      enableHighAccuracy: false,
      timeout: 20_000,
      maximumAge: 300_000,
    });
  } catch (firstError) {
    const error = firstError as GeolocationPositionError;
    if (error.code === error.PERMISSION_DENIED) {
      throw new Error(
        "O navegador bloqueou a localização deste site. No iPhone, abra as configurações deste site, permita Localização e recarregue a página.",
      );
    }

    try {
      // Se a leitura aproximada estiver indisponível ou expirar, fazemos uma
      // segunda tentativa sem cache e com mais tempo para o GPS responder.
      position = await getPosition({
        enableHighAccuracy: true,
        timeout: 30_000,
        maximumAge: 0,
      });
    } catch (secondError) {
      const retryError = secondError as GeolocationPositionError;
      if (retryError.code === retryError.PERMISSION_DENIED) {
        throw new Error(
          "O navegador bloqueou a localização deste site. No iPhone, abra as configurações deste site, permita Localização e recarregue a página.",
        );
      }
      if (retryError.code === retryError.TIMEOUT) {
        throw new Error(
          "O GPS demorou para responder. Vá para um local com sinal e tente novamente.",
        );
      }
      throw new Error(
        "O aparelho não conseguiu obter a localização. Ative a Localização Precisa e tente novamente.",
      );
    }
  }

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
