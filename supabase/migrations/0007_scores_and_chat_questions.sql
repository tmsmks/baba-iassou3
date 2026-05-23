-- Scores 0-5 + catalogue des 5 questions chat (1 par lettre CHOIX)

alter table public.responses drop constraint if exists responses_score_check;
alter table public.responses add constraint responses_score_check check (score between 0 and 5);

insert into public.questions (lettre, texte, ordre, is_onboarding) values
  ('C', 'On te propose deux postes. Le premier est bien payé mais te détourne de ce qui te passionne vraiment. Le second, moins rémunéré, correspond à ta vocation et te rapproche des gens qui comptent (famille, communauté). Tu choisis lequel — et qu''est-ce que ce choix dit de ce que tu valorises VRAIMENT, devant Dieu et devant toi-même ?', 1, false),
  ('H', 'Il y a quelque chose (péché récurrent, habitude, motivation cachée) que tu confesses du bout des lèvres mais que tu ne lâches pas vraiment — peut-être que tu en parles même à Dieu, en sachant que tu vas y retomber demain. Quoi exactement, et qu''est-ce que tu gagnes à le garder ?', 2, false),
  ('O', 'Tu reçois une belle opportunité (poste, études à l''étranger, voyage, projet) qui te ferait rater des choses importantes pendant des mois : ton église, des relations clés, quelque chose que Dieu avait mis sur ton cœur. Tu acceptes ou pas ? Pourquoi VRAIMENT, sans la version polie ?', 3, false),
  ('I', 'Cite-moi une personne (ami proche, frère ou sœur dans la foi, parent) qui voit en toi quelque chose que tu refuses d''admettre. Qu''est-ce qu''elle voit exactement ? Et si le Saint-Esprit te disait la même chose, est-ce que tu l''écouterais mieux ?', 4, false),
  ('X', 'Il y a un domaine où tu essaies de tout contrôler (couple, avenir professionnel, image, foi, finances, santé…) au point que cela t''épuise. Si tu le confiais vraiment à Dieu cette semaine, qu''est-ce que cela changerait concrètement — qu''est-ce que tu pourrais relâcher dès demain ?', 5, false);
