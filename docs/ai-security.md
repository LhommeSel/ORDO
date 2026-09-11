# Sécurité de l’intégration IA d’ORDO

## Frontière de confiance

- Le navigateur n’accède jamais à `OPENAI_API_KEY`.
- Le navigateur envoie un contexte compact à `/api/ai/advisor`, jamais la sauvegarde complète.
- Le modèle et le plafond de sortie sont imposés par le serveur.
- La réponse de Luna respecte un schéma JSON puis subit une seconde validation locale.
- Une réponse IA reste consultative. Seul le moteur d’ORDO peut produire des effets de jeu.
- Les requêtes et réponses OpenAI utilisent `store: false`.

## Variables du serveur

| Nom | Type | Valeur de départ conseillée |
| --- | --- | --- |
| `OPENAI_API_KEY` | secret | clé du projet OpenAI ORDO |
| `AI_RATE_LIMIT_SALT` | secret | chaîne aléatoire propre à la production |
| `AI_ENABLED` | configuration | `true` uniquement après pose des limites OpenAI |
| `AI_DAILY_BUDGET_USD` | configuration | `0.50` |
| `AI_PER_IP_PER_MINUTE` | configuration | `4` |
| `AI_PER_IP_PER_DAY` | configuration | `60` |
| `AI_PER_SESSION_PER_DAY` | configuration | `20` |
| `AI_MAX_INFLIGHT` | configuration | `4` |
| `AI_MAX_OUTPUT_TOKENS` | configuration | `1400` |
| `AI_MAX_REQUEST_BYTES` | configuration | `160000` |

Ne jamais enregistrer les deux secrets dans le code, `.openai/hosting.json`, une sauvegarde ou une archive.

## Limite actuelle du prototype

Les limites minute et le nombre de requêtes simultanées restent en mémoire pour couper rapidement les rafales. Les compteurs quotidiens par IP et par partie, ainsi que le coût global de la journée, sont persistés dans D1 lorsque le binding `DB` est disponible ; les clés stockées sont des hachés et aucun contenu de partie n’y figure. En local ou si D1 est momentanément indisponible, le serveur revient aux compteurs mémoire et la limite dure du projet OpenAI reste obligatoire.

Avant une bêta publique gratuite, lier le quota à un compte joueur (plutôt qu’à la seule clé de partie), ajouter une protection antibot, puis vérifier le coupe-circuit par un test contrôlé. Ne pas publier un accès anonyme illimité.
