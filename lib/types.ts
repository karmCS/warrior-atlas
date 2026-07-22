// The Warrior Atlas — shared record types (graph consumed by the frontend).

export interface Media {
  title: string;
  type: string; // normalized: Film | Series | Anime | Manga | Documentary | Game
  country: string; // ISO2 for the flag swatch
}

export interface ArtRecord {
  id: string;
  name: string;
  country: string;
  code: string; // ISO2
  region: string;
  discipline: string; // striking | grappling | weapons
  status: string; // verified | disputed | extinct
  origin: string; // birthplace city
  lat: number;
  lng: number;
  founded: string; // verbatim from frontmatter
  eraLabel: string; // short uppercase display label
  era: string; // filter bucket
  tagline: string;
  history: string; // full prose body
  lineageTo: string[]; // ids this art influenced (directed edge out)
  lineageFrom: string[]; // ids that influenced this art (directed edge in)
  ghostFrom: string[]; // ancestor slugs referenced but not yet mapped (no node)
  ghostTo: string[]; // descendant slugs referenced but not yet mapped
  media: Media[];
}

export interface Graph {
  records: ArtRecord[];
  regions: string[];
  disciplines: { value: string; label: string }[];
  eras: { value: string; label: string }[];
}
