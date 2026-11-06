export interface GeoClassification {
  state: string;
  isWestGermany: boolean;
  city?: string;
  postalCode?: string;
}

const FORMER_DDR_STATES = [
  'Sachsen',
  'Sachsen-Anhalt',
  'Thüringen',
  'Brandenburg',
  'Mecklenburg-Vorpommern',
  'Berlin',
];

const WEST_GERMAN_STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Schleswig-Holstein',
];

const NON_GERMAN_LOCATIONS = [
  'basel',
  'zürich',
  'zurich',
  'ethz',
  'bern',
  'lausanne',
  'genf',
  'geneva',
  'st. gallen',
  'luzern',
  'wien',
  'vienna',
  'graz',
  'innsbruck',
  'salzburg',
  'linz',
];

function findFiveDigitPostalCode(text: string): string | undefined {
  let run = '';
  for (let i = 0; i <= text.length; i++) {
    const ch = i < text.length ? text[i] : ' ';
    if (ch >= '0' && ch <= '9') {
      run += ch;
    } else {
      if (run.length === 5) {
        return run;
      }
      run = '';
    }
  }
  return undefined;
}

/**
 * Classifies a location string or employer string into a German federal state
 * and determines whether it is in Western Germany (outside former DDR + Berlin).
 */
export function identifyGermanRegion(locationText: string): GeoClassification {
  const clean = locationText.replaceAll('\u00AD', '').replaceAll('&shy;', '').replaceAll('&SHY;', '').trim();
  const lower = clean.toLowerCase();

  // Exclude Swiss and Austrian universities first
  for (const foreign of NON_GERMAN_LOCATIONS) {
    if (lower.includes(foreign)) {
      return { state: 'Outside Germany', isWestGermany: false };
    }
  }

  // Extract 5-digit German postal code (PLZ) if present
  const postalCode = findFiveDigitPostalCode(clean);

  if (postalCode) {
    const prefix2 = parseInt(postalCode.substring(0, 2), 10);

    // 01-09: Sachsen, Süden Brandenburgs, Thüringen, Sachsen-Anhalt (East)
    if (prefix2 >= 1 && prefix2 <= 9) {
      if (prefix2 >= 1 && prefix2 <= 4) return { state: 'Sachsen', isWestGermany: false, postalCode };
      if (prefix2 === 6) return { state: 'Sachsen-Anhalt', isWestGermany: false, postalCode };
      if (prefix2 === 7) return { state: 'Thüringen', isWestGermany: false, postalCode };
      return { state: 'Sachsen', isWestGermany: false, postalCode };
    }

    // 10-13: Berlin
    if (prefix2 >= 10 && prefix2 <= 13) {
      return { state: 'Berlin', isWestGermany: false, postalCode };
    }

    // 14-16: Brandenburg
    if (prefix2 >= 14 && prefix2 <= 16) {
      return { state: 'Brandenburg', isWestGermany: false, postalCode };
    }

    // 17-19: Mecklenburg-Vorpommern
    if (prefix2 >= 17 && prefix2 <= 19) {
      return { state: 'Mecklenburg-Vorpommern', isWestGermany: false, postalCode };
    }

    // 20-22: Hamburg / Schleswig-Holstein
    if (prefix2 === 20 || prefix2 === 22) {
      return { state: 'Hamburg', isWestGermany: true, postalCode };
    }
    if (prefix2 === 21 || (prefix2 >= 23 && prefix2 <= 25)) {
      return { state: 'Schleswig-Holstein', isWestGermany: true, postalCode };
    }

    // 26-27, 29-31, 37-38, 49: Niedersachsen / Bremen
    if (prefix2 === 28) {
      return { state: 'Bremen', isWestGermany: true, postalCode };
    }
    if (
      prefix2 === 26 ||
      prefix2 === 27 ||
      (prefix2 >= 29 && prefix2 <= 31) ||
      prefix2 === 37 ||
      prefix2 === 38 ||
      prefix2 === 49
    ) {
      return { state: 'Niedersachsen', isWestGermany: true, postalCode };
    }

    // 32-33, 40-48, 50-53, 57-59: Nordrhein-Westfalen
    if (
      prefix2 === 32 ||
      prefix2 === 33 ||
      (prefix2 >= 40 && prefix2 <= 48) ||
      (prefix2 >= 50 && prefix2 <= 53) ||
      (prefix2 >= 57 && prefix2 <= 59)
    ) {
      return { state: 'Nordrhein-Westfalen', isWestGermany: true, postalCode };
    }

    // 34-36, 60-65: Hessen
    if ((prefix2 >= 34 && prefix2 <= 36) || (prefix2 >= 60 && prefix2 <= 65)) {
      return { state: 'Hessen', isWestGermany: true, postalCode };
    }

    // 39: Sachsen-Anhalt (Magdeburg)
    if (prefix2 === 39) {
      return { state: 'Sachsen-Anhalt', isWestGermany: false, postalCode };
    }

    // 54-56, 67: Rheinland-Pfalz
    if ((prefix2 >= 54 && prefix2 <= 56) || prefix2 === 67) {
      return { state: 'Rheinland-Pfalz', isWestGermany: true, postalCode };
    }

    // 66: Saarland
    if (prefix2 === 66) {
      return { state: 'Saarland', isWestGermany: true, postalCode };
    }

    // 68-79: Baden-Württemberg
    if (prefix2 >= 68 && prefix2 <= 79) {
      return { state: 'Baden-Württemberg', isWestGermany: true, postalCode };
    }

    // 80-97: Bayern
    if (prefix2 >= 80 && prefix2 <= 97) {
      return { state: 'Bayern', isWestGermany: true, postalCode };
    }

    // 98-99: Thüringen
    if (prefix2 === 98 || prefix2 === 99) {
      return { state: 'Thüringen', isWestGermany: false, postalCode };
    }
  }

  // Fallback to text matching for federal state names
  for (const ddrState of FORMER_DDR_STATES) {
    if (lower.includes(ddrState.toLowerCase())) {
      return { state: ddrState, isWestGermany: false, postalCode };
    }
  }

  for (const westState of WEST_GERMAN_STATES) {
    if (lower.includes(westState.toLowerCase())) {
      return { state: westState, isWestGermany: true, postalCode };
    }
  }

  // Major East German cities (check first so Berlin/Potsdam/Leipzig are caught)
  const eastCities: { match: string; city: string; state: string }[] = [
    { match: 'leipzig', city: 'Leipzig', state: 'Sachsen' },
    { match: 'dresden', city: 'Dresden', state: 'Sachsen' },
    { match: 'chemnitz', city: 'Chemnitz', state: 'Sachsen' },
    { match: 'freiberg', city: 'Freiberg', state: 'Sachsen' },
    { match: 'halle', city: 'Halle', state: 'Sachsen-Anhalt' },
    { match: 'magdeburg', city: 'Magdeburg', state: 'Sachsen-Anhalt' },
    { match: 'erfurt', city: 'Erfurt', state: 'Thüringen' },
    { match: 'jena', city: 'Jena', state: 'Thüringen' },
    { match: 'weimar', city: 'Weimar', state: 'Thüringen' },
    { match: 'ilmenau', city: 'Ilmenau', state: 'Thüringen' },
    { match: 'potsdam', city: 'Potsdam', state: 'Brandenburg' },
    { match: 'cottbus', city: 'Cottbus', state: 'Brandenburg' },
    { match: 'frankfurt (oder)', city: 'Frankfurt (Oder)', state: 'Brandenburg' },
    { match: 'viadrina', city: 'Frankfurt (Oder)', state: 'Brandenburg' },
    { match: 'rostock', city: 'Rostock', state: 'Mecklenburg-Vorpommern' },
    { match: 'greifswald', city: 'Greifswald', state: 'Mecklenburg-Vorpommern' },
    { match: 'schwerin', city: 'Schwerin', state: 'Mecklenburg-Vorpommern' },
    { match: 'berlin', city: 'Berlin', state: 'Berlin' },
  ];

  for (const item of eastCities) {
    if (lower.includes(item.match)) {
      return { state: item.state, isWestGermany: false, city: item.city, postalCode };
    }
  }

  // Comprehensive Western German university cities & institutions
  const westCities: { match: string; city: string; state: string }[] = [
    // Nordrhein-Westfalen (NRW)
    { match: 'köln', city: 'Köln', state: 'Nordrhein-Westfalen' },
    { match: 'koeln', city: 'Köln', state: 'Nordrhein-Westfalen' },
    { match: 'cologne', city: 'Köln', state: 'Nordrhein-Westfalen' },
    { match: 'mpifg', city: 'Köln', state: 'Nordrhein-Westfalen' },
    { match: 'düsseldorf', city: 'Düsseldorf', state: 'Nordrhein-Westfalen' },
    { match: 'duesseldorf', city: 'Düsseldorf', state: 'Nordrhein-Westfalen' },
    { match: 'bonn', city: 'Bonn', state: 'Nordrhein-Westfalen' },
    { match: 'idos', city: 'Bonn', state: 'Nordrhein-Westfalen' },
    { match: 'münster', city: 'Münster', state: 'Nordrhein-Westfalen' },
    { match: 'muenster', city: 'Münster', state: 'Nordrhein-Westfalen' },
    { match: 'bochum', city: 'Bochum', state: 'Nordrhein-Westfalen' },
    { match: 'dortmund', city: 'Dortmund', state: 'Nordrhein-Westfalen' },
    { match: 'essen', city: 'Duisburg-Essen', state: 'Nordrhein-Westfalen' },
    { match: 'duisburg', city: 'Duisburg-Essen', state: 'Nordrhein-Westfalen' },
    { match: 'aachen', city: 'Aachen', state: 'Nordrhein-Westfalen' },
    { match: 'bielefeld', city: 'Bielefeld', state: 'Nordrhein-Westfalen' },
    { match: 'paderborn', city: 'Paderborn', state: 'Nordrhein-Westfalen' },
    { match: 'siegen', city: 'Siegen', state: 'Nordrhein-Westfalen' },
    { match: 'wuppertal', city: 'Wuppertal', state: 'Nordrhein-Westfalen' },
    { match: 'hagen', city: 'Hagen', state: 'Nordrhein-Westfalen' },

    // Bayern (Bavaria)
    { match: 'münchen', city: 'München', state: 'Bayern' },
    { match: 'muenchen', city: 'München', state: 'Bayern' },
    { match: 'munich', city: 'München', state: 'Bayern' },
    { match: 'nürnberg', city: 'Nürnberg', state: 'Bayern' },
    { match: 'nuernberg', city: 'Nürnberg', state: 'Bayern' },
    { match: 'nuremberg', city: 'Nürnberg', state: 'Bayern' },
    { match: 'erlangen', city: 'Erlangen-Nürnberg', state: 'Bayern' },
    { match: 'fau', city: 'Erlangen-Nürnberg', state: 'Bayern' },
    { match: 'würzburg', city: 'Würzburg', state: 'Bayern' },
    { match: 'wuerzburg', city: 'Würzburg', state: 'Bayern' },
    { match: 'augsburg', city: 'Augsburg', state: 'Bayern' },
    { match: 'bamberg', city: 'Bamberg', state: 'Bayern' },
    { match: 'bayreuth', city: 'Bayreuth', state: 'Bayern' },
    { match: 'passau', city: 'Passau', state: 'Bayern' },
    { match: 'regensburg', city: 'Regensburg', state: 'Bayern' },
    { match: 'ingolstadt', city: 'Ingolstadt', state: 'Bayern' },

    // Baden-Württemberg
    { match: 'stuttgart', city: 'Stuttgart', state: 'Baden-Württemberg' },
    { match: 'hohenheim', city: 'Stuttgart-Hohenheim', state: 'Baden-Württemberg' },
    { match: 'mannheim', city: 'Mannheim', state: 'Baden-Württemberg' },
    { match: 'heidelberg', city: 'Heidelberg', state: 'Baden-Württemberg' },
    { match: 'freiburg', city: 'Freiburg', state: 'Baden-Württemberg' },
    { match: 'tübingen', city: 'Tübingen', state: 'Baden-Württemberg' },
    { match: 'tuebingen', city: 'Tübingen', state: 'Baden-Württemberg' },
    { match: 'tbingen', city: 'Tübingen', state: 'Baden-Württemberg' },
    { match: 'konstanz', city: 'Konstanz', state: 'Baden-Württemberg' },
    { match: 'karlsruhe', city: 'Karlsruhe', state: 'Baden-Württemberg' },
    { match: 'ulm', city: 'Ulm', state: 'Baden-Württemberg' },

    // Hessen (Hesse)
    { match: 'frankfurt', city: 'Frankfurt am Main', state: 'Hessen' },
    { match: 'kassel', city: 'Kassel', state: 'Hessen' },
    { match: 'marburg', city: 'Marburg', state: 'Hessen' },
    { match: 'darmstadt', city: 'Darmstadt', state: 'Hessen' },
    { match: 'gießen', city: 'Gießen', state: 'Hessen' },
    { match: 'giessen', city: 'Gießen', state: 'Hessen' },
    { match: 'wiesbaden', city: 'Wiesbaden', state: 'Hessen' },
    { match: 'bevölkerungsforschung', city: 'Wiesbaden', state: 'Hessen' },
    { match: 'destatis', city: 'Wiesbaden', state: 'Hessen' },

    // Niedersachsen (Lower Saxony)
    { match: 'hannover', city: 'Hannover', state: 'Niedersachsen' },
    { match: 'göttingen', city: 'Göttingen', state: 'Niedersachsen' },
    { match: 'goettingen', city: 'Göttingen', state: 'Niedersachsen' },
    { match: 'gttingen', city: 'Göttingen', state: 'Niedersachsen' },
    { match: 'lüneburg', city: 'Lüneburg', state: 'Niedersachsen' },
    { match: 'lueneburg', city: 'Lüneburg', state: 'Niedersachsen' },
    { match: 'leuphana', city: 'Lüneburg', state: 'Niedersachsen' },
    { match: 'oldenburg', city: 'Oldenburg', state: 'Niedersachsen' },
    { match: 'osnabrück', city: 'Osnabrück', state: 'Niedersachsen' },
    { match: 'osnabrueck', city: 'Osnabrück', state: 'Niedersachsen' },
    { match: 'braunschweig', city: 'Braunschweig', state: 'Niedersachsen' },
    { match: 'wolfenbüttel', city: 'Wolfenbüttel', state: 'Niedersachsen' },

    // Rheinland-Pfalz (Rhineland-Palatinate)
    { match: 'mainz', city: 'Mainz', state: 'Rheinland-Pfalz' },
    { match: 'trier', city: 'Trier', state: 'Rheinland-Pfalz' },
    { match: 'kaiserslautern', city: 'Kaiserslautern-Landau', state: 'Rheinland-Pfalz' },
    { match: 'landau', city: 'Kaiserslautern-Landau', state: 'Rheinland-Pfalz' },
    { match: 'speyer', city: 'Speyer', state: 'Rheinland-Pfalz' },
    { match: 'koblenz', city: 'Koblenz', state: 'Rheinland-Pfalz' },

    // Schleswig-Holstein
    { match: 'kiel', city: 'Kiel', state: 'Schleswig-Holstein' },
    { match: 'lübeck', city: 'Lübeck', state: 'Schleswig-Holstein' },
    { match: 'flensburg', city: 'Flensburg', state: 'Schleswig-Holstein' },

    // Saarland
    { match: 'saarbrücken', city: 'Saarbrücken', state: 'Saarland' },
    { match: 'saarbruecken', city: 'Saarbrücken', state: 'Saarland' },
    { match: 'saarland', city: 'Saarbrücken', state: 'Saarland' },

    // Hamburg & Bremen
    { match: 'hamburg', city: 'Hamburg', state: 'Hamburg' },
    { match: 'giga', city: 'Hamburg', state: 'Hamburg' },
    { match: 'bremen', city: 'Bremen', state: 'Bremen' },
  ];

  for (const item of westCities) {
    if (lower.includes(item.match)) {
      return { state: item.state, isWestGermany: true, city: item.city, postalCode };
    }
  }

  return { state: 'Unknown', isWestGermany: false, postalCode };
}
