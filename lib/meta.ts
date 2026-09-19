// The Warrior Atlas — curated per-record metadata + normalizers.
//
// The content/arts/*.md frontmatter carries the *facts* (name, country, lat/lng,
// founded, lineage, influenced, notable_media). The design surfaces a few extra
// display dimensions the frontmatter does not encode — region, discipline, status,
// birthplace city, ISO code, a compact era label, and a punchy tagline. Those are
// curated here, keyed by file id, and merged in at build. Keep this in sync when
// arts are added to content/arts/.

export interface ArtMeta {
  region: string;
  discipline: 'striking' | 'grappling' | 'weapons';
  status: 'verified' | 'disputed' | 'extinct';
  origin: string;
  code: string; // ISO2
  eraLabel: string;
  era: string; // filter bucket
  tagline: string;
  video?: string; // YouTube video id for the dossier clip embed
  videoStart?: number; // optional clip start offset, seconds
}

export const ART_META: Record<string, ArtMeta> = {
  arnis: { region: 'SE Asia', discipline: 'weapons', status: 'disputed', origin: 'Cebu City', code: 'PH', eraLabel: '17TH C. (ATTESTED)', era: '1600s', tagline: 'Blade logic drilled with rattan — a national art by law, documented in Cebu.', video: 'Xsxlw8251WA' },
  bjj: { region: 'S America', discipline: 'grappling', status: 'verified', origin: 'Rio de Janeiro', code: 'BR', eraLabel: 'EST. 1925', era: '1900s', tagline: 'The ground is the great equalizer — Kodokan judo, reworked in Rio.', video: 'm6V48jZq7vM' },
  boxing: { region: 'Europe', discipline: 'striking', status: 'verified', origin: 'London', code: 'GB', eraLabel: 'EST. 1867', era: '1800s', tagline: 'The codified science of the fist, gloved in Victorian England.', video: 'wvYrvXEvnhc', videoStart: 233 },
  capoeira: { region: 'S America', discipline: 'striking', status: 'verified', origin: 'Salvador, Bahia', code: 'BR', eraLabel: '16TH–19TH C.', era: '1600s', tagline: 'A fight disguised as a dance, forged by the enslaved of Bahia.', video: 'poOmLEf8el8' },
  'chinese-martial-arts': { region: 'East Asia', discipline: 'striking', status: 'disputed', origin: 'Beijing', code: 'CN', eraLabel: '5TH C. BC (ATTESTED)', era: 'ancient', tagline: 'Not one art but hundreds — renamed guoshu in 1928, wushu in the 1950s.', video: 'ACSxPTgmPBA' },
  'jeet-kune-do': { region: 'N America', discipline: 'striking', status: 'disputed', origin: 'Los Angeles', code: 'US', eraLabel: 'EST. 1967', era: '1900s', tagline: 'Absorb what is useful. Discard the rest.', video: 'rNkAZObltog' },
  judo: { region: 'East Asia', discipline: 'grappling', status: 'verified', origin: 'Tokyo', code: 'JP', eraLabel: 'EST. 1882', era: '1800s', tagline: 'Maximum efficiency, minimum effort.', video: 'yws-sP342Ik' },
  karate: { region: 'East Asia', discipline: 'striking', status: 'disputed', origin: 'Naha, Okinawa', code: 'JP', eraLabel: 'EARLY 20TH C.', era: '1900s', tagline: 'Empty hand — Okinawa’s answer, half native te, half Chinese fist.', video: 'IOm9g6-EHys' },
  'karate-goju-ryu': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Naha, Okinawa', code: 'JP', eraLabel: 'EST. 1929', era: '1900s', tagline: 'Hard and soft — Naha-te breathing made into a school.', video: 'hr_vrHsnemg' },
  'karate-kyokushin': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Tokyo', code: 'JP', eraLabel: 'EST. 1964', era: '1900s', tagline: 'Full contact, no apology. Knockdown karate.', video: 'G7DUtn9r5vk' },
  'karate-shito-ryu': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Osaka', code: 'JP', eraLabel: 'EST. 1931', era: '1900s', tagline: 'Shuri speed and Naha power, kept in one syllabus.', video: 'zWDwx7Mbjl8' },
  'karate-shotokan': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Tokyo', code: 'JP', eraLabel: 'EST. 1928', era: '1900s', tagline: 'Long stances, straight lines — karate’s most-taught form.', video: 'fTWciJZw6rI' },
  'karate-wado-ryu': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Tokyo', code: 'JP', eraLabel: 'EST. 1934', era: '1900s', tagline: 'Karate softened by jujutsu evasion — the way of harmony.', video: 'AZn0yEnFVPI' },
  'kickboxing-japan': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Osaka', code: 'JP', eraLabel: 'EST. 1966', era: '1900s', tagline: 'Karate that stopped pulling its punches, cut with Muay Thai.', video: 'h2POthcN474' },
  'kickboxing-usa': { region: 'N America', discipline: 'striking', status: 'verified', origin: 'Long Beach, CA', code: 'US', eraLabel: 'EST. 1970', era: '1900s', tagline: 'Point karate steps into a boxing ring, gloves on.', video: 'LyJXiD7f5Dc' },
  kudo: { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Sendai', code: 'JP', eraLabel: 'EST. 1981', era: '1900s', tagline: 'Karate, judo and the clinch in one full-contact art.', video: 'yGzbzii94AI', videoStart: 118 },
  'muay-thai': { region: 'SE Asia', discipline: 'striking', status: 'verified', origin: 'Bangkok', code: 'TH', eraLabel: '18TH C.', era: '1700s', tagline: 'The art of eight limbs — fists, elbows, knees, shins.', video: 'xNsKsOKScmE' },
  sambo: { region: 'Europe', discipline: 'grappling', status: 'verified', origin: 'Moscow', code: 'RU', eraLabel: 'EST. 1938', era: '1900s', tagline: 'The Red Army’s grappling, drilled from judo and folk wrestling.', video: 'SlYomy4fZzo' },
  'silat-indonesia': { region: 'SE Asia', discipline: 'striking', status: 'disputed', origin: 'West Sumatra', code: 'ID', eraLabel: '6TH C. (TRAD.)', era: 'ancient', tagline: 'Low stances, sudden angles, hidden blades — origins disputed with Malaysia.', video: 'hwZ1G9fKPI8', videoStart: 188 },
  'taekwondo-itf': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Seoul', code: 'KR', eraLabel: 'EST. 1966', era: '1900s', tagline: 'The way of the fist and the foot — Korea’s high kick.', video: 'gmCUToIFTTI', videoStart: 119 },
  'taekwondo-wtf': { region: 'East Asia', discipline: 'striking', status: 'verified', origin: 'Seoul', code: 'KR', eraLabel: 'EST. 1973', era: '1900s', tagline: 'Olympic taekwondo — sport kicking, refined at the Kukkiwon.', video: 'bLcLjZr_L5U' },
  'wing-chun': { region: 'East Asia', discipline: 'striking', status: 'disputed', origin: 'Foshan, Guangdong', code: 'CN', eraLabel: '18TH C. (LEGEND)', era: '1700s', tagline: 'Close-range southern kung fu built on centerline control.', video: 'Kv9ygN2B8WU' },
  wrestling: { region: 'Europe', discipline: 'grappling', status: 'verified', origin: 'Caucasus', code: 'RU', eraLabel: 'PREHISTORIC', era: 'ancient', tagline: 'No founder, no homeland — humanity’s oldest contest.', video: '0q4-YtB2eFU' },
};

// Fallback for any art missing from ART_META (keeps the build resilient).
export const DEFAULT_META: ArtMeta = {
  region: 'Unknown', discipline: 'striking', status: 'verified', origin: '', code: '',
  eraLabel: '', era: 'ancient', tagline: '', video: '',
};

// notable_media `type` (frontmatter) → normalized display type.
const MEDIA_TYPE: Record<string, string> = {
  film: 'Film', movie: 'Film',
  tv: 'Series', series: 'Series',
  anime: 'Anime',
  manga: 'Manga',
  'anime/manga': 'Anime',
  documentary: 'Documentary', doc: 'Documentary',
  game: 'Game',
};

export function normalizeMediaType(t: string): string {
  const key = String(t || '').trim().toLowerCase();
  return MEDIA_TYPE[key] || (key ? key[0].toUpperCase() + key.slice(1) : 'Film');
}

// Lucide glyph for a media poster placeholder, by normalized type.
export function mediaIcon(type: string): string {
  switch (type) {
    case 'Series': return 'tv';
    case 'Anime': return 'tv';
    case 'Manga': return 'book-open';
    case 'Documentary': return 'clapperboard';
    case 'Game': return 'gamepad-2';
    default: return 'film';
  }
}

// notable_media `origin_country` (full name) → ISO2 for the flag swatch.
const COUNTRY_ISO: Record<string, string> = {
  'united states': 'US', 'usa': 'US', 'united states of america': 'US',
  'japan': 'JP', 'thailand': 'TH', 'south korea': 'KR', 'korea': 'KR',
  'hong kong': 'HK', 'china': 'CN', 'indonesia': 'ID', 'malaysia': 'MY',
  'brazil': 'BR', 'united kingdom': 'GB', 'england': 'GB', 'britain': 'GB',
  'russia': 'RU', 'soviet union': 'RU', 'france': 'FR', 'india': 'IN',
  'philippines': 'PH', 'greece': 'GR',
};

export function countryToIso(name: string): string {
  return COUNTRY_ISO[String(name || '').trim().toLowerCase()] || '';
}

// Era filter option labels (design vocabulary), rendered only for buckets present.
export const ERA_LABELS: Record<string, string> = {
  ancient: 'Ancient — pre-1400',
  '1400s': '1400s',
  '1500s': '1500s',
  '1600s': '1600s',
  '1700s': '1700s',
  '1800s': '1800s',
  '1900s': '1900s — modern',
};

export const ERA_ORDER = ['ancient', '1400s', '1500s', '1600s', '1700s', '1800s', '1900s'];

export const DISCIPLINE_LABELS: Record<string, string> = {
  striking: 'Striking', grappling: 'Grappling', weapons: 'Weapons',
};
