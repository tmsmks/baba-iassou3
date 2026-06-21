# Mise en production App Store — IAssou3

Guide opérationnel pour la soumission. Les sections marquées 🧑‍💻 sont des actions
**à faire par toi** dans App Store Connect (ASC) / Sentry / un hébergeur — Claude ne
peut pas les faire à ta place.

---

## 1. Politique de confidentialité 🧑‍💻

1. Héberge le fichier [`legal/privacy-policy.html`](./privacy-policy.html) sur une URL publique.
   - Option simple gratuite : **GitHub Pages** (place le fichier dans un repo public,
     active Pages, l'URL sera du type `https://<toi>.github.io/<repo>/privacy-policy.html`).
2. Complète dans le HTML : date, nom du responsable de traitement.
3. Colle l'URL obtenue dans **`src/lib/legal.ts`** → `PRIVACY_POLICY_URL`
   (sinon la ligne reste masquée dans l'écran « Mon compte »).
4. Renseigne la même URL dans ASC → **App Privacy → Privacy Policy URL**.

---

## 2. Questionnaire « App Privacy » (ASC) 🧑‍💻

À déclarer dans ASC → ton app → **App Privacy**. Voici quoi cocher (basé sur le code) :

| Type de donnée | Collectée ? | Liée à l'identité | Utilisée pour le pistage | Finalité |
|---|---|---|---|---|
| Adresse email | ✅ Oui | ✅ Oui | ❌ Non | Fonctionnalité de l'app, authentification |
| Nom | ✅ Oui | ✅ Oui | ❌ Non | Fonctionnalité de l'app |
| Date de naissance / autres données | ✅ Oui | ✅ Oui | ❌ Non | Fonctionnalité de l'app |
| Contenu utilisateur (photos, messages, réponses) | ✅ Oui | ✅ Oui | ❌ Non | Fonctionnalité de l'app |
| Identifiants (user ID) | ✅ Oui | ✅ Oui | ❌ Non | Fonctionnalité de l'app |
| Données de diagnostic / crash (Sentry) | ✅ Oui | ❌ Non | ❌ Non | Diagnostic / amélioration |

**Pistage (App Tracking Transparency) : NON.** L'app ne fait aucun pistage publicitaire.

> ⚠️ Comme tu ne fais aucun tracking, envisage de **retirer** la clé
> `NSUserTrackingUsageDescription` de `app.config.ts` (elle déclenche sinon une demande
> ATT inutile). Dis-le moi si tu veux que je l'enlève.

---

## 3. Suppression de compte — OÙ LA TROUVER (note pour le reviewer)

Apple vérifie ce point. Dans les **Notes du reviewer** (ASC → version → App Review Information), écris :

> « Pour supprimer le compte : ouvrir l'app → onglet Chat → icône profil (en haut à
> gauche) → "Mon compte" → "Supprimer mon compte". La suppression est définitive. »

Fournis aussi un **compte de démonstration** (email + mot de passe d'un compte de test)
pour que le reviewer puisse se connecter sans recevoir d'invitation.

---

## 4. Fiche App Store — textes (brouillons à ajuster) 🧑‍💻

- **Nom** : IAssou3
- **Sous-titre (30 car. max)** : `Ta conférence, en interactif`
- **Catégorie** : Style de vie (Lifestyle) — ou Références.
- **Classification d'âge** : viser 12+ (contenu thématique religieux).
- **URL de support** 🧑‍💻 : une page ou un email de contact (ex. `mailto:maksimous.t@gmail.com` ne suffit pas, Apple veut une URL — une page simple convient).
- **URL marketing** : facultatif.

**Description (brouillon) :**
```
IAssou3 t'accompagne pendant la conférence : réponds aux questions du jour,
suis tes 5 jauges (Clarté, Honnêteté, Orientation, Impartialité, X), retrouve le
carnet de chants, le programme, le mur photos, et participe au jeu de l'ami secret.

• Réponds aux questions envoyées en direct
• Visualise ta progression sur les 5 jauges
• Consulte les chants (paroles en PDF) et le programme
• Partage des photos avec les autres participants
• Découvre et écris à ton ami secret

Aucune publicité, aucun pistage.
```

**Mots-clés (100 car. max, séparés par des virgules)** :
```
conférence,foi,chrétien,jauges,chants,programme,communauté,spiritualité,événement
```

---

## 5. Captures d'écran 🧑‍💻

Apple exige au minimum le format **6.7"** (iPhone 15/16 Pro Max — **1290 × 2796 px**).
Un seul jeu 6.7" suffit désormais (Apple l'adapte aux autres tailles).

- Prévois **3 à 6 captures** : Chat, Jauges, Chants/PDF, Programme, Mur photos.
- Prends-les sur un vrai device ou le simulateur (`expo run:ios` puis ⌘+S).

---

## 6. Technique avant soumission

- [ ] **Build de prod** intégrant tous les changements : `npm run build:ios`
- [ ] **`supabase db push`** (migrations 0043 + 0044 : RPC backfill + suppression de compte)
- [ ] Vérifier que **Sign in with Apple** fonctionne (obligatoire car Google est proposé) ✅ déjà configuré
- [ ] Vérifier les **notifications push** en prod (certificat APNs de prod)
- [ ] Tester sur device réel : inscription → onboarding → chat → suppression de compte
- [ ] (Recommandé) Source maps Sentry (voir conversation)
- [ ] `npm run submit:ios` puis remplir la fiche + soumettre

---

## 7. Récap des bloqueurs Apple et leur état

| Bloqueur | État |
|---|---|
| Suppression de compte in-app | ✅ Codé (écran Mon compte + RPC `delete_my_account`) |
| Politique de confidentialité | ⏳ Rédigée — **à héberger + URL à coller** |
| Questionnaire App Privacy | ⏳ Pré-rempli ici — **à saisir dans ASC** |
| Fiche App Store (textes/captures) | ⏳ Textes fournis — **captures à prendre** |
