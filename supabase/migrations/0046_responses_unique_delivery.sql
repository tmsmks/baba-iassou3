-- Une seule réponse par question (delivery).
--
-- Aligne le schéma sur l'intention de l'UI ("Une seule réponse par question",
-- voir app/(tabs)/chat.tsx) et coupe l'amplification de coût IA : sans cette
-- contrainte, un client pouvait re-POSTer la fonction `chat-respond` en boucle sur
-- le même delivery_id — chaque appel payant un appel OpenAI ET insérant une ligne,
-- ce qui diluait en plus les jauges (calculées en avg(score)).
--
-- `chat-respond` renvoie désormais la réponse existante sans rappeler l'IA ; cette
-- contrainte verrouille en plus les courses (double-tap / appels concurrents) au
-- niveau base. Vérifié : aucun doublon existant au moment de l'ajout.
alter table public.responses
  add constraint responses_delivery_id_key unique (delivery_id);
