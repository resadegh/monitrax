/**
 * Phase 52 — curated AU merchant seed for the categorisation KB (build 52.4 / 52.4.1).
 *
 * Pre-loads well-known Australian merchants so the shared KB has graduated,
 * trusted defaults on day one (before user votes accumulate) — making the READ
 * path immediately useful. Seeds are `source: SEED`, `isGlobal: true` (curated,
 * not subject to k-anonymity), and are corrected over time if the community
 * sustainedly disagrees.
 *
 * Names are written in **bank-feed-normalised form** (uppercase, no punctuation)
 * to maximise exact-match hit-rate; the fuzzy tail ("WW METRO" → "WOOLWORTHS")
 * is the embeddings upgrade (52.5). `level1`/`level2` MUST be valid entries in
 * `CATEGORY_HIERARCHY` (asserted by the seed validity test); patterns must be
 * unique after scrubbing (also asserted).
 *
 * Curation provenance (52.4.1): hand-curated from public knowledge of Australian
 * retail brands. Per the 2026-06-22 dataset research, no open licence-clean
 * AU-bank-feed merchant→category dataset exists; curation gives the cleanest,
 * highest-precision seed. (HF `mitulshah/transaction-categorization` (MIT) +
 * MCC `greggles/mcc-codes` (Unlicense) remain available for future bulk/fallback
 * expansion — see PHASE_52 §7.)
 *
 * Note: the scrubber STRIPS some generic tokens (e.g. "australia"), so a few
 * multi-word brands reduce to their distinctive token (e.g. "VIRGIN AUSTRALIA" →
 * "VIRGIN") — intentional and matches how those render after scrubbing.
 */

export interface MerchantSeed {
  merchant: string; // bank-feed-style; run through scrubToSignature at seed time
  level1: string;
  level2: string;
}

export const AU_MERCHANT_SEEDS: MerchantSeed[] = [
  // ── Food & Dining ─────────────────────────────────────────────────────────
  // Groceries
  { merchant: 'WOOLWORTHS', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'COLES', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'ALDI', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'IGA', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'COSTCO', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'HARRIS FARM', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'FOODLAND', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'FOODWORKS', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'DRAKES', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'RITCHIES', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'SPUDSHED', level1: 'Food & Dining', level2: 'Groceries' },
  // Fast Food
  { merchant: 'MCDONALDS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'KFC', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'HUNGRY JACKS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'SUBWAY', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'DOMINOS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'PIZZA HUT', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'RED ROOSTER', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'OPORTO', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'NANDOS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'GUZMAN Y GOMEZ', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'GRILLD', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'ZAMBRERO', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'MAD MEX', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'SCHNITZ', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'ROLLD', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'BETTYS BURGERS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'SUSHI HUB', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'BOOST JUICE', level1: 'Food & Dining', level2: 'Fast Food' },
  // Coffee & Cafes
  { merchant: 'GLORIA JEANS', level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  { merchant: 'THE COFFEE CLUB', level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  { merchant: 'STARBUCKS', level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  { merchant: 'MUFFIN BREAK', level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  { merchant: 'ZARRAFFAS', level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  { merchant: 'CHATIME', level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  { merchant: 'DONUT KING', level1: 'Food & Dining', level2: 'Coffee & Cafes' },
  // Alcohol & Bars
  { merchant: 'DAN MURPHYS', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  { merchant: 'BWS', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  { merchant: 'LIQUORLAND', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  { merchant: 'FIRST CHOICE LIQUOR', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  { merchant: 'VINTAGE CELLARS', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  { merchant: 'CELLARBRATIONS', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  // Food Delivery
  { merchant: 'UBER EATS', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'MENULOG', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'DOORDASH', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'DELIVEROO', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'HELLOFRESH', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'MARLEY SPOON', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'YOUFOODZ', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'LITE N EASY', level1: 'Food & Dining', level2: 'Food Delivery' },

  // ── Transport ─────────────────────────────────────────────────────────────
  // Fuel
  { merchant: 'CALTEX', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'AMPOL', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'SHELL', level1: 'Transport', level2: 'Fuel' },
  { merchant: '7 ELEVEN', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'UNITED PETROLEUM', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'MOBIL', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'COLES EXPRESS', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'METRO PETROLEUM', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'LIBERTY OIL', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'PUMA ENERGY', level1: 'Transport', level2: 'Fuel' },
  // Public Transport
  { merchant: 'OPAL', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'MYKI', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'TRANSLINK', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'GO CARD', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'TRANSPERTH', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'METROCARD', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'V LINE', level1: 'Transport', level2: 'Public Transport' },
  // Rideshare
  { merchant: 'UBER', level1: 'Transport', level2: 'Rideshare' },
  { merchant: 'DIDI', level1: 'Transport', level2: 'Rideshare' },
  { merchant: 'OLA', level1: 'Transport', level2: 'Rideshare' },
  { merchant: 'BOLT', level1: 'Transport', level2: 'Rideshare' },
  { merchant: '13CABS', level1: 'Transport', level2: 'Rideshare' },
  // Parking
  { merchant: 'WILSON PARKING', level1: 'Transport', level2: 'Parking' },
  { merchant: 'SECURE PARKING', level1: 'Transport', level2: 'Parking' },
  { merchant: 'CARE PARK', level1: 'Transport', level2: 'Parking' },
  { merchant: 'EASYPARK', level1: 'Transport', level2: 'Parking' },
  { merchant: 'CELLOPARK', level1: 'Transport', level2: 'Parking' },
  // Car Maintenance
  { merchant: 'REPCO', level1: 'Transport', level2: 'Car Maintenance' },
  { merchant: 'SUPERCHEAP AUTO', level1: 'Transport', level2: 'Car Maintenance' },
  { merchant: 'AUTOBARN', level1: 'Transport', level2: 'Car Maintenance' },
  { merchant: 'MYCAR', level1: 'Transport', level2: 'Car Maintenance' },
  { merchant: 'BOB JANE', level1: 'Transport', level2: 'Car Maintenance' },
  { merchant: 'BEAUREPAIRES', level1: 'Transport', level2: 'Car Maintenance' },
  { merchant: 'ULTRA TUNE', level1: 'Transport', level2: 'Car Maintenance' },
  { merchant: 'MIDAS', level1: 'Transport', level2: 'Car Maintenance' },
  // Tolls
  { merchant: 'LINKT', level1: 'Transport', level2: 'Tolls' },
  { merchant: 'EASTLINK', level1: 'Transport', level2: 'Tolls' },
  { merchant: 'TRANSURBAN', level1: 'Transport', level2: 'Tolls' },

  // ── Shopping ──────────────────────────────────────────────────────────────
  // Department Stores
  { merchant: 'KMART', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'TARGET', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'BIG W', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'MYER', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'DAVID JONES', level1: 'Shopping', level2: 'Department Stores' },
  // Electronics
  { merchant: 'JB HI FI', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'HARVEY NORMAN', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'OFFICEWORKS', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'THE GOOD GUYS', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'BING LEE', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'CENTRE COM', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'SCORPTEC', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'UMART', level1: 'Shopping', level2: 'Electronics' },
  // Home & Garden
  { merchant: 'BUNNINGS', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'IKEA', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'MITRE 10', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'TOTAL TOOLS', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'SYDNEY TOOLS', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'FLOWER POWER', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'BEACON LIGHTING', level1: 'Shopping', level2: 'Home & Garden' },
  // Clothing
  { merchant: 'COTTON ON', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'UNIQLO', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'COUNTRY ROAD', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'BEST AND LESS', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'JUST JEANS', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'JAY JAYS', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'SPORTSGIRL', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'WITCHERY', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'UNIVERSAL STORE', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'REBEL SPORT', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'LORNA JANE', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'LULULEMON', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'DECATHLON', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'THE ICONIC', level1: 'Shopping', level2: 'Clothing' },
  // Online Shopping
  { merchant: 'AMAZON', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'EBAY', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'CATCH', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'KOGAN', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'ALIEXPRESS', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'ETSY', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'TEMU', level1: 'Shopping', level2: 'Online Shopping' },

  // ── Housing (furniture & homewares) ───────────────────────────────────────
  { merchant: 'FANTASTIC FURNITURE', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'AMART FURNITURE', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'NICK SCALI', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'FREEDOM FURNITURE', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'ADAIRS', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'PILLOW TALK', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'SPOTLIGHT', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'TEMPLE AND WEBSTER', level1: 'Housing', level2: 'Furniture' },
  { merchant: 'BED BATH N TABLE', level1: 'Housing', level2: 'Furniture' },

  // ── Bills & Utilities ─────────────────────────────────────────────────────
  // Electricity / Gas retailers
  { merchant: 'AGL', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'ORIGIN ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'ENERGYAUSTRALIA', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'RED ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'ALINTA ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'SIMPLY ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'POWERSHOP', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'MOMENTUM ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'LUMO ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'TANGO ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'OVO ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'GLOBIRD ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  // Internet
  { merchant: 'TPG', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'AUSSIE BROADBAND', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'IINET', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'DODO', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'EXETEL', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'SUPERLOOP', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'TANGERINE', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'SPINTEL', level1: 'Bills & Utilities', level2: 'Internet' },
  // Mobile Phone
  { merchant: 'TELSTRA', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'OPTUS', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'VODAFONE', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'BOOST MOBILE', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'AMAYSIM', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'ALDI MOBILE', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'KOGAN MOBILE', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'FELIX MOBILE', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'CATCH CONNECT', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'LEBARA', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'BELONG', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  // Water
  { merchant: 'SYDNEY WATER', level1: 'Bills & Utilities', level2: 'Water' },
  { merchant: 'YARRA VALLEY WATER', level1: 'Bills & Utilities', level2: 'Water' },
  { merchant: 'SA WATER', level1: 'Bills & Utilities', level2: 'Water' },
  { merchant: 'UNITYWATER', level1: 'Bills & Utilities', level2: 'Water' },
  { merchant: 'HUNTER WATER', level1: 'Bills & Utilities', level2: 'Water' },

  // ── Health ────────────────────────────────────────────────────────────────
  // Pharmacy
  { merchant: 'CHEMIST WAREHOUSE', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'PRICELINE PHARMACY', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'TERRY WHITE', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'AMCAL', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'GUARDIAN PHARMACY', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'DISCOUNT DRUG STORES', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'MY CHEMIST', level1: 'Health', level2: 'Pharmacy' },
  // Fitness & Gym
  { merchant: 'ANYTIME FITNESS', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'FITNESS FIRST', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'GOODLIFE', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'JETTS', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'SNAP FITNESS', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'PLUS FITNESS', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'WORLD GYM', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'CLUB LIME', level1: 'Health', level2: 'Fitness & Gym' },
  // Optical
  { merchant: 'SPECSAVERS', level1: 'Health', level2: 'Optical' },
  { merchant: 'OPSM', level1: 'Health', level2: 'Optical' },
  { merchant: 'BAILEY NELSON', level1: 'Health', level2: 'Optical' },
  // Health Insurance
  { merchant: 'BUPA', level1: 'Health', level2: 'Health Insurance' },
  { merchant: 'MEDIBANK', level1: 'Health', level2: 'Health Insurance' },
  { merchant: 'HCF', level1: 'Health', level2: 'Health Insurance' },
  { merchant: 'NIB', level1: 'Health', level2: 'Health Insurance' },
  { merchant: 'AHM', level1: 'Health', level2: 'Health Insurance' },
  { merchant: 'AUSTRALIAN UNITY', level1: 'Health', level2: 'Health Insurance' },
  { merchant: 'GMHBA', level1: 'Health', level2: 'Health Insurance' },
  { merchant: 'HBF', level1: 'Health', level2: 'Health Insurance' },

  // ── Entertainment ─────────────────────────────────────────────────────────
  // Streaming
  { merchant: 'NETFLIX', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'SPOTIFY', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'DISNEY PLUS', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'STAN', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'BINGE', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'KAYO', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'FOXTEL', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'YOUTUBE PREMIUM', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'AMAZON PRIME', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'PARAMOUNT PLUS', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'APPLE MUSIC', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'AUDIBLE', level1: 'Entertainment', level2: 'Streaming Services' },
  // Gaming
  { merchant: 'STEAM GAMES', level1: 'Entertainment', level2: 'Gaming' },
  { merchant: 'PLAYSTATION', level1: 'Entertainment', level2: 'Gaming' },
  { merchant: 'XBOX', level1: 'Entertainment', level2: 'Gaming' },
  { merchant: 'NINTENDO', level1: 'Entertainment', level2: 'Gaming' },
  { merchant: 'EB GAMES', level1: 'Entertainment', level2: 'Gaming' },
  // Movies & Shows
  { merchant: 'EVENT CINEMAS', level1: 'Entertainment', level2: 'Movies & Shows' },
  { merchant: 'HOYTS', level1: 'Entertainment', level2: 'Movies & Shows' },
  { merchant: 'VILLAGE CINEMAS', level1: 'Entertainment', level2: 'Movies & Shows' },
  { merchant: 'PALACE CINEMAS', level1: 'Entertainment', level2: 'Movies & Shows' },
  // Sports & Events
  { merchant: 'TICKETEK', level1: 'Entertainment', level2: 'Sports & Events' },
  { merchant: 'TICKETMASTER', level1: 'Entertainment', level2: 'Sports & Events' },
  { merchant: 'MOSHTIX', level1: 'Entertainment', level2: 'Sports & Events' },
  // Books & Magazines
  { merchant: 'DYMOCKS', level1: 'Entertainment', level2: 'Books & Magazines' },
  { merchant: 'QBD BOOKS', level1: 'Entertainment', level2: 'Books & Magazines' },
  { merchant: 'BOOKTOPIA', level1: 'Entertainment', level2: 'Books & Magazines' },

  // ── Personal Care ─────────────────────────────────────────────────────────
  { merchant: 'MECCA', level1: 'Personal Care', level2: 'Hair & Beauty' },
  { merchant: 'SEPHORA', level1: 'Personal Care', level2: 'Hair & Beauty' },
  { merchant: 'JUST CUTS', level1: 'Personal Care', level2: 'Hair & Beauty' },
  { merchant: 'HAIRHOUSE', level1: 'Personal Care', level2: 'Hair & Beauty' },

  // ── Travel ────────────────────────────────────────────────────────────────
  // Flights
  { merchant: 'QANTAS', level1: 'Travel', level2: 'Flights' },
  { merchant: 'JETSTAR', level1: 'Travel', level2: 'Flights' },
  { merchant: 'VIRGIN AUSTRALIA', level1: 'Travel', level2: 'Flights' },
  { merchant: 'REX AIRLINES', level1: 'Travel', level2: 'Flights' },
  { merchant: 'WEBJET', level1: 'Travel', level2: 'Flights' },
  { merchant: 'FLIGHT CENTRE', level1: 'Travel', level2: 'Flights' },
  // Hotels
  { merchant: 'BOOKING COM', level1: 'Travel', level2: 'Hotels' },
  { merchant: 'EXPEDIA', level1: 'Travel', level2: 'Hotels' },
  { merchant: 'AIRBNB', level1: 'Travel', level2: 'Hotels' },
  { merchant: 'AGODA', level1: 'Travel', level2: 'Hotels' },
  { merchant: 'HOTELS COM', level1: 'Travel', level2: 'Hotels' },
  { merchant: 'QUEST APARTMENTS', level1: 'Travel', level2: 'Hotels' },
  { merchant: 'WOTIF', level1: 'Travel', level2: 'Hotels' },
  // Car Rental
  { merchant: 'HERTZ', level1: 'Travel', level2: 'Car Rental' },
  { merchant: 'AVIS', level1: 'Travel', level2: 'Car Rental' },
  { merchant: 'THRIFTY', level1: 'Travel', level2: 'Car Rental' },
  { merchant: 'EUROPCAR', level1: 'Travel', level2: 'Car Rental' },
  { merchant: 'REDSPOT', level1: 'Travel', level2: 'Car Rental' },

  // ── Financial — insurance & investing ─────────────────────────────────────
  // Insurance Premiums
  { merchant: 'NRMA', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'AAMI', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'BUDGET DIRECT', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'ALLIANZ', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'QBE INSURANCE', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'RACV', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'RACQ', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'SUNCORP', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'YOUI', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'BINGLE', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'GIO', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'APIA', level1: 'Financial', level2: 'Insurance Premiums' },
  { merchant: 'REAL INSURANCE', level1: 'Financial', level2: 'Insurance Premiums' },
  // Investment Fees / brokers
  { merchant: 'COMMSEC', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'SELFWEALTH', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'STAKE', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'PEARLER', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'SUPERHERO', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'CMC MARKETS', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'RAIZ', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'SPACESHIP', level1: 'Financial', level2: 'Investment Fees' },
  { merchant: 'SHARESIES', level1: 'Financial', level2: 'Investment Fees' },

  // ── Education ──────────────────────────────────────────────────────────────
  { merchant: 'UDEMY', level1: 'Education', level2: 'Courses & Training' },
  { merchant: 'COURSERA', level1: 'Education', level2: 'Courses & Training' },
  { merchant: 'SKILLSHARE', level1: 'Education', level2: 'Courses & Training' },
  { merchant: 'LINKEDIN LEARNING', level1: 'Education', level2: 'Courses & Training' },
];
