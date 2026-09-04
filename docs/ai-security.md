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
| `AI_PER_SESSION_PER_DAY` | configuration | `20` |
| `AI_MAX_INFLIGHT` | configuration | `4` |
| `AI_MAX_OUTPUT_TOKENS` | configuration | `1400` |

Ne jamais enregistrer les deux secrets dans le code, `.openai/hosting.json`, une sauvegarde ou une archive.

## Limite actuelle du prototype

Les compteurs applicatifs sont conservés dans la mémoire de chaque instance serveur. Ils limitent les abus ordinaires, mais ne constituent pas un plafond financier mondial durable lorsque plusieurs instances fonctionnent en parallèle. La limite dure du projet OpenAI reste donc obligatoire.

Avant une bêta publique gratuite, remplacer ces compteurs par un quota durable lié à un compte joueur et stocké dans D1, ajouter une protection antibot, puis vérifier le coupe-circuit par un test contrôlé. Ne pas publier un accès anonyme illimité.
