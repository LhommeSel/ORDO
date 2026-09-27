# France, janvier 2000 — lecture des capacités

Les valeurs sont des indices de jeu sur 100. Elles ne mesurent ni les dépenses publiques, ni des effectifs réels. Le **plafond** représente le niveau structurel durable que l'État peut atteindre ; l'**engagement** représente la part déjà mobilisée par les missions ordinaires. La différence est donc la marge immédiatement disponible pour de nouvelles décisions.

| Capacité | Plafond | Déjà engagée | Marge | Justification de départ |
| --- | ---: | ---: | ---: | --- |
| Coordination gouvernementale | 68 | 31 | 37 | Institutions solides et administration centrale expérimentée, mais cohabitation Chirac–Jospin : les arbitrages stratégiques doivent composer avec deux pôles exécutifs. La coordination interministérielle, européenne et territoriale absorbe déjà une part durable des moyens. |
| Administration | 72 | 42 | 30 | Appareil public dense, administrations centrales et territoriales compétentes, capacité élevée de mise en œuvre. Services sociaux, éducation, finances publiques et gestion territoriale consomment toutefois une charge structurelle élevée. |
| Diplomatie | 64 | 36 | 28 | Réseau diplomatique mondial, siège au Conseil de sécurité, poids européen et multilatéral. L'Union européenne, les alliances, les ambassades et les dossiers africains et méditerranéens fixent déjà une large part de l'activité. |
| Conduite économique | 62 | 39 | 23 | Direction du Trésor, administration fiscale et expertise économique robustes. L'euro naissant, les comptes sociaux, l'emploi et la préparation budgétaire limitent la capacité libre. |
| Renseignement | 55 | 30 | 25 | Services extérieurs et intérieurs compétents, mais moyens techniques et couverture mondiale inférieurs aux grandes puissances. Contre-espionnage, lutte antiterroriste et veille extérieure constituent le socle engagé. |
| Défense | 70 | 43 | 27 | Dissuasion nucléaire, armées professionnalisées, projection extérieure et industrie de défense donnent un plafond élevé. Disponibilité des forces, maintenance, opérations extérieures et soutien logistique utilisent déjà une part importante des moyens. |

## Règle de conception

Ces nombres sont maintenant calculés dans le scénario à partir de la fiche [`france2000CapacityBaseline`](../lib/simulation/capacity-baselines.ts) : chaque plafond et engagement est la somme des composantes affichées au joueur. Les composantes restent des indices de gameplay, à calibrer progressivement avec des séries historiques homogènes. La même structure pourra ensuite être renseignée pour chaque pays.

## Vocabulaire

La coordination gouvernementale est la faculté du chef du gouvernement, des cabinets et des services interministériels à fixer des priorités, faire circuler l'information et trancher entre ministères. Elle ne désigne pas un ministère supplémentaire, ni une politique publique précise.

## Couverture internationale

Le même calcul est désormais attaché aux 22 pays majeurs explicitement modélisés dans le scénario. Les dix premiers par poids sont les États-Unis, le Japon, la Chine, l'Allemagne, la France, la Russie, l'Inde, le Royaume-Uni, le Canada et le Brésil. Le Brésil est retenu en cas d'égalité avec l'Espagne, car il apparaît en premier dans le registre à poids égal. Les fiches hors France utilisent les mêmes trois postes par plafond et par engagement, avec un contexte national explicite ; elles pourront être affinées par des facteurs historiques encore plus spécifiques.

## Lecture budgétaire

Le nombre affiché dans le registre n'est plus présenté comme une somme d'argent. La fiche fiscale sépare les ratios de finances publiques (recettes, dépenses, solde et dette) des unités de jeu : la **marge discrétionnaire** finance les programmes ordinaires, tandis que la **réserve d'urgence** finance les renforts temporaires. Pour la France, les 246 crédits initiaux se lisent donc comme 210 de marge et 36 de réserve, et non comme 246 euros ou 246 milliards.
