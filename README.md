# baba IAssou3

Application mobile de la **10ème édition** de la conférence chrétienne **« Suis-moi »** — thème **LES CHOIX**.

> Concept : inversion du chatbot. **L'IA initie**, l'utilisateur répond. Chaque message se termine par « Mais c'est TON choix. »

---

## Stack

- **Expo SDK 51** + **expo-router v3** (file-based)
- **React Native 0.74** + TypeScript strict
- **Supabase** (Auth, Postgres, Realtime, Edge Functions)
- **IA** : Gemini 2.0 Flash (principal) + Groq llama-3.3-70b (fallback)
- **Push** : Expo Push Service
- **State** : Zustand + TanStack Query
- **Animations** : Reanimated 3

---

## 1. Prérequis

| Outil | Version | Install |
|---|---|---|
| Node | ≥ 20 | `nvm install 20` |
| pnpm ou npm | — | au choix |
| Supabase CLI | ≥ 1.200 | `brew install supabase/tap/supabase` |
| EAS CLI | dernière | `npm i -g eas-cli` |
| Expo Go (test) | dernier | App Store / Play Store |

Tu as aussi besoin de :
- 1 projet **Supabase** (gratuit, [supabase.com](https://supabase.com))
- 1 clé API **Google Gemini** (gratuite, [aistudio.google.com](https://aistudio.google.com))
- Optionnel : 1 clé API **Groq** ([console.groq.com](https://console.groq.com))
- 1 compte **Expo** (gratuit)
- (Pour publication) 1 compte **Apple Developer** ($99/an) + 1 compte **Google Play Developer** ($25 one-shot)

---

## 2. Installation locale

```bash
git clone <repo>
cd baba-iassou3
npm install
cp .env.example .env
# remplis EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Démarrage en dev :

```bash
npm start          # ouvre Expo Dev Tools, scan le QR code avec Expo Go
```

⚠️ **Les notifications push ne fonctionnent PAS dans Expo Go**. Utilise un *development build* (`npx expo run:ios` / `run:android`) ou une EAS build « development » pour tester les notifs.

---

## 3. Mise en place Supabase

### 3.1 Créer le projet

1. Crée un projet sur [supabase.com](https://supabase.com) — choisis la région la plus proche (Frankfurt si Europe).
2. Récupère **URL** et **anon key** → mets-les dans `.env`.
3. Récupère **service_role key** (réglages > API) — garde-la secrète, elle sera utilisée par les Edge Functions.

### 3.2 Lier le projet local et appliquer le schéma

```bash
supabase login
supabase link --project-ref <ton-ref>      # ex: abcdefg
supabase db push                            # applique migrations/0001 → 0019
```

Si tu préfères copier-coller : exécute les fichiers `supabase/migrations/*.sql` dans l'ordre (0001 → 0019), ou `supabase db reset` en local.

### 3.3 Configurer Google OAuth

1. Console Google Cloud → crée un OAuth client (Web + iOS + Android).
2. Supabase Dashboard → Authentication → Providers → **Google** → colle Client ID / Secret.
3. URL de redirection à autoriser dans Google Cloud :
   - `https://<ton-projet>.supabase.co/auth/v1/callback`
   - `babaiassou3://auth`

### 3.4 Configurer Apple Sign In

1. Apple Developer → Identifiers → crée un Services ID `church.suismoi.babaiassou3.sign`.
2. Active **Sign in with Apple**, attache à ton App ID `church.suismoi.babaiassou3`.
3. Crée une **Key** Sign in with Apple → télécharge le fichier `.p8`.
4. Supabase Dashboard → Authentication → Providers → **Apple** → renseigne Team ID / Key ID / clé p8 / Services ID.

### 3.5 Déployer les Edge Functions

```bash
supabase functions deploy chat-respond
supabase functions deploy send-question
supabase functions deploy broadcast-notification
supabase functions deploy final-verse

# secrets utilisés par les fonctions
supabase secrets set GEMINI_API_KEY=AIzaSy...
supabase secrets set GROQ_API_KEY=gsk_...   # optionnel mais recommandé
```

(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par la plateforme.)

### 3.6 Promouvoir un admin

Après avoir créé ton premier compte via l'app :

```sql
update public.profiles set is_admin = true where email = 'admin@suismoi.church';
```

Ouvre l'app → icône clé à molette en haut à droite → écran admin.

---

## 4. Notifications push

- **Expo Go ne reçoit pas les push** — il faut un *development build* (`npx expo run:ios` / `run:android`) ou une build EAS.
- Au premier lancement après onboarding, l'app demande la permission et enregistre le token dans `push_tokens`.
- L'admin envoie via `send-question` (question + notif) ou `broadcast-notification` (message libre).
- Déployer aussi `broadcast-notification` :

```bash
supabase functions deploy broadcast-notification
```

- En **production**, EAS configure automatiquement les credentials (APNs key + FCM v1 server key) lors du premier `eas build`.
- Vérifier que `EAS_PROJECT_ID` / `extra.eas.projectId` dans `app.config.ts` correspond au projet Expo lié à la build.

---

## 5. Build & publication

### 5.1 Init EAS

```bash
eas login
eas init               # crée le projet Expo, génère EAS_PROJECT_ID → mets-le dans .env
```

### 5.2 iOS — App Store

```bash
# 1. profile production iOS
eas credentials               # une fois, choisir "Build credentials > Set up new"
eas build --platform ios --profile production
eas submit --platform ios
```

Checklist App Store :
- [ ] Compte **Apple Developer** actif ($99/an)
- [ ] App créée dans **App Store Connect** (bundle `church.suismoi.babaiassou3`)
- [ ] **Sign in with Apple** activé (obligatoire car on a Google login — App Store rule 4.8)
- [ ] Captures d'écran 6.7" + 6.5" + 5.5" (utilise [shotsnapp.com](https://shotsnapp.com) pour les composer)
- [ ] Politique de confidentialité (URL publique) — créer une page statique simple
- [ ] Champ « Privacy » dans ASC : Email, Identifier, Diagnostics
- [ ] Catégorie : **Lifestyle** ou **Reference**
- [ ] Âge : 4+
- [ ] Une review d'App Store **rejettera** si le contenu religieux est présenté comme « médical » ou « thérapeutique » — formule plutôt « accompagnement spirituel »

### 5.3 Android — Google Play

```bash
eas build --platform android --profile production
eas submit --platform android
```

Checklist Play Store :
- [ ] Compte Google Play Console ($25, paiement unique)
- [ ] Crée l'app dans la console (package `church.suismoi.babaiassou3`)
- [ ] Service account JSON pour `eas submit` → `google-play-service-account.json` à la racine
- [ ] Data safety form : collecte Email, Push token, contenu user (réponses)
- [ ] Politique de confidentialité (même URL que iOS)
- [ ] Captures 1080×1920, icône 512×512, feature graphic 1024×500
- [ ] **Internal testing** track d'abord, puis production

### 5.4 OTA updates (post-release)

```bash
eas update --channel production --message "fix: ..."
```

Les changements JS-only sont déployés sans repasser par les stores.

---

## 6. Estimation coûts IA (500 users, 1 journée)

- 5 questions × 500 users = **2 500 réponses chat** + **500 versets finaux** = **3 000 appels IA**.
- ~600 tokens entrée + 200 sortie par appel ≈ **1,8 M entrée + 0,6 M sortie**.
- **Gemini 2.0 Flash** :
  - tier gratuit = 15 RPM, 1 500 RPD, 1 M TPM → couvre à 99 % en lissant
  - si dépassement, tier payant ≈ **0,32 $** pour toute la conférence
- **Groq llama-3.3-70b** (fallback) :
  - 30 RPM, 14 400 RPD gratuits → couvre tout sans coût
  - si payant : ~0,9 $ pour la conf
- **Supabase free tier** : 500 MB DB, 2 GB egress, 500K Edge Function invocations/mois → largement suffisant
- **Expo Push** : gratuit, illimité

**Budget total estimé : 0 $ à 1 $.** Avec un compte de carte sur Google Cloud par sécurité au cas où le tier gratuit sature.

---

## 7. Architecture en bref

```
notif Expo  ←──  send-question  ←──  admin clic
    │                                    │
    ▼                                    ▼
 user ouvre app  ──► chat.tsx  ──► chat-respond ──► Gemini/Groq
                          │                            │
                          └── insert response ──► trigger ──► gauges (realtime ──► jauges.tsx)
                                                                │
                              admin flip is_finished ──► final-verse ──► verset-final.tsx
```

---

## 8. Scripts utiles

```bash
npm run typecheck                  # tsc --noEmit
npm run lint
npm run db:types                   # régénère src/types/database.ts depuis Supabase
supabase functions serve           # lance les Edge Functions en local
supabase db reset                  # réapplique toutes les migrations + seeds
```

---

## 9. Points d'attention théologiques / UX

- baba IAssou3 ne **prononce jamais** de jugement définitif. Ton paternel uniquement.
- Aucune réponse de l'IA ne doit prétendre se substituer à un accompagnement humain (pasteur, conseiller). Mentionne-le dans la page « À propos » si tu en ajoutes une.
- Les versets renvoyés par l'IA sont à vérifier par l'équipe **avant** la conférence : tester avec un compte « démo », noter les éventuelles hallucinations de référence, ajuster le system prompt si besoin (`supabase/functions/_shared/prompts.ts`).

---

## 10. Licence

Propriétaire. © Conférence « Suis-moi », 2026. Code généré sur mesure pour la 10ème édition.
