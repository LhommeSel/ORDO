# Dictionnaire des données ORDO — version 1

Date de conception : 7 septembre 2026. Scénario initial : 1er janvier 2000.

Statut : spécification de référence à implémenter progressivement. Les chemins `cible.*` ci-dessous sont proposés ; ils ne décrivent pas des fonctions déjà livrées. Aucun chiffre historique nouveau n'est validé par ce document. Les exemples institutionnels sont des configurations illustratives à renseigner selon le pays et la date.

## 1. Principe : une vérité de simulation, plusieurs points de vue

Le monde conserve des ressources, institutions, acteurs et engagements. Les fiches pays et les contextes IA sont des vues de cet état, filtrées selon l'observateur. Une fiche n'a pas son propre PIB ni son propre stock. Une description ne modifie jamais une valeur par elle-même.

| Catégorie | Source conservée | Fonction moteur | Fonction IA | Fonction joueur |
|---|---|---|---|---|
| Ressources et capacités | Stocks, flux, actifs, disponibilités | Comptabilité, faisabilité, délais, consommation | Propositions compatibles avec les moyens connus | Chiffres et explication des possibilités |
| Institutions et engagements | Autorités, procédures, droits, obligations datés | Qui décide, qui exécute, qui doit consentir | Négociation et interprétation des résistances | Comprendre ses leviers et engagements |
| Acteurs et orientations | Groupes, personnes, préférences, moyens d'influence | Suivre soutien, mobilisation et effets validés | Personnalité et stratégie contextualisées | Positions publiques, rapports de force connus |
| Dossiers et mémoire | Actions, clauses, échéances, événements | Exécution et continuité | Dialogue, propositions, suites causales | Suivi des crises, accords et projets |
| Diagnostics et explications | Résultats dérivés avec références | Aucun effet supplémentaire propre | Explication, anticipation argumentée | Forces, faiblesses, expositions et risques |

Un diagnostic « dépendance énergétique » n'ajoute pas un malus déjà calculé par les prix, pénuries et contrats. Les catégories sont communes à tous les pays ; leur contenu et les mécanismes institutionnels applicables diffèrent.

## 2. Contrat de définition d'un champ

Chaque champ ajouté au modèle doit être inscrit avec les propriétés suivantes. Les propriétés communes aux champs d'une collection peuvent être héritées de sa définition : on ne répète pas ces métadonnées dans chaque sauvegarde.

| Propriété | Définition obligatoire |
|---|---|
| `id`, `label`, `definition` | Identifiant stable, nom affiché, objet mesuré sans ambiguïté |
| `owner`, `scope` | Collection propriétaire et périmètre : territoire, gouvernement, entreprise, institution, acteur, contrat… |
| `type`, `unit`, `bounds` | Type, unité, plage possible ; préciser le dénominateur de chaque ratio |
| `applicability` | Conditions d'existence ; distinguer absence réelle et module non détaillé |
| `role` | État fondamental, paramètre de modèle, résultat dérivé, observation ou texte éditorial |
| `rigor` | Règle exacte, mesure harmonisée ou interprétation de simulation |
| `updateOwner`, `updateTrigger` | Module autorisé à écrire et déclencheur ; formule/version si calculé |
| `dependencies` | Données requises ; conduite en cas de donnée manquante |
| `visibilityPolicy` | Qui connaît quoi, à quelle date et par quel canal |
| `aiUse`, `playerUse` | Pourquoi sélectionner ce champ pour l'IA et comment l'afficher |
| `provenance` | Référence historique ou hypothèse de calibration traçable |
| `implementationStatus` | Existant, partiel, à créer, différé ; lien au champ existant |

Chaque valeur historique importée conserve : source/page/table, définition de série, période d'observation, date de publication si disponible, date de collecte, unité d'origine et conversion. `origin` vaut `historical_observation`, `scenario_calibration`, `simulation` ou `derived`. Une valeur calibrée est une valeur effective du scénario, mais pas un chiffre historique certifié.

Les modifications en partie référencent une action/événement et une version de calcul. L'origine d'un chiffre ne se réduit pas à « IA » : il faut savoir quelle décision validée l'a produit.

### Valeurs absentes et comparabilité

- `known` : valeur renseignée ; zéro est permis quand la quantité vaut réellement zéro.
- `unknown` : donnée applicable mais non renseignée ou non observée ; `value: null`.
- `not_applicable` : concept sans objet dans cette configuration ; `value: null` et raison.
- `not_modeled` : objet réel hors du détail du prototype ; `value: null`, abstraction employée indiquée.

Un tableau vide signifie « aucune instance », pas « recherche non effectuée ». Un pays sans armée a des effectifs militaires nuls, mais peut avoir une police et une protection extérieure. L'absence d'armée ne donne pas une efficacité militaire « moyenne » par défaut.

Une donnée nécessaire à une transaction ne peut pas rester inconnue : le scénario doit recevoir une calibration explicite avant activation du mécanisme, ou celui-ci doit signaler qu'il ne sait pas encore résoudre cette opération. Aucun stock, crédit ou droit d'accès n'est créé implicitement.

### Trois degrés de rigueur

1. **Exactitude de règle** : unités, conservation, identité des acteurs, statut des clauses, droits et dates. Les comptes doivent rester cohérents, même avec un point de départ calibré.
2. **Mesure harmonisée** : PIB, population, emploi, budgets… Une définition comparable et des arrondis honnêtes ; pas besoin d'une précision au dernier euro.
3. **Interprétation argumentée** : personnalité, influence, orientations. Pas de fausse mesure scientifique. Un paramètre interne doit avoir une échelle définie et un mécanisme identifié.

Les indices internes 0–100 ne sont pas des ressources dépensables. Aucun « capital politique » n'est introduit. Un seuil « élevé » doit préciser sa référence : disponibilité de ses propres forces, puissance régionale ou comparaison mondiale ne sont pas interchangeables.

## 3. Identité, territoire et diversité des pays

Les identifiants internes restent stables en cas de changement de nom ou de régime. Le code ISO est un alias facultatif, pas une condition d'existence : factions et entités à reconnaissance limitée doivent être représentables.

| Champ cible | Type / périmètre | Usage et évolution |
|---|---|---|
| `cible.entities.id / kind / names` | Identifiant ; État, gouvernement, organisation, entreprise, groupe, personne ; noms datés | Références stables partout ; création ou changement politique |
| `cible.entities.externalCodes` | Codes externes facultatifs et datés | Imports statistiques sans confondre code et identité |
| `cible.territories.controllerId / claimantIds` | Contrôleur effectif et revendications distinctes | Fiscalité/exécution selon contrôle ; diplomatie selon revendication |
| `cible.recognitions` | Observateur, entité reconnue, statut, dates | Reconnaissance diplomatique par acteur ; pas de booléen mondial « pays légitime » |
| `cible.territories.population / productiveAssets` | Habitants et références d'actifs, périmètre explicite | Agrégation nationale et changement de contrôle sans dupliquer des ressources |
| `cible.geography.connections` | Frontières, façades maritimes, accès enclavé, routes et distances | Coûts et portée issus de la géographie ; pas de bonus général « position stratégique » |
| `cible.country.modules` | Modules détaillés, agrégés ou non modélisés | Niveau de détail, jamais bonus d'activité réservé au pays joueur |

Le prototype peut agréger le territoire national. Avant de simuler une partition, une annexion ou un contrôle partagé, il faudra définir l'allocation des populations, actifs, recettes et dettes. Le dictionnaire prépare cette extension sans prétendre qu'elle est déjà gérée.

### Configurations composables, jamais des portraits imposés

| Configuration possible | Données à activer | Hypothèse à éviter |
|---|---|---|
| République parlementaire | Chambres, coalitions, confiance, procédures | Le président décide de tout |
| Régime présidentiel ou cohabitation | Compétences par domaine, assemblées, pouvoirs propres | Un unique pourcentage d'autorité décrit toutes les décisions |
| Monarchie | Pouvoirs du souverain, gouvernement, succession, groupes dynastiques si pertinents | Toute monarchie est absolue ou toute dynastie est unie |
| Parti dominant ou parti unique | Organes du parti, nominations, factions et contrôle des appareils | Aucun désaccord interne n'est possible |
| Direction militaire | Chaînes de commandement, branches, loyautés, ressources | Tous les militaires ont les mêmes objectifs |
| Fédération / fortes autonomies | Compétences et budgets centraux/territoriaux | Le centre dispose de toutes les recettes et autorisations |
| Autorités concurrentes | Contrôle territorial, administrations et forces séparées | Le gouvernement reconnu commande tout le territoire |
| Petit État sans armée | Sécurité civile, accords de protection, capacités diplomatiques | Armée inventée ou absence de toute capacité d'action |
| Économie rentière, ouverte, administrée ou informelle | Dépendances et mécanismes correspondants, cumulables | Une étiquette de régime détermine le comportement économique |

## 4. Ressources et capacités

Dans cette section : données fondamentales ou dérivées, utilisées par le moteur et sélectionnées pour l'IA selon la question. La fiche affiche les valeurs autorisées, avec unités. Les flux annuels sont des rythmes ; les stocks sont des quantités à une date.

### 4.1 Économie et démographie

| Champ logique / ancrage existant | Définition / unité cible | Mise à jour et règle |
|---|---|---|
| PIB réel — `macroEconomies.*.realGdpBillion2000Usd` | Production annuelle en Md USD constants base 2000 | Macro mensuelle ; croissance issue de l'activité ; n'est pas la trésorerie publique |
| PIB nominal — `cible.macro.nominalGdp` | Production annuelle en monnaie courante locale | Prix et volumes ; change daté pour comparaison internationale |
| Croissance réelle / potentielle — `realGrowthAnnualPct`, `potentialGrowthAnnualPct` | % annuel ; réalisée et capacité soutenable distinctes | Cycle / capacités ; ne pas présenter le potentiel comme observation historique |
| Population — `populationMillions` | Millions de résidents sur le périmètre défini | Naissances − décès + migration ; cohérence entre rythme et variation |
| Structure démographique — `workingAgeSharePct`, `dependencyRatioPct` | Âges 15–64 / population ; hors 15–64 / 15–64, convention initiale | Ratio dérivé ; cohorte ou évolution agrégée documentée |
| Participation / chômage — `laborForceParticipationPct`, `unemploymentPct` | Actifs / population d'âge retenu ; chômeurs / actifs, même périmètre d'âge | Migration vers une convention commune ; aucune assimilation entre faible emploi formel et chômage |
| Inflation / salaires — `inflationAnnualPct`, `wageGrowthAnnualPct` | Variation annuelle d'un indice de prix défini / salaires nominaux | Prix, marché du travail et politique ; ne pas mélanger IPC et déflateur du PIB |
| Recettes / dépenses / solde — `publicRevenuePctGdp`, `publicSpendingPctGdp`, `fiscalBalancePctGdp` | % du PIB nominal ; administrations publiques consolidées | Fiscalité et dépenses ; solde = recettes − dépenses, transferts internes éliminés |
| Trésorerie — `cible.publicFinance.cash` | Stock de monnaie disponible au niveau de gouvernement concerné | Paiements, recettes et financement ; remplace à terme le budget générique |
| Dette — `publicDebtPctGdp`, `sovereignDebt` | Encours brut consolidé, devise, échéances, détenteurs et intérêts | Financement, remboursement, défaut ; distinguer encours et ratio |
| Crédit / banques — `bankingSystem`, `privateDebtPctGdp` | Encours et agrégats avec couverture bancaire précisée | Canal de crédit et transmission ; absence de marché développé ≠ absence de finance |
| Régime monétaire — `structuralProfiles.*.monetaryRegime` | Monnaie propre, union, ancrage ; à étendre à monnaie étrangère / plusieurs monnaies | Change, autorité d'émission et instruments disponibles explicités |
| Réserves extérieures — `foreignReserveMonthsImports` | Ratio dérivé de réserves utilisables et imports ; stock cible en devises | Distinguer réserves de banque centrale, fonds souverain et pétrole |
| Commerce — `tradeFlows`, `exportSharePctGdp`, `importSharePctGdp` | Flux annuels par partenaire/famille, même monnaie/base | Agrégation des flux ; périmètre de couverture externe explicite |
| Investissement / secteurs — `investmentSharePctGdp`, `sectors` | Investissement annuel ; parts de valeur ajoutée et capacités | Délais d'investissement, usure et productivité ; parts cohérentes |
| Informalité / disparités — `cible.structures` | Part estimée avec définition ; sous-ensembles territoriaux si utiles | Paramètres lents, activés si un mécanisme les consomme ; pas de malus universel |

Priorité de migration : choisir un déflateur et une conversion cohérents entre comptabilité réelle et nominale. Le PIB aux dollars courants d'une année ne devient pas automatiquement une série en dollars constants pour toutes les dates.

### 4.2 Énergie, ressources et routes

Convention cible : pétrole en **millions de tonnes** pour stocks/réserves et Mt/an pour flux ; gaz en **milliards de m³ normalisés** et Gm³/an. Fixer les conditions de référence du gaz dans la définition de série. Les conversions depuis barils ou TWh doivent conserver leur coefficient et leur source. Aucune conversion implicite des « unités ORDO » existantes.

| Champ cible / ancrage | Définition | Mise à jour / contrainte |
|---|---|---|
| Réserves extractibles — `energyNodes.*.provenReserves` | Quantité restante extractible selon périmètre défini | Extraction, découverte et réévaluation ; distincte de la capacité annuelle |
| Production / capacité — `annualProduction`, `annualCapacity` | Débit réalisé / débit soutenable installé | Disponibilité, investissement, déclin ; capacité nouvelle après délai |
| Consommation — `countryEnergy.*.annualDemand` | Besoin annuel ; distinguer cible et consommation satisfaite | Activité, prix, saison et rationnement |
| Stock — `cible.energy.storageLots` | Quantité par propriétaire, site, ressource et fonction commerciale/stratégique | Entrées/sorties physiques ; les réserves obligatoires sont une affectation, pas un second stock |
| Stockage — `cible.energy.storageSites` | Capacité utile, remplissage dérivé, débit maximal de retrait | Infrastructure ; capacité ≠ remplissage ≠ volume mobilisable aujourd'hui |
| Routes — `cible.routes` | Origine, destination, transits, ressource, débit, coût, accès, statut, dates | Projet, chantier, opérationnelle, perturbée ; pas de livraison avant ouverture |
| Contrats — `energyContracts`, `baselineEnergyFlows` | Volumes engagés, prix structuré, durée, parties, route et priorité | Livraisons réelles séparées des commandes ; aucune double allocation |
| Dépendance / couverture — dérivées | Importations nettes positives / consommation ; stocks / consommation ou importations | Afficher le dénominateur ; si nul, ratio non applicable, jamais division arbitraire |

Identité physique : stock final = stock initial + production + imports − exports − consommation satisfaite − pertes. Les flux entre sites et pays doivent se compenser dans le registre. Le gaz stocké dans un site national par une entreprise étrangère n'est pas automatiquement à la disposition de l'État.

Le registre mondial peut employer un agrégat « reste du monde », mais ses volumes doivent être limités, sourcés/calibrés et ne pas dupliquer les pays détaillés. Détailler un pays transfère sa part de cet agrégat.

### 4.3 Défense, industrie et moyens d'action

| Champ | Définition / unité | Usage, visibilité et évolution |
|---|---|---|
| `cible.defense.expenditure` | Monnaie, période, budget voté/exécuté, pensions et forces incluses | Comparaison harmonisée et financement ; chiffres publics selon observation |
| `cible.defense.personnel` | Personnes par force, actifs/réservistes ; conscrits sous-ensemble des actifs | Effectifs distincts des soldats projetables ; recrutement, formation, pertes, démobilisation |
| `cible.security.forces` | Police, gendarmerie, gardes, forces du parti ou autres forces selon pays | Autorité et missions propres ; aucune personne comptée dans deux totaux |
| `cible.defense.equipment` | Parc par famille : total, disponible, affecté ; partitions exclusives explicites | Opérations, maintenance, livraison ; vue renseignement pour disponibilité réelle |
| `cible.defense.sustainment` | Transport, ravitaillement, soutien et stocks agrégés par théâtre | Limite portée/durée ; pas de multiplication du budget en « puissance » universelle |
| `cible.defense.nuclearStatus` | Arsenal national, garantie extérieure, participation alliée, contrôle des moyens | Statuts distincts ; accueillir des armes ne signifie pas en décider l'emploi |
| `cible.bases.accessRights` | Propriétaire, opérateur, localisation, permissions datées | Accès effectif requis avant projection ; lien au traité |
| `armamentProducts`, `sectors` | Familles, fabricant, capacité/an, carnet, maturité technique et expérience | Production limitée et délais ; expérience au combat ≠ preuve de supériorité universelle |
| `cible.enterprises.control` | Propriétaires, contrôle effectif, droits de l'État, actifs | Un gouvernement ne commande pas automatiquement toutes les entreprises du pays |
| `capacities` | Charge disponible/engagée des six domaines existants | Administration, gouvernement, diplomatie, économie, renseignement, défense ; profils de moyens, pas monnaie politique |

Les capacités opérationnelles sont relatives à l'appareil concerné : « 80 % de moyens engagés » est comparable comme surcharge, pas comme puissance absolue entre deux pays. Une hausse de capacité requiert moyens, organisation et délai. La création nominale d'un ministère ne suffit pas. Les effets de surcharge par domaine restent un chantier distinct ; aucune corruption automatique universelle.

## 5. Institutions et engagements : droits et pouvoir effectif

| Champ cible | Définition / forme | Usage et rigueur |
|---|---|---|
| `cible.governments` | Gouvernement et juridiction représentée, période | Plusieurs autorités possibles sur un territoire ; exactitude des identités |
| `cible.institutions` | Organe, mode de nomination, mandat, compétences | Assemblée, cour, conseil, parti, monarque, administration… selon existence réelle |
| `cible.authorityRules` | Domaine/action → initiateur, décideurs, consentements, exécuteur | Distinguer compétence formelle et capacité d'exécution réelle |
| `cible.chambers` | Sièges, groupes, procédure, rôle consultatif/législatif | Collection facultative ; pas de faux parlement à remplir pour une monarchie |
| `cible.governingArrangements` | Coalition, accords de soutien, succession, règles de destitution | Stabilité par contexte ; aucune durée de survie prédéterminée |
| `cible.territorialPowers` | Compétences et recettes nationales/locales | Autorisations et transferts, sans doubler les comptes publics |
| `cible.organizations` | Charte/règles versionnées, organes, décisions collectives | Définition commune référencée par les pays |
| `cible.memberships` | Organisation, entité, membre/observateur/associé/suspendu, réserves, dates | Statut distinct selon organisation ; candidature ≠ accès aux droits |
| `cible.treatyClauses` | Parties, obligation, condition, bénéficiaire, échéance, état d'exécution | Une clause acceptée est conservée exactement ; violation suivie séparément |

Évaluer une action sur trois plans distincts : faisabilité matérielle, procédure juridique et acceptabilité politique. Une procédure peut être modifiée ou violée par une action explicite, avec réactions ; le simple souhait de l'IA ne change pas la constitution. Une alliance est un engagement dont la réponse dépend de ses clauses et décisions, pas une victoire militaire garantie.

## 6. Acteurs et orientations

Les pays n'ont pas une psychologie nationale unique. Les acteurs peuvent se contredire et détenir des pouvoirs différents selon le sujet.

| Champ cible / ancrage | Contenu | Évolution et usage |
|---|---|---|
| Acteurs — `leadership`, `stakeholderGroups`, `powerActors` | Personne/groupe, rôle, territoire/secteurs, rattachements | Nomination, organisation, disparition ; éviter les doublons entre personne et institution |
| Influence — `cible.actor.influenceChannels` | Pouvoir légal, mobilisation, expertise, argent, médias, force coercitive | Canaux séparés ; expertise militaire ne signifie pas contrôle politique |
| Cohésion / mobilisation — groupes et réactions | Capacité collective / engagement actuel | Désaccords internes, moyens, événements ; valeurs latentes avec échelle documentée |
| Doctrine — `politics.doctrine`, `decisionProfiles`, courants | Préférences par sujet et signaux, bénéficiaires, oppositions | Élections, réformes, apprentissage ; pas de pays condamné à optimiser son PIB |
| Personnalité — `leadership.figures.*.traits` | Tendances comportementales individuelles | Interprétation explicitée, pas score psychologique historique ; remplaçable avec l'acteur |
| Orientation — `cible.orientations` | Objet, porteurs, priorité, horizon, inertie, soutiens/opposants, déclencheurs de révision | Durable, moyen terme ou immédiate ; discours et moyens engagés peuvent diverger |
| Ligne rouge — `cible.actor.redLines` | Sujet, portée, caractère public/privé, conditions de compromis | Préférence forte ou tabou politique, distinct d'une impossibilité physique |
| Réaction — `stakeholderReactions` | Cause, groupe, intensité, tendance et réponses | Afficher faible/modérée/importante/critique ; causes traçables |

L'IA propose des réactions plausibles et peut matérialiser un acteur lorsque le dossier le justifie. Elle réutilise d'abord les acteurs existants. Les ressources et pouvoirs attribués sont contrôlés : créer un général mécontent ne crée pas une armée supplémentaire. Un nouveau personnage divergent conserve ce statut dans la provenance.

## 7. Dossiers, accords et historique

| Champ cible / ancrage | Définition | Rigueur / utilisation |
|---|---|---|
| `strategicDossiers` | Sujet, participants, phase, importance, liens causaux, dates | Importance pour le monde distincte de l'intérêt du joueur ; suivi ≠ activité réelle |
| `diplomaticSessions` | Participants, messages, révisions, positions par acteur | Une session multilatérale ne se réduit pas à deux pays ; positions privées filtrées |
| `cible.proposals` | Version, auteur, clauses, statut offert/accepté/refusé/retiré | Acceptation doit désigner une version exacte ; contre-proposition ≠ acceptation |
| `cible.commitments` | Parties tenues, clauses acceptées, conditions, calendrier | Source unique référencée par dossier et traité ; texte de résumé non exécutable |
| `actionPrograms`, `actions` | Intention, action validée, moyens, jalons, réalisation | Action demandée ≠ décidée ≠ exécutée ; continuité pendant les sauts de temps |
| `ledger` | Avant/après, cause, auteur logique, date, objets modifiés | Comptes et débogage causal ; visibilité propre aux événements |
| `historicalCurrents`, `latentProcesses` | Mouvements de fond, conditions et processus cachés | Tendances susceptibles de diverger ; calendrier historique non garanti |
| `cible.dossierSummaries` | Résumé daté, événements sources, révision | Compression du récit ; conserver clauses actives, échéances et engagements exacts |

## 8. Connaissances du joueur et de chaque IA

La rigueur de collecte historique appartient à l'outil de développement. Le brouillard de guerre appartient à la partie. Une source statistique imparfaite n'impose pas une jauge de confiance affichée en permanence.

| Champ cible | Définition |
|---|---|
| `cible.observations.subjectRef` | Donnée concernée dans le monde |
| `observerId / accessRule` | Acteur ou groupe autorisé à consulter |
| `value / knowledgeStatus` | Valeur publiée/connue, non connue ou non applicable |
| `observedAt / availableAt` | Date décrite et date à partir de laquelle l'information est connue |
| `channel` | Publication, administration, négociation, renseignement… |
| `estimateRange` | Facultative, seulement si l'incertitude importe réellement au choix |

Règles d'accès :

- Le conseiller du joueur voit ses connaissances publiques et internes autorisées ; aucune position secrète étrangère par défaut.
- L'IA incarnant un interlocuteur voit ses propres connaissances et intentions, pas les secrets du joueur.
- L'arbitrage des conséquences peut utiliser les faits privés nécessaires ; sa sortie publique passe par un filtre distinct.
- Un dirigeant n'est pas omniscient sur son propre pays : comptes administratifs, rapports militaires et préparatifs secrets d'un rival interne peuvent diverger.
- Dans un prototype local, masquer un champ dans l'interface ne protège pas la sauvegarde contre son inspection. La confidentialité multijoueur nécessiterait un état serveur séparé.

Filtrer les autorisations avant la sélection de pertinence pour l'IA. Sélectionner ensuite acteurs, domaine, contraintes, clauses et causes. Une recherche complémentaire doit respecter le même filtre. Ne jamais fournir tout le monde puis demander au modèle de garder les secrets.

## 9. Fiches dérivées et diagnostics

Une fiche peut afficher les chiffres autorisés, les institutions applicables, les organisations, les acteurs et les dossiers. Les sections sans objet sont omises ou expliquées simplement.

Chaque diagnostic conserve : `kind` (force/faiblesse/exposition/risque), titre, faits sources, date, règle de calcul/version, portée, tendance, leviers possibles et condition d'expiration. Les seuils qualitatifs doivent être documentés dans le module concerné.

Exemples de dérivation :

- Dépendance gazière : imports, concentration des fournisseurs, routes, stocks et retrait disponible ; un gros stock ne supprime pas la dépendance annuelle.
- Projection régionale : moyens disponibles, accès, distance et soutien ; aucun bonus italien ou français codé en dur.
- Coalition fragile : procédures de confiance, soutiens concernés et désaccords ; sans chambre, employer les rapports de force institutionnels appropriés.
- Orientation industrielle en recul : priorité affichée, investissements et évolution des capacités ; pas de suppression automatique de l'orientation après une mauvaise année.

Le texte IA est régénéré après un changement pertinent, pas à chaque affichage. Une explication devenue obsolète doit être invalidée. Un diagnostic peut proposer une action ; seul un événement/action validé produit un effet dans le monde.

## 10. Départ historique, pas de temps et collecte

Le scénario démarre au 1er janvier 2000. Les dirigeants et statuts institutionnels correspondent à cette date. Chaque série annuelle conserve sa période propre : un PIB annuel n'est pas un stock observé le 1er janvier.

Les observations de 1999 publiées ultérieurement peuvent servir à calibrer l'état initial reconstruit, mais ne deviennent pas automatiquement des informations disponibles à cette date. Les résultats de l'année 2000 entière servent à la calibration/évaluation, pas à imposer le résultat du premier exercice simulé.

Les taux annuels ne sont pas appliqués une fois par clic : le moteur tient compte de la durée écoulée. Pour un rythme annuel constant g, une évolution composée utilise `(1 + g)^(durée_en_années)`. Les échéances, événements et saisons interrompent le calcul en sous-périodes utiles. L'année d'un clic ne remplace pas douze échéances par une seule décision.

Pour chaque champ collecté : définition commune, source, période et unité ; source alternative documentée si la première manque. Les données proposées par un LLM entrent dans un lot à examiner. Un texte contenant « inconnu » n'autorise ni invention silencieuse ni conversion en zéro.

## 11. Articulation avec le prototype existant

État constaté par lecture du code ; aucun test exécuté pour établir ce dictionnaire.

| Élément existant | Écart avec la cible | Traitement prévu |
|---|---|---|
| `CountryState.politics` impose sièges et gouvernement | Modèle parlementaire implicite pour tous | Autorités par domaine et chambres facultatives ; adaptateur temporaire |
| `metrics.budget / industry / stability / security` | Agrégats génériques mêlés aux valeurs détaillées | Documenter les consommateurs, migrer vers comptes ou diagnostics ; aucune substitution silencieuse |
| `MacroSource` commun au pays | Provenance/périmètre parfois différent par indicateur | Référentiel de séries et métadonnées par champ |
| Macro annuelle 2000 chargée au 1er janvier | Résultat futur mélangé à l'état initial | Lot de calibration de départ distinct ; version de scénario nouvelle |
| `countryEnergy` et `energyNodes` portent des stocks/production | Risque de sources concurrentes | Désigner le registre physique propriétaire ; totaux pays dérivés |
| Stocks, routes et unités simplifiés | Propriété, débit et accessibilité incomplets | Migration explicite des unités et réservations avant nouveaux échanges |
| `defenseReference2000` dans `country-sheet.ts` | Référence statique, périmètre à auditer | Base historique séparée de la force évolutive ; pas de victoire déduite du tableau actuel |
| `KnownValue`, contexte IA avec visibilité | Concepts déjà présents, pas contrat uniforme pour toutes les vues | Unifier observations et filtrage ; absence de garantie générale à ce stade |
| Stratégie en listes de textes, personnalité et courants | Présent, mais porteurs/horizons/révisions incomplets | Orientations structurées reliées aux acteurs existants |
| `InstitutionState` désigne un chantier de ministère | Ne représente pas tous les organes de pouvoir | Garder les projets de construction et introduire les organes sans collision de sens |
| Traités/dossiers/relations | Certaines clauses et mémoires restent du texte | Clauses versionnées, relations par sujet et références partagées |
| `countrySheet` | Vue existante partielle | La faire dériver des connaissances autorisées ; aucune copie éditable de vérité |

## 12. Ordre d'implémentation et limite de périmètre

1. Implémenter les définitions de champs, statuts de disponibilité, provenance et unités ; préparer l'import sans modifier les anciennes sauvegardes implicitement.
2. Adapter l'identité et les autorités aux régimes variés ; définir les affiliations et les orientations révisables.
3. Relier les fiches et le contexte IA à la même couche de connaissances, puis aux diagnostics sourcés.
4. Migrer séparément les registres nécessitant un changement de calcul : comptabilité économique, énergie, forces et contrats.

Le socle commun impose identité, périmètre, gouvernement/autorités, statut de couverture des données, comptes macro et ressources nécessaires aux actions activées. Les autres collections peuvent être agrégées, facultatives ou vides avec une signification explicite. Tous les États restent soumis aux mêmes contraintes de ressources et au passage du temps.

Différer le détail provincial complet, les cohortes démographiques exhaustives, toutes les banques/entreprises et les chaînes de pièces industrielles. Ajouter un champ seulement s'il alimente une décision, un calcul, une réaction IA contextualisée ou une information utile et vérifiable pour le joueur.

Une nouvelle statistique suggérée par l'IA peut devenir un candidat de conception ou une observation de dossier. Elle ne rejoint le moteur fondamental qu'après définition de son unité, de son propriétaire, de son mécanisme et de sa migration. Cela permet d'apprendre des parties sans fabriquer des modificateurs permanents à chaque réponse.
