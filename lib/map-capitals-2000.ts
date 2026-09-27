// Repères cartographiques historiques pour le scénario 2000.
// Coordonnées issues du jeu de données Natural Earth (domaine public).
// Les changements de capitale ultérieurs sont volontairement ramenés à 2000.
const capitalRows: Array<[string, string, number, number]> = [
  ['AFG', 'Kaboul', 69.2075, 34.5553], ['DZA', 'Alger', 3.0588, 36.7538], ['ARG', 'Buenos Aires', -58.3816, -34.6037],
  ['AUS', 'Canberra', 149.13, -35.28], ['AUT', 'Vienne', 16.3738, 48.2082], ['BEL', 'Bruxelles', 4.3517, 50.8503],
  ['BLR', 'Minsk', 27.5615, 53.9045], ['BGR', 'Sofia', 23.3219, 42.6977], ['BRA', 'Brasília', -47.8825, -15.7942],
  ['CAN', 'Ottawa', -75.6972, 45.4215], ['CHL', 'Santiago', -70.6693, -33.4489], ['CHN', 'Pékin', 116.4074, 39.9042],
  ['COL', 'Bogota', -74.0721, 4.711], ['CUB', 'La Havane', -82.3666, 23.1136], ['CZE', 'Prague', 14.4378, 50.0755],
  ['DEU', 'Berlin', 13.405, 52.52], ['DNK', 'Copenhague', 12.5683, 55.6761], ['EGY', 'Le Caire', 31.2357, 30.0444],
  ['ESP', 'Madrid', -3.7038, 40.4168], ['ETH', 'Addis-Abeba', 38.7578, 9.0192], ['FIN', 'Helsinki', 24.9384, 60.1699],
  ['FRA', 'Paris', 2.3522, 48.8566], ['GBR', 'Londres', -0.1276, 51.5074], ['GRC', 'Athènes', 23.7275, 37.9838],
  ['HUN', 'Budapest', 19.0402, 47.4979], ['IDN', 'Jakarta', 106.8456, -6.2088], ['IND', 'New Delhi', 77.209, 28.6139],
  ['IRL', 'Dublin', -6.2603, 53.3498], ['IRN', 'Téhéran', 51.389, 35.6892], ['IRQ', 'Bagdad', 44.3661, 33.3152],
  ['ISR', 'Jérusalem', 35.2137, 31.7683], ['ITA', 'Rome', 12.4964, 41.9028], ['JPN', 'Tokyo', 139.6917, 35.6895],
  ['KAZ', 'Astana', 71.4491, 51.1694], ['KEN', 'Nairobi', 36.8219, -1.2921], ['KOR', 'Séoul', 126.978, 37.5665],
  ['MAR', 'Rabat', -6.8498, 33.9716], ['MEX', 'Mexico', -99.1332, 19.4326], ['MMR', 'Rangoun', 96.1951, 16.8409],
  ['NGA', 'Abuja', 7.3986, 9.0765], ['NLD', 'Amsterdam', 4.9041, 52.3676], ['NOR', 'Oslo', 10.7522, 59.9139],
  ['NZL', 'Wellington', 174.7762, -41.2866], ['PAK', 'Islamabad', 73.0479, 33.6844], ['PER', 'Lima', -77.0428, -12.0464],
  ['POL', 'Varsovie', 21.0122, 52.2297], ['PRK', 'Pyongyang', 125.7625, 39.0392], ['PRT', 'Lisbonne', -9.1393, 38.7223],
  ['ROU', 'Bucarest', 26.1025, 44.4268], ['RUS', 'Moscou', 37.6173, 55.7558], ['SAU', 'Riyad', 46.6753, 24.7136],
  ['SRB', 'Belgrade', 20.4489, 44.7866], ['SWE', 'Stockholm', 18.0686, 59.3293], ['CHE', 'Berne', 7.4474, 46.948],
  ['SYR', 'Damas', 36.2765, 33.5138], ['THA', 'Bangkok', 100.5018, 13.7563], ['TUN', 'Tunis', 10.1815, 36.8065],
  ['TUR', 'Ankara', 32.8597, 39.9334], ['UKR', 'Kyiv', 30.5234, 50.4501], ['USA', 'Washington', -77.0369, 38.9072],
  ['VEN', 'Caracas', -66.9036, 10.4806], ['VNM', 'Hanoï', 105.8342, 21.0278], ['ZAF', 'Pretoria', 28.1881, -25.7479],
];

export const mapCapitals2000 = capitalRows.map(([countryId, name, longitude, latitude]) => ({
  countryId,
  name,
  coordinates: [longitude, latitude] as [number, number],
}));
