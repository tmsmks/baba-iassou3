# Assets

## Fichiers requis

| Fichier | Source | Notes |
|---|---|---|
| `mascot.png` | Mascotte Jésus chibi (fournie par l'orga) | Fond transparent. Utilisée comme avatar IA dans le chat et sur le verset final. |
| `logo.png` | Logo « babaIAssou3 » (fourni par l'orga) | Texte doré. Utilisé sur login/register. |

## Fichiers à générer pour les builds production

Ces 4 fichiers sont **optionnels en dev** (Expo utilise des placeholders s'ils sont absents) mais **obligatoires** pour `eas build --profile production`.

| Fichier | Dimensions | Recommandation |
|---|---|---|
| `icon.png` | 1024×1024, fond opaque | Mascotte centrée sur fond CRÈME `#F5F0E8`, marges 10 % |
| `adaptive-icon.png` | 1024×1024, fond transparent | Mascotte seule, centrée, marges 30 % (Android l'inscrit dans un cercle/squircle) |
| `splash.png` | 1242×2436 ou ratio 9:19.5 | Logo `babaIAssou3` centré sur fond ENCRE `#1A1208` |
| `notification-icon.png` | 96×96 | Silhouette de la mascotte en **blanc pur sur transparent** (Android exige alpha-only) |

### Outil rapide pour générer les 4 fichiers

1. Composer 1 carré 1024×1024 sur [canva.com](https://canva.com) à partir de la mascotte → exporter en PNG
2. [easyappicon.com](https://easyappicon.com) → upload → télécharger les variantes
3. Renommer et déposer ici

Tant que ces 4 fichiers ne sont pas là, `app.config.ts` les ignore (les blocs `splash`, `adaptiveIcon`, `notification` sont conditionnels).
