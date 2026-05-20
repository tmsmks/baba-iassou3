-- Seed minimal du programme (à éditer ensuite via l'admin in-app)
insert into public.program (heure_debut, heure_fin, titre, intervenant, description, ordre) values
  (now()::date + interval '9 hours',  now()::date + interval '9 hours 30 minutes',  'Accueil & louange',                'Équipe louange',  'Ouverture de la 10ème édition « Suis-moi »', 1),
  (now()::date + interval '9 hours 30 minutes', now()::date + interval '10 hours 30 minutes', 'Plénière — Clarté',      'Pasteur invité',  'Se connaître et reconnaître ce que l''on valorise', 2),
  (now()::date + interval '10 hours 45 minutes', now()::date + interval '11 hours 45 minutes', 'Plénière — Honnêteté', 'Pasteur invité',  'Honnête face à mes capacités', 3),
  (now()::date + interval '13 hours', now()::date + interval '14 hours', 'Atelier — Orientation', 'Animateurs',  'Mes choix m''alignent-ils sur mon but ?', 4),
  (now()::date + interval '14 hours 15 minutes', now()::date + interval '15 hours 15 minutes', 'Atelier — Impartialité', 'Animateurs',  'Voir les red flags en face', 5),
  (now()::date + interval '15 hours 30 minutes', now()::date + interval '16 hours 30 minutes', 'Plénière — X factor', 'Pasteur invité',  'Accepter l''inconnu de Dieu', 6),
  (now()::date + interval '16 hours 30 minutes', now()::date + interval '17 hours',  'Carte finale & temps de prière', 'Équipe',        'Reçois ton verset personnel', 7);

-- Seed des questions (l'admin peut en ajouter ensuite)
insert into public.questions (lettre, texte, ordre) values
  ('C', 'Si je devais nommer trois choses qui me passionnent vraiment, lesquelles me viennent en premier ?', 1),
  ('H', 'Sur ce choix que je porte en ce moment, ai-je les compétences réelles, ou est-ce que je me raconte une histoire ?', 2),
  ('O', 'Ce que je m''apprête à choisir me rapproche-t-il du but que je sens posé sur ma vie, ou m''en éloigne-t-il ?', 3),
  ('I', 'Quel est le red flag que tout le monde voit, sauf moi ?', 4),
  ('X', 'Quelle part d''inconnu est-ce que j''accepte de confier sans en avoir le contrôle ?', 5);
