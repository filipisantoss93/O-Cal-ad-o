export function localSeoSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function citySeoSlug(name: string, stateCode: string) {
  return `${localSeoSlug(name)}-${stateCode.toLocaleLowerCase("pt-BR")}`;
}

export function parseCitySeoSlug(value: string) {
  const decoded = decodeURIComponent(value).trim().toLocaleLowerCase("pt-BR");
  const match = decoded.match(/^(.+)-([a-z]{2})$/);
  if (!match) return null;
  return {
    citySlug: match[1],
    stateCode: match[2].toUpperCase(),
  };
}
