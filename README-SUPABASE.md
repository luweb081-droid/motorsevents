# Motor's Events — V3 Supabase

## 1. Supabase
1. Ouvre ton projet Supabase.
2. SQL Editor → New query.
3. Colle `supabase.sql` → Run.
4. Vérifie `profiles`, `events`, `favorites` dans Table Editor.
5. Vérifie `avatars` et `event-images` dans Storage.

## 2. Configuration
Dans `supabase-config.js`, garde uniquement :
- Project URL
- Publishable key (`sb_publishable_...`)

Ne mets jamais de `sb_secret_...` dans le site.

## 3. Lancer le site
Ne double-clique pas sur `index.html`. Utilise un serveur local, par exemple :

```bash
python -m http.server 5500
```

Puis ouvre `http://localhost:5500`.

## 4. Authentification
Dans Supabase → Authentication → URL Configuration, ajoute ton URL locale et ton URL Vercel.

Exemple :
- `http://localhost:5500`
- `https://ton-projet.vercel.app`

## 5. Compte test
Tu peux créer un utilisateur depuis Authentication → Users, ou depuis le bouton Compte du site.
Le trigger SQL crée automatiquement sa ligne `profiles`.

## 6. Admin
Après avoir créé ton compte, dans Table Editor → profiles, change `role` de `user` à `admin` pour ton propre compte de test. Le site affichera alors l'espace de modération.


## Sécurité
- La clé `sb_publishable_...` peut être utilisée côté navigateur ; ne mets jamais de clé `sb_secret_...`.
- Les permissions importantes sont appliquées par RLS côté Supabase, pas seulement par l'interface.
- Le rôle `admin` est protégé côté base : un utilisateur normal ne peut pas se promouvoir lui-même.
- Pour une mise en production plus avancée, ajoute une protection anti-abus/rate limiting et surveille les logs Supabase.
