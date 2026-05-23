-- Seed minimal du programme (à éditer ensuite via l'admin in-app)
insert into public.program (heure_debut, heure_fin, titre, intervenant, description, ordre) values
  (now()::date + interval '9 hours',  now()::date + interval '9 hours 30 minutes',  'Accueil & louange',                'Équipe louange',  'Ouverture de la 10ème édition « Suis-moi »', 1),
  (now()::date + interval '9 hours 30 minutes', now()::date + interval '10 hours 30 minutes', 'Plénière — Clarté',      'Pasteur invité',  'Se connaître et reconnaître ce que l''on valorise', 2),
  (now()::date + interval '10 hours 45 minutes', now()::date + interval '11 hours 45 minutes', 'Plénière — Honnêteté', 'Pasteur invité',  'Honnête face à mes capacités', 3),
  (now()::date + interval '13 hours', now()::date + interval '14 hours', 'Atelier — Orientation', 'Animateurs',  'Mes choix m''alignent-ils sur mon but ?', 4),
  (now()::date + interval '14 hours 15 minutes', now()::date + interval '15 hours 15 minutes', 'Atelier — Impartialité', 'Animateurs',  'Voir les red flags en face', 5),
  (now()::date + interval '15 hours 30 minutes', now()::date + interval '16 hours 30 minutes', 'Plénière — X factor', 'Pasteur invité',  'Accepter l''inconnu de Dieu', 6),
  (now()::date + interval '16 hours 30 minutes', now()::date + interval '17 hours',  'Carte finale & temps de prière', 'Équipe',        'Reçois ton verset personnel', 7);
