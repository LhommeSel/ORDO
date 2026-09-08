# Territoires, entités et actifs — premier lot

## Ce qui est implémenté

- Référentiel territorial versionné dans `WorldState.territorial`, sauvegardé et migré depuis les anciennes sauvegardes.
- France : 22 régions métropolitaines d’avant 2015, quatre DOM de 2000 et huit unités ultramarines supplémentaires. Saint-Martin et Saint-Barthélemy restent inclus dans la Guadeloupe.
- Population et PIB réel territoriaux pour les 26 régions du périmètre comptable. Les huit autres unités sont hors agrégat macro français dans ce premier lot : cinq populations à documenter, trois unités sans population permanente modélisée, huit PIB non renseignés (null, jamais zéro implicite).
- Les modifications macro de population et de PIB passent par le journal et synchronisent les territoires proportionnellement. Une partie avancée conserve ses totaux à la migration ; aucune réinitialisation à 2000.
- France : 55 actifs majeurs dans ce premier inventaire réduit, dont les 19 sites nucléaires métropolitains retenus pour 2000, des moyens hydro/thermiques, raffinage, stockage et quelques nœuds logistiques, industriels et portuaires. Les capacités restent à calibrer dans les registres énergie/industrie ; aucun actif ne crée automatiquement une production supplémentaire.
- Allemagne, Italie, Espagne et Royaume-Uni : 16, 20, 19 et 12 territoires régionaux, avec respectivement 24, 17, 22 et 30 actifs majeurs. Les quatre inventaires européens sont volontairement sélectifs hors nucléaire ; l’Italie conserve ses quatre centrales arrêtées dans un état fermé.
- Les actifs ne créent pas de deuxième production nationale ni de PIB supplémentaire. Le moteur énergétique existant reste inchangé.
- Carte mondiale : sélection pays, zoom centré et borné, distinction clic/déplacement, annulation tactile, gestion des erreurs de chargement. Suppression du zoom à la molette qui interceptait le défilement.
- Carte régionale : contours locaux chargés à la demande, sélection au clic/clavier, numéros et liste recherchable, actifs localisés, fiche et provenance. Outre-mer : localisateurs et liste, pas de faux contours historiques.
- Les fonds régionaux européens sont des contours NUTS 2021 utilisés comme approximation cartographique stable des périmètres 2000 ; ils ne prétendent pas reconstituer les limites administratives historiques au mètre près.

## Règle comptable et limites

La source macro nationale reste l’autorité de croissance dans cette étape. La population du RP1999 sert de poids démographique ; le produit `population RP1999 × PIB/habitant 2000` sert de poids économique. Ces poids sont normalisés sur la population et le PIB de la partie. Ce calcul ne prétend pas reconstituer le PIB régional observé de l’année 2000.

Pour les quatre DOM, le PIB/habitant moyen des DOM est utilisé provisoirement. Cette répartition doit être remplacée par des comptes individuels. Il ne faut pas utiliser les différences calculées entre DOM comme faits historiques.

Le périmètre macro français du prototype est conventionnellement métropole + quatre DOM. Mayotte et les autres collectivités ont des comptes séparés à documenter. Cette convention doit être confrontée au périmètre exact de la série nationale avant le calibrage final.

Les régions ont des valeurs physiques persistées et des poids de secours. Une modification nationale conserve leur distribution actuelle ; le dernier territoire reçoit le reliquat arithmétique. Les arrondis sont réservés à l’affichage. La croissance régionale autonome n’est pas encore implémentée.

Souveraineté, contrôle, administration et périmètre comptable sont des champs distincts. Le propriétaire et l’opérateur d’un actif sont distincts également. Cela prépare les occupations, nationalisations et cessions, mais **ne les rend pas encore jouables**. Ne pas modifier uniquement `sovereignCountryId` pour simuler une annexion : il faudra un effet atomique de transfert avec réconciliation des deux économies, des flux et des actifs. Les revendications détaillées, les zones de guerre et l’Antarctique sont différés.

## Extension au monde

1. Tous les pays déjà modélisés reçoivent un agrégat national. Les autres pays visibles sur le fond de carte ne reçoivent aucune statistique inventée.
2. Les cinq pays détaillés sont France (26 unités comptables), Allemagne (16), Italie (20), Espagne (19) et Royaume-Uni (12). Les autres pays restent agrégés et pourront être détaillés sans changer les contrats de données.
3. Ajouter un `TerritoryDataset` et son manifeste cartographique. Les types n’énumèrent ni les pays, ni un nombre fixe de régions, ni un système administratif français.
4. `regionalizeCountry` remplace l’agrégat, refuse de réécrire un pays déjà détaillé et interdit de perdre silencieusement les actifs rattachés à l’ancien agrégat. Les totaux macro courants sont conservés.
5. Index par périmètre comptable pour les mises à jour ; un pays ne parcourt que ses territoires pour le calcul. Le conteneur immuable reste une table plate, copiée superficiellement lors d’une mise à jour. Si le nombre de régions rend cette copie coûteuse, partitionner le stockage par périmètre sans changer les identifiants publics.
6. Aucune géométrie dans la sauvegarde, aucune recherche internet à l’exécution, aucun appel LLM supplémentaire. Chargement d’un seul fichier régional à la demande. Les quatre fichiers européens et le fichier France sont hors sauvegarde et chargés uniquement par le module cartographique.
7. Le journal conserve les réconciliations agrégées et l’effet macro rejouable, pas un historique de chaque région à chaque mois.

## Fiches nationales compactes

Le scénario 2000 contient désormais 100 pays. Vingt pays disposaient déjà d’une fiche métier détaillée ; 80 fiches nationales compactes supplémentaires sont générées depuis `lib/simulation/national-baseline-2000.ts`. Elles donnent au moteur une base cohérente pour la politique, les dirigeants, les intérêts, les vulnérabilités, les lignes rouges, les capacités administratives et les ordres de grandeur macroéconomiques.

Ces fiches ne prétendent pas fournir une précision territoriale ou énergétique complète. Un pays peut donc être connu par le conseiller sans disposer encore d’un gisement, d’une centrale ou d’une capacité d’export inscrite dans le registre physique. Dans ce cas, le moteur décrit la contrainte et refuse de fabriquer une offre. Les 80 pays reçoivent aussi une enveloppe énergétique et un profil structurel de gameplay afin de ne pas créer de « pays morts » dans le bac à sable ; les valeurs doivent être recalibrées avant une utilisation historique exigeante.

Il s’agit d’une architecture extensible, **pas d’un jeu de données mondial achevé ni d’une garantie de performance mesurée**. La charge complète (plusieurs milliers de territoires, 300 mois) devra être mesurée après autorisation de tests.

## Sources et provenance

- Population : [Insee, RP1999, tableau des régions page imprimée 19 / page PDF 16](https://www.insee.fr/fr/statistiques/fichier/1378738/Tot_complet.pdf).
- Poids économiques : [Insee, comptes régionaux, PIB/habitant 2000, page 4](https://www.insee.fr/fr/statistiques/fichier/1293427/ici155.pdf). Document rétrospectif, utilisé pour calibrer le scénario, pas une information disponible au joueur en janvier 2000.
- Terminaux : [Elengy, historique](https://www.elengy.com/en/about-us/our-history). Montoir et Fos Tonkin seulement ; ni Fos Cavaou ni Dunkerque GNL anticipés en 2000.
- Centrales : [EDF, document de référence 2011](https://www.edf.fr/sites/groupe/files/uploads/edf_ddr2011_interactif_vf.pdf), dates de mise en service ; aucune tranche EPR introduite en 2000.
- Ports : [SDES, liste des principaux ports métropolitains](https://www.statistiques.developpement-durable.gouv.fr/publicationweb/349), document postérieur utilisé pour le repérage, pas pour importer ses tonnages ou les statuts juridiques de 2020.
- Contours : [France GeoJSON / Grégoire David](https://github.com/gregoiredavid/france-geojson), IGN et INSEE, Licence ouverte. Anciennes régions avant 2015, pas un référentiel cadastral millésimé 2000. Révision et empreinte conservées dans `public/maps/fra-regions-2000.source.json` ; acquisition reproductible par `scripts/import-territory-map.mjs`.
- Europe : [Eurostat, comptes régionaux](https://ec.europa.eu/eurostat/web/national-accounts/methodology/regional-accounts), [jeu population régionale](https://ec.europa.eu/eurostat/web/products-datasets/-/tgs00096), [GISCO NUTS 2021](https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2021_4326.geojson) et [AIEA PRIS](https://pris.iaea.org/pris/WorldStatistics/WorldStatisticsLandingPage.aspx) pour le repérage nucléaire. Les valeurs britanniques de PIB régional sont explicitement calibrées faute de série comparable dans le flux retenu ; deux populations italiennes sont également des replis calibrés.

## Validation

Après autorisation explicite du joueur, le 7 septembre 2026 : le test territorial ciblé (`lib/simulation/territories.test.ts`) réussit en environ 0,22 seconde, hors démarrage du lanceur. Il couvre les 34 unités françaises, les 55 actifs et leurs rattachements, les 22 identifiants des contours, la conservation des totaux sur les 20 pays après 12 mois, la sauvegarde/relecture, la migration d’une sauvegarde avancée et le remplacement de l’agrégat japonais par deux régions synthétiques (fixture non enregistrée dans le jeu). Le type-check TypeScript (`npx tsc --noEmit`) et les 35 tests du moteur (`npm run test:simulation`) réussissent également avec les 100 pays.

Aucun appel IA. Les clics réels et l’affichage mobile n’ont pas été testés. Le test ne constitue pas un benchmark mondial. La compilation de production reste à confirmer par `npm run build`. Publication bloquée à ce stade : le service Sites répond « project not found » pour le projet existant sur le compte courant.
