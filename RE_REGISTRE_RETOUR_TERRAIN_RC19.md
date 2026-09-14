# RC19 — registre du retour de la session de deux heures

Ce registre suit les nouveaux retours de PE. Il ne remplace pas le registre historique et ne transforme pas une demande de réalisme/performance en certification absolue.

| Référence | Travail livré | Preuve | Validation restant extérieure |
|---|---|---|---|
| FIELD01 | Conservation/réhydratation des blocs actifs ; conflit interdit après nettoyage | RC18 : 24→0 blocs et conflit accepté ; RC19 : 24→24 et conflit refusé ; tests de queue 750 m | Le réseau réel de la sauvegarde de PE n'a pas été exécuté ici |
| FIELD02 | Indications à l'entrée du bon bloc, réservation propre, sens, cabine hors champ ; freinage/réouverture | 16 tests, dont moteur complet et distant vers signal fermé, puis reprise | Tous les systèmes réglementaires et la localisation réelle des signaux ne sont pas implémentés/certifiés |
| FIELD03 | Six graphiques manipulables en lecture, recettes et dépenses ensemble | Vrai navigateur : saisie, zoom, clavier, données inchangées | Ergonomie sur le PC de PE à confirmer |
| FIELD04 | Récapitulatif financier complet et historiques conservés ; exports intégrals | 1 600 opérations/64 jours, pagination et recherche, vrais JSON/CSV | Anciennes écritures supprimées irrécupérables ; quota pas illimité |
| FIELD05 | Cache exact borné du tracé sélectionné, sélection des portions pertinentes | Six images identiques à la référence exacte ; benchmark indépendant ×12,92 fixe et ×7,47 déplacement sur grand tracé | FPS/mémoire sur la session réelle de onze trains non mesurés |
| FIELD06 | Tranches de rattrapage prioritaires entre dessins, horloge et positions ensemble | 100 ms inchangés, minutes rejouées, zéro temps physique abandonné, sauvegarde/reprise au même curseur | Délai final d'une longue absence non garanti sur Opera/Win7 |

Les correctifs et fonctions ci-dessus sont livrés et passent leurs critères automatisés. La confirmation terrain des performances et du cantonnement sur la partie utilisateur reste nécessaire. Aucune nouvelle exclusion de test ; les 11 exclusions historiques S3 sont conservées.

Les limitations de typage strict historique (36 any, 28 expect-error et déclarations globales larges), de services externes et de plateforme ne sont pas reclassées en succès.
