# Motor's Events — Supabase

## 1. Configuration

Dans `supabase-config.js`, conserve uniquement :
- l'URL de ton projet Supabase
- la clé **Publishable** (`sb_publishable_...`)

Ne mets jamais `sb_secret_...` dans le frontend.

## 2. Base déjà installée

Le fichier `supabase.sql` contient le schéma principal : profils, événements, favoris, RLS et Storage.

Si le schéma principal est déjà installé, **ne le relance pas inutilement**.

## 3. Nouvelle fonctionnalité sociale

Pour activer la wishlist synchronisée et les abonnements entre membres :

1. Supabase → SQL Editor → New query
2. Ouvre `supabase-social.sql`
3. Copie tout le contenu
4. Clique sur **Run**

Ce fichier ajoute la table `follows`, ses index, ses policies RLS et la fonction sécurisée utilisée pour compter les abonnés/abonnements sans exposer publiquement les relations.

## 4. Fonctionnement

- Un visiteur peut consulter les profils publics.
- Un membre connecté peut suivre un autre membre.
- Un membre ne peut pas se suivre lui-même.
- Les abonnements sont privés à leur propriétaire via RLS.
- La wishlist des événements Supabase est stockée dans `favorites`.
- Les événements ajoutés à la wishlist restent liés au compte après reconnexion.
- Les événements normaux restent soumis au workflow `pending → approved/rejected`.

## 5. Sécurité

Le frontend utilise uniquement la clé Publishable. Les permissions sensibles sont appliquées côté PostgreSQL avec les grants et RLS.

## Communauté

Après la migration sociale, exécuter une fois `community.sql` dans le SQL Editor. Elle crée la fonction publique `get_top_publishers()` qui ne compte que les événements `approved` et respecte les RLS existantes.
