/**
 * ============================================================
 *  TALENT BRIDGE — Serveur Proxy API Claude (Agent IA Chat)
 * ============================================================
 *  Rôle : Sécuriser la clé API Anthropic côté serveur
 *  et la transmettre aux requêtes du site web.
 *
 *  Stack : Node.js + Express + CORS
 *  Version recommandée Node : >= 18
 * ============================================================
 */

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── SÉCURITÉ : Origines autorisées ───────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (Postman, serveur local)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origine non autorisée : ${origin}`));
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' })); // Limite la taille des requêtes

// ─── HEALTH CHECK ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Talent Bridge AI Proxy', time: new Date().toISOString() });
});

// ─── ROUTE PRINCIPALE : Proxy vers l'API Anthropic ────────────
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('[ERROR] ANTHROPIC_API_KEY non définie dans .env');
    return res.status(500).json({ error: 'Clé API manquante côté serveur.' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Paramètre "messages" manquant ou invalide.' });
  }

  // Limiter l'historique à 20 messages max (sécurité + coût)
  const trimmedMessages = messages.slice(-20);

  // Système prompt de l'agent Amina
  const SYSTEM_PROMPT = `Tu es Amina, la conseillère virtuelle de Talent Bridge, une agence spécialisée dans l'accompagnement des demandes de visa et d'inscription universitaire vers l'Europe (principalement la France), fondée au Cameroun.

PERSONNALITÉ : Chaleureuse, professionnelle, bienveillante. Tu t'exprimes en français, avec parfois des expressions adaptées au contexte camerounais. Tu es enthousiaste et tu rassures les clients.

SERVICES TALENT BRIDGE :
- Visa Étudiant (Campus France, Licence, Master, Doctorat) — procédure DAP, dossier blanc
- Visa Travail (salarié, entrepreneur, Passeport Talent, changement de statut étudiant→travail)
- Visa Touriste / Schengen (court séjour 90 jours, visite familiale, transit)
- Coaching professionnel (CV, lettre de motivation, préparation entretien)
- Procédure Campus France de A à Z
- Aide à l'installation en Europe (logement, banque, titre de séjour)
- Suivi personnalisé avec conseiller dédié

INFOS PRATIQUES :
- Taux de succès : 95%
- Plus de 500 clients accompagnés
- Consultation initiale 100% GRATUITE et sans engagement
- Réponse sous 24h ouvrées
- Téléphone France : +33 7 53 70 41 29
- Téléphone Cameroun : +237 657 580 979
- Email : info@talent-bridge.fr
- Adresse : Yaoundé – Awae Escalier, en face de DOVV, Cameroun
- Horaires : Lun-Ven 8h-18h, Sam 9h-14h
- Budget : à partir de 5 000 € selon le service et la complexité du dossier

RÈGLES STRICTES :
- Réponds toujours en français
- Sois concis (3-5 phrases maximum par réponse)
- Si quelqu'un veut un RDV ou une consultation, oriente vers le formulaire de contact ou propose d'appeler/WhatsApp
- Ne promets JAMAIS à 100% l'obtention d'un visa (décisions finales reviennent aux consulats)
- Si la question dépasse tes connaissances, invite à contacter directement l'équipe
- Termine toujours par une invitation à agir (prendre RDV, appeler, remplir le formulaire)
- Parle uniquement des sujets liés à Talent Bridge et à la mobilité internationale`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
       model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        system:     SYSTEM_PROMPT,
        messages:   trimmedMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Anthropic API Error]', response.status, err);
      return res.status(response.status).json({ error: 'Erreur API Anthropic', details: response.status });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? "Je suis désolée, une erreur s'est produite.";

    return res.json({ reply });

  } catch (err) {
    console.error('[Fetch Error]', err.message);
    return res.status(500).json({ error: 'Erreur réseau lors de la communication avec l\'API.' });
  }
});

// ─── DÉMARRAGE ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Talent Bridge AI Proxy démarré sur le port ${PORT}`);
  console.log(`   → Health check : http://localhost:${PORT}/health`);
  console.log(`   → Chat API     : POST http://localhost:${PORT}/api/chat\n`);
});
