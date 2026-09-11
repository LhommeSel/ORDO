# Audit des 100 fiches nationales — 2000

## Périmètre

Les 80 fiches ajoutées au noyau initial ont été comparées aux indicateurs World
Development Indicators de la Banque mondiale pour l'année 2000. L'audit est
réalisé par `scripts/verify-national-baseline.ts` et ne modifie aucune donnée.

Sources de référence : [PIB courant](https://data.worldbank.org/indicator/NY.GDP.MKTP.CD),
[population](https://data.worldbank.org/indicator/SP.POP.TOTL),
[croissance du PIB](https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG),
[inflation](https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG),
[chômage](https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS) et
[industrie (% du PIB)](https://data.worldbank.org/indicator/NV.IND.TOTL.ZS).

## Résultat du contrôle numérique

| Champ | Valeurs disponibles | Dans ±25 % de la série de référence | Écart >50 % à revoir |
| --- | ---: | ---: | ---: |
| PIB courant | 80/80 | 78 | 0 |
| Population | 80/80 | 80 | 0 |
| Croissance | 79/80 | 66 | 0 |
| Croissance démographique | 80/80 | 65 | 6* |
| Inflation | 69/80 | 66 | 0 |
| Chômage | 80/80 | 45 | 29 |
| Industrie | 75/80 | 45 | 4 |

\* Les six écarts de croissance démographique sont calculés autour de taux
proches de zéro : un écart absolu de quelques dixièmes produit artificiellement
un grand écart relatif.

Les écarts les plus manifestes ont été corrigés dans la source : PIB de l'Iran,
de l'Irak, de la Serbie, du Turkménistan et du Mozambique ; croissance ou
inflation de plusieurs pays en crise ou en transition ; et quelques taux de
croissance démographique. Les valeurs restent arrondies pour le scénario.

## Ce qui n'est pas automatiquement écrasé

Le chômage n'est pas comparable de façon homogène en 2000 : les enquêtes, le
secteur informel et les définitions nationales diffèrent fortement. La série
Banque mondiale est utile comme repère, mais remplacer mécaniquement les valeurs
ORDO créerait de fausses précisions. Même prudence pour la part de l'industrie,
qui dépend de la définition du secteur et de la disponibilité des comptes
nationaux.

Les champs `orientation`, `interests`, `vulnerabilities`, `redLines`,
`partners`, `rivals`, `stability`, `security`, `confidence` et `openness` sont
des paramètres de simulation et d'écriture, pas des statistiques observées.
Ils doivent être relus comme des hypothèses de gameplay, pays par pays, avant
de présenter le jeu comme une reconstitution historique exhaustive.

## Contrôle politique ponctuel

Trois erreurs de date évidentes ont été rectifiées pour le 1er janvier 2000 :
Viktor Klima n'était pas encore remplacé par Wolfgang Schüssel en Autriche,
Paavo Lipponen était Premier ministre finlandais (avec Martti Ahtisaari à la
présidence), et la Syrie était encore dirigée par Hafez al-Assad. Une vérification
historique détaillée des 80 gouvernements reste un chantier distinct.

## Conclusion

Le lot est suffisamment cohérent pour le prototype et le moteur macro. Il ne
constitue pas encore une base statistique certifiée : le prochain passage utile
sera une revue des lignes politiques et des indicateurs difficiles à comparer,
avec une source et une date explicites pour chaque pays.
