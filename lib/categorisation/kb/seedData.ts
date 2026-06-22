/**
 * Phase 52 — curated AU merchant seed for the categorisation KB (build 52.4).
 *
 * Pre-loads well-known Australian merchants so the shared KB has graduated,
 * trusted defaults on day one (before user votes accumulate) — making the READ
 * path immediately useful. Seeds are `source: SEED`, `isGlobal: true` (curated,
 * not subject to k-anonymity), and are corrected over time if the community
 * sustainedly disagrees.
 *
 * Names are written in **bank-feed-normalised form** (uppercase, no punctuation)
 * to maximise exact-match hit-rate; the fuzzy tail ("WW METRO" → "WOOLWORTHS")
 * is the embeddings upgrade (later). `level1`/`level2` MUST be valid entries in
 * `CATEGORY_HIERARCHY` (asserted by the seed validity test).
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §6, §7 (52.4).
 */

export interface MerchantSeed {
  merchant: string; // bank-feed-style; run through scrubToSignature at seed time
  level1: string;
  level2: string;
}

export const AU_MERCHANT_SEEDS: MerchantSeed[] = [
  // Food & Dining — Groceries
  { merchant: 'WOOLWORTHS', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'COLES', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'ALDI', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'IGA', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'COSTCO', level1: 'Food & Dining', level2: 'Groceries' },
  { merchant: 'HARRIS FARM', level1: 'Food & Dining', level2: 'Groceries' },
  // Food & Dining — Fast Food
  { merchant: 'MCDONALDS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'KFC', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'HUNGRY JACKS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'SUBWAY', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'DOMINOS', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'RED ROOSTER', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'GUZMAN Y GOMEZ', level1: 'Food & Dining', level2: 'Fast Food' },
  { merchant: 'NANDOS', level1: 'Food & Dining', level2: 'Fast Food' },
  // Food & Dining — Food Delivery
  { merchant: 'UBER EATS', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'MENULOG', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'DOORDASH', level1: 'Food & Dining', level2: 'Food Delivery' },
  { merchant: 'DELIVEROO', level1: 'Food & Dining', level2: 'Food Delivery' },
  // Food & Dining — Alcohol & Bars
  { merchant: 'DAN MURPHYS', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  { merchant: 'BWS', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  { merchant: 'LIQUORLAND', level1: 'Food & Dining', level2: 'Alcohol & Bars' },
  // Transport — Fuel
  // (Bare 2-letter brands like "BP" are intentionally omitted — the scrubber's
  // ≥3-letter rule rejects them, and they appear as "BP <location>" in real
  // feeds anyway; fuel-brand+location matching is the future embeddings layer.)
  { merchant: 'CALTEX', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'AMPOL', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'SHELL', level1: 'Transport', level2: 'Fuel' },
  { merchant: '7 ELEVEN', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'UNITED PETROLEUM', level1: 'Transport', level2: 'Fuel' },
  { merchant: 'MOBIL', level1: 'Transport', level2: 'Fuel' },
  // Transport — Rideshare / PT / Tolls / Parking
  { merchant: 'UBER', level1: 'Transport', level2: 'Rideshare' },
  { merchant: 'DIDI', level1: 'Transport', level2: 'Rideshare' },
  { merchant: 'OPAL', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'MYKI', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'TRANSLINK', level1: 'Transport', level2: 'Public Transport' },
  { merchant: 'LINKT', level1: 'Transport', level2: 'Tolls' },
  { merchant: 'EASTLINK', level1: 'Transport', level2: 'Tolls' },
  { merchant: 'WILSON PARKING', level1: 'Transport', level2: 'Parking' },
  { merchant: 'SECURE PARKING', level1: 'Transport', level2: 'Parking' },
  // Shopping — Department Stores
  { merchant: 'KMART', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'TARGET', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'BIG W', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'MYER', level1: 'Shopping', level2: 'Department Stores' },
  { merchant: 'DAVID JONES', level1: 'Shopping', level2: 'Department Stores' },
  // Shopping — Electronics
  { merchant: 'JB HI FI', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'HARVEY NORMAN', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'OFFICEWORKS', level1: 'Shopping', level2: 'Electronics' },
  { merchant: 'THE GOOD GUYS', level1: 'Shopping', level2: 'Electronics' },
  // Shopping — Home & Garden
  { merchant: 'BUNNINGS', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'IKEA', level1: 'Shopping', level2: 'Home & Garden' },
  { merchant: 'MITRE 10', level1: 'Shopping', level2: 'Home & Garden' },
  // Shopping — Clothing
  { merchant: 'COTTON ON', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'UNIQLO', level1: 'Shopping', level2: 'Clothing' },
  { merchant: 'COUNTRY ROAD', level1: 'Shopping', level2: 'Clothing' },
  // Shopping — Online
  { merchant: 'AMAZON', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'EBAY', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'CATCH', level1: 'Shopping', level2: 'Online Shopping' },
  { merchant: 'KOGAN', level1: 'Shopping', level2: 'Online Shopping' },
  // Bills & Utilities — Electricity / Internet / Mobile
  { merchant: 'AGL', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'ORIGIN ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'ENERGYAUSTRALIA', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'RED ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'ALINTA ENERGY', level1: 'Bills & Utilities', level2: 'Electricity' },
  { merchant: 'TELSTRA', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'OPTUS', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'VODAFONE', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'BOOST MOBILE', level1: 'Bills & Utilities', level2: 'Mobile Phone' },
  { merchant: 'TPG', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'AUSSIE BROADBAND', level1: 'Bills & Utilities', level2: 'Internet' },
  { merchant: 'IINET', level1: 'Bills & Utilities', level2: 'Internet' },
  // Entertainment — Streaming
  { merchant: 'NETFLIX', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'SPOTIFY', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'DISNEY PLUS', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'STAN', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'BINGE', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'KAYO', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'FOXTEL', level1: 'Entertainment', level2: 'Streaming Services' },
  { merchant: 'YOUTUBE PREMIUM', level1: 'Entertainment', level2: 'Streaming Services' },
  // Health — Pharmacy / Gym
  { merchant: 'CHEMIST WAREHOUSE', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'PRICELINE PHARMACY', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'TERRY WHITE', level1: 'Health', level2: 'Pharmacy' },
  { merchant: 'ANYTIME FITNESS', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'FITNESS FIRST', level1: 'Health', level2: 'Fitness & Gym' },
  { merchant: 'GOODLIFE', level1: 'Health', level2: 'Fitness & Gym' },
  // Travel — Flights
  { merchant: 'QANTAS', level1: 'Travel', level2: 'Flights' },
  { merchant: 'JETSTAR', level1: 'Travel', level2: 'Flights' },
  { merchant: 'VIRGIN AUSTRALIA', level1: 'Travel', level2: 'Flights' },
];
