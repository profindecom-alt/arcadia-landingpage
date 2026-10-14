// Génère les versions 2, 3 et 4 de la landing page à partir de index.html (version 1).
//   V1  /           index.html        principale, avec la vidéo (VSL)      → page source, à modifier
//   V2  /form/      form/index.html   secondaire, sans la vidéo            → générée
//   V3  /bac/       bac/index.html    compacte : avec la vidéo, sans chiffres ni process, moins de sections → générée
//   V4  /org/       org/index.html    comme la V1, offre « séance d'orientation offerte », CTA alternés avec « En savoir plus » → générée
// Après toute modification de index.html, merci.html ou d'un fichier CSS/JS :  node scripts/build-versions.cjs
const fs = require('fs');
const path = require('path');

const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// Cache : chaque CSS/JS reçoit ?v=<empreinte du fichier> dans index.html et merci.html.
// Le serveur (nginx.conf) les garde alors 1 an en cache : un fichier modifié change d'URL.
// config.js n'est pas versionné : servi sans cache, il est toujours à jour.
function stamp(html) {
  return html.replace(/(src|href)="assets\/([\w.-]+\.(?:css|js))(?:\?v=\w+)?"/g, (all, attr, file) => {
    if (file === 'config.js') return `${attr}="assets/${file}"`;
    const hash = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'assets', file))).digest('hex').slice(0, 8);
    return `${attr}="assets/${file}?v=${hash}"`;
  });
}
for (const page of ['index.html', 'merci.html']) {
  const file = path.join(ROOT, page);
  fs.writeFileSync(file, stamp(fs.readFileSync(file, 'utf8')));
}
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Retire un bloc de section : de la ligne de commentaire qui commence par `marker` (en début de ligne)
// jusqu'à la ligne du prochain commentaire de section (exclue).
function dropSection(html, marker) {
  const lines = html.split('\n');
  const start = lines.findIndex((l) => l.startsWith(marker));
  if (start < 0) throw new Error('section introuvable : ' + marker);
  let end = start + 1;
  while (end < lines.length && !/^<!-- /.test(lines[end])) end++;
  lines.splice(start, end - start);
  return lines.join('\n');
}
function must(html, a, b) {
  if (!html.includes(a)) throw new Error('introuvable : ' + a.slice(0, 70));
  return html.replace(a, b);
}

function noVideo(html) {
  const a = html.indexOf('      <!-- VIDÉO DE PRÉSENTATION (VSL)');
  const b = html.indexOf('      </div>\n', a) + '      </div>\n\n'.length;
  if (a < 0) throw new Error('VSL introuvable');
  html = html.slice(0, a) + html.slice(b);
  html = html.replace(/<script src="assets\/video\.js(?:\?v=\w+)?" defer><\/script>\n/, '');
  if (html.includes('video.js')) throw new Error('video.js encore présent');
  return html;
}

function forSubfolder(html, version, title) {
  html = html.replace(/(src|href)="assets\//g, '$1="../assets/');
  html = must(html, '<html lang="fr" data-version="v1">', `<html lang="fr" data-version="${version}">`);
  html = must(html, '<meta charset="utf-8">', `<meta charset="utf-8">\n<!-- GÉNÉRÉ par scripts/build-versions.cjs à partir de index.html — ne pas modifier ce fichier à la main. -->`);
  // pas d'indexation : seule la V1 doit apparaître sur Google
  html = must(html, '<meta name="viewport"', '<meta name="robots" content="noindex, follow">\n<meta name="viewport"');
  html = html.replace(/<title>[^<]*<\/title>/, (t) => t.replace('</title>', ` · ${title}</title>`));
  return html;
}

// V2 : comme la V1, sans la vidéo
let v2 = forSubfolder(noVideo(src), 'v2', 'Formulaire');

// V3 : compacte — formulaire + vidéo, nous trouver, matières, appel final
// Séparateurs gardés : la reliure à spirale du hero (elle porte le <pattern id="spiral-ring">) sépare ici
// le formulaire de « Nous trouver » ; la règle graduée après « Matières » la sépare de l'appel final.
let v3 = src;
for (const m of [
  '<!-- CHIFFRES',
  '<!-- SÉPARATEUR — même reliure, inversée',
  '<!-- LE CENTRE — gallery -->',
  '<!-- SÉPARATEUR — reliure à spirale, entre les photos et « Notre process »',
  '<!-- NOTRE PROCESS',
  '<!-- SÉPARATEUR — reliure à spirale inversée, entre « Notre process »',
  "<!-- L'ÉLÈVE",
  '<!-- BANDEAU DÉFILANT',
  '<!-- COMPARATIF',
  '<!-- BANDEAU CROISÉ',
  '<!-- TÉMOIGNAGES',
  '<!-- FAQ',
]) v3 = dropSection(v3, m);
// « Nous trouver » ne reprend pas le quadrillage du hero : papier ambre pâle ligné
v3 = must(v3, 'class="find grid-paper"', 'class="find find-lined"');
v3 = must(v3, '<a class="hero-photos d-only" href="#centre-title">', '<a class="hero-photos d-only" href="#adresse">');
v3 = must(v3, '<span>Voir le centre →</span>', '<span>Nous trouver →</span>');
v3 = v3.replace(/\n\s*<a class="nav-link" href="#faq">FAQ<\/a>/, '').replace(/\n\s*<a href="#faq">FAQ<\/a>/, '');
v3 = v3.replace(/<script src="assets\/(?:eleve|gallery)\.js(?:\?v=\w+)?" defer><\/script>\n/g, '');
if (/eleve\.js|gallery\.js/.test(v3)) throw new Error('V3 : eleve.js / gallery.js encore présents');
// Bouton de l'appel final : « Séance d'évaluation offerte »
v3 = must(v3, 'data-cta="final">Réserver la séance gratuite\n', 'data-cta="final">Séance d\'évaluation offerte\n');
v3 = forSubfolder(v3, 'v3', 'Bac');

// V4 : comme la V1, mais l'offre devient « séance d'orientation offerte » (plus de « 1ère séance gratuite »)
// et les boutons alternent entre « Séance d'orientation offerte » et « En savoir plus ».
// Les libellés de bouton sont remplacés jusqu'au retour à la ligne : l'icône flèche reste en place.
const SO = "Séance d'orientation offerte";
let v4 = src.replace(/<title>[^<]*<\/title>/, "<title>Séance d'orientation offerte – Arcadia Academy, soutien scolaire à Rabat Hassan</title>");
for (const [a, b] of [
  ["Sans frais d'inscription. 1ère séance d'essai gratuite.\">", "Sans frais d'inscription. Séance d'orientation offerte.\">"],
  ["sans frais d'inscription. 1ère séance d'essai gratuite.\">", "sans frais d'inscription. Séance d'orientation offerte.\">"],
  [`<span class="d-only">Séance d'essai gratuite</span><span class="m-only">Essai gratuit</span>`, `<span class="d-only">${SO}</span><span class="m-only">Séance offerte</span>`],
  [`<span>1ère séance d'essai gratuite<span class="d-only">`, `<span>${SO}<span class="d-only">`],
  ['<a class="btn btn-navy" href="#inscription">Essayer gratuitement\n', `<a class="btn btn-navy" href="#inscription">${SO}\n`],
  [`<span class="offer-tag">Offert · 1ère séance d'essai gratuite</span>`, `<span class="offer-tag">Offert · Séance d'orientation</span>`],
  ["<small>la 1ère séance d'essai, sans engagement</small>", "<small>la séance d'orientation, sans engagement</small>"],
  ['data-cta="centre">Réserver la séance gratuite\n', 'data-cta="centre">En savoir plus\n'],
  ['<h3 class="process-t">1ère séance gratuite</h3>', `<h3 class="process-t">${SO}</h3>`],
  ['data-cta="process">Réserver la séance gratuite\n', `data-cta="process">${SO}\n`],
  ["La séance d'essai se passe au centre", "La séance d'orientation se passe au centre"],
  ['data-cta="matieres">Essayer gratuitement\n', `data-cta="matieres">${SO}\n`],
  ["<li>1ère séance d'essai offerte</li>", `<li>${SO}</li>`],
  ['data-cta="eleve">Réserver la séance gratuite\n', 'data-cta="eleve">En savoir plus\n'],
  ['</span>1ère séance gratuite</p>', `</span>${SO}</p>`],
  ['data-cta="faq">Réserver la séance gratuite\n', `data-cta="faq">${SO}\n`],
  ["La séance d'essai est-elle vraiment gratuite ?", "La séance d'orientation est-elle vraiment offerte ?"],
  ['<p>Oui. La première séance est offerte et sans engagement', "<p>Oui. La séance d'orientation est offerte et sans engagement"],
  ["puis nous fixons une 1ère séance d'essai gratuite dans", "puis nous fixons une séance d'orientation offerte dans"],
  ["Réservez la séance d'essai gratuite de votre enfant", "Réservez la séance d'orientation offerte de votre enfant"],
  ['data-cta="final">Réserver la séance gratuite\n', 'data-cta="final">En savoir plus\n'],
  [`<a class="btn btn-accent" href="#inscription">Séance d'essai gratuite\n`, `<a class="btn btn-accent" href="#inscription">${SO}\n`],
]) v4 = must(v4, a, b);
if (/gratuit|séance d'essai|1ère séance/i.test(v4)) throw new Error('V4 : ancienne offre encore présente');
v4 = forSubfolder(v4, 'v4', 'Orientation');

for (const [dir, html] of [['form', v2], ['bac', v3], ['org', v4]]) {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  fs.writeFileSync(path.join(ROOT, dir, 'index.html'), html);
  console.log(`${dir}/index.html  ${(html.length / 1024).toFixed(0)} Ko`);
}
