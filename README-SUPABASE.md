MOTOR'S EVENTS — INSTALLATION SUPABASE

1. Crée un projet sur https://supabase.com/dashboard
2. Va dans Project Settings > API.
3. Copie Project URL et la Publishable key (ou l'ancienne anon key).
4. Ouvre supabase-config.js et remplace les deux valeurs YOUR-...
5. Dans Supabase > SQL Editor, colle tout le contenu de supabase.sql puis Run.
6. Dans Authentication > URL Configuration, ajoute l'URL de ton site Vercel.
7. Déploie le dossier motors-events sur Vercel.

IMPORTANT
- Ne mets jamais la service_role key dans le navigateur.
- Le fichier supabase.sql active RLS.
- Les événements créés par un membre commencent en pending.
- Pour créer ton premier administrateur : crée d'abord ton compte, puis dans Table Editor > profiles, mets role = admin sur ton profil.
