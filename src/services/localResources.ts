export interface LocalResource {
  id: string;
  title: string;
  description: string;
  url: string;
  direct: boolean;
}

const searchLink = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`;

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export async function fetchLocalResources(city: string): Promise<LocalResource[]> {
  const normalizedCity = city.trim();
  const resources: LocalResource[] = [];
  let municipalityUrl: string | null = null;
  let municipalityDirectoryUrl: string | null = null;
  let epciName = "";
  let cityCode = "";

  try {
    const addressUrl = new URL("https://api-adresse.data.gouv.fr/search/");
    addressUrl.searchParams.set("q", normalizedCity);
    addressUrl.searchParams.set("type", "municipality");
    addressUrl.searchParams.set("limit", "1");
    const addressResponse = await fetch(addressUrl, { signal: AbortSignal.timeout(9000) });
    if (addressResponse.ok) {
      const addressData = await addressResponse.json();
      cityCode = addressData.features?.[0]?.properties?.citycode || "";
    }
  } catch { /* The search links below remain useful if geocoding is unavailable. */ }

  if (cityCode) {
    try {
      const apiUrl = new URL("https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records");
      apiUrl.searchParams.set("where", `code_insee_commune LIKE "${cityCode}"`);
      apiUrl.searchParams.set("limit", "100");
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(9000) });
      if (response.ok) {
        const payload = await response.json();
        const municipality = (payload.results || []).find((record: any) => {
          const name = `${record.nom || ""} ${record.pivot || ""}`.toLocaleLowerCase("fr-FR");
          return name.includes("mairie") && (record.code_insee_commune || "").toString().includes(cityCode);
        });
        municipalityUrl = safeHttpUrl(municipality?.site_internet);
        municipalityDirectoryUrl = safeHttpUrl(municipality?.url_service_public);
      }
    } catch { /* Fall back to a targeted official-directory search. */ }

    try {
      const geoUrl = new URL(`https://geo.api.gouv.fr/communes/${encodeURIComponent(cityCode)}`);
      geoUrl.searchParams.set("fields", "nom,code,codeEpci");
      const response = await fetch(geoUrl, { signal: AbortSignal.timeout(7000) });
      if (response.ok) {
        const commune = await response.json();
        if (commune.codeEpci) {
          const epciResponse = await fetch(`https://geo.api.gouv.fr/epcis/${encodeURIComponent(commune.codeEpci)}?fields=nom,code`, { signal: AbortSignal.timeout(7000) });
          if (epciResponse.ok) epciName = (await epciResponse.json()).nom || "";
        }
      }
    } catch { /* EPCI lookup is optional. */ }
  }

  resources.push({
    id: "municipality",
    title: municipalityUrl ? `Site officiel de la mairie de ${normalizedCity}` : municipalityDirectoryUrl ? `Fiche officielle de la mairie de ${normalizedCity}` : `Mairie de ${normalizedCity}`,
    description: municipalityUrl ? "Site de la commune référencé par l’Annuaire de l’administration." : municipalityDirectoryUrl ? "Fiche officielle de la commune dans l’annuaire Service-Public." : "Rechercher le site de la mairie dans l’annuaire officiel.",
    url: municipalityUrl || municipalityDirectoryUrl || searchLink(`site:lannuaire.service-public.gouv.fr mairie ${normalizedCity}`),
    direct: Boolean(municipalityUrl),
  });
  resources.push({
    id: "intercommunal", title: epciName ? `Site de ${epciName}` : "Métropole ou intercommunalité",
    description: epciName ? "Site officiel de l’intercommunalité qui regroupe cette commune." : "Trouver l’intercommunalité compétente pour la commune.",
    url: searchLink(`${epciName ? `"${epciName}"` : normalizedCity} site officiel métropole communauté d’agglomération`), direct: false,
  });
  resources.push({
    id: "transit", title: `Réseaux de transport autour de ${normalizedCity}`,
    description: "Rechercher les réseaux urbains et leurs données ouvertes sur le Point d’Accès National aux données de transport.",
    url: searchLink(`site:transport.data.gouv.fr/datasets "${normalizedCity}" réseau urbain`), direct: false,
  });
  resources.push({
    id: "works", title: `Travaux et projets d’aménagement à ${normalizedCity}`,
    description: "Rechercher les chantiers, projets urbains et informations de circulation publiés par les collectivités locales.",
    url: searchLink(`"${normalizedCity}" mairie métropole travaux voirie projet aménagement`), direct: false,
  });
  resources.push({
    id: "open-data", title: `Données ouvertes de ${normalizedCity}`,
    description: "Jeux de données publiés pour la commune et son territoire.",
    url: `https://www.data.gouv.fr/fr/datasets/?q=${encodeURIComponent(normalizedCity)}`, direct: true,
  });
  return resources;
}
