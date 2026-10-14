/* ─────────────────────────────────────────────────────────────
   Arcadia Academy – configuration de la landing page
   Seul fichier à modifier pour la mise en ligne.
   ───────────────────────────────────────────────────────────── */
window.ARCADIA_CONFIG = {
  // URL "Production" du nœud Webhook n8n (méthode POST).
  // Ex. : 'https://n8n.mondomaine.com/webhook/arcadia-lead'
  webhookUrl: 'https://n8n.srv1019025.hstgr.cloud/webhook/arcadia',

  // Assistant de la page merci (webhook n8n, POST { chatInput, sessionId }).
  // Le workflow doit renvoyer la réponse : { "output": "..." } (nœud « Respond to Webhook »).
  // Laisser vide pour masquer l'assistant.
  chatbotUrl: 'https://n8n.srv1019025.hstgr.cloud/webhook/600a8c7f-86d3-48f7-a1e6-a33971f9cb7c',

  // Bouton WhatsApp de la page merci uniquement (la landing reste 100 % formulaire).
  // Format international sans + ni espaces. Ex. : '212612345678'. Laisser vide pour masquer le bouton.
  whatsappNumber: '212661262657',

  // Page affichée après un envoi réussi (chemin depuis la racine : fonctionne aussi depuis /form et /bac).
  thankYouUrl: '/merci.html',

  // Identifiants publicitaires (laisser vide pour désactiver).
  metaPixelId: '1120152330417815',
  gtmId: '',         // Ex. 'GTM-XXXXXXX'
  clarityId: 'yxqbga3cwq',   // Microsoft Clarity (enregistrements de session + cartes de chaleur)

  // Témoignages RÉELS (parents / élèves ayant donné leur accord).
  // La section « Ils nous ont fait confiance » s'affiche dès qu'il y a au moins un avis.
  // Format :
  // { texte: 'Le témoignage, mot pour mot.', nom: 'Prénom N.', details: 'Parent · 2ème Bac PC', resultat: '16,5/20 au national' },
  testimonials: [
  ],
};
