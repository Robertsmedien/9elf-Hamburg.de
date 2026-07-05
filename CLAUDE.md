# 9elf Hamburg — Website (CLAUDE.md)

Statische Website für 9elf Hamburg (Porsche-Spezialist), erstellt von Fuel Passion Studios.
Live über GitHub Pages, Repo: `Robertsmedien/9elf-Hamburg.de` (Branch `main`).

## Arbeitsordner
**Aktiver Ordner:** `/Volumes/Elements/9elf Data/Website/9elf_site` (externes Volume, Name mit Leerzeichen).
**Achtung:** `~/Downloads/9elf_site` ist eine VERALTETE Kopie — nicht dort arbeiten.

`_rohbilder*/`-Ordner enthalten unbearbeitete Quellbilder (nicht im Git, siehe `.gitignore`); Zielformat ist `.webp` unter `images/<bereich>/`.

## Seiten
index, leistungen (mit Sprungmarken je Leistung), ueber, galerie, magazin, team, karriere, kontakt, shop, shop-agb, impressum, datenschutz.
`dashboard.html` (alte localStorage-CMS-Demo) wurde entfernt und durch Decap CMS ersetzt (siehe unten) — als gelöscht im Git-Status, falls noch nicht committed.

## Content-Architektur: Decap CMS + JSON + site-data.js
Der frühere Ansatz (Inhalte hartcodiert in jeder HTML-Seite, Demo-Dashboard mit localStorage) wurde ersetzt durch:

- **`admin/`** — Decap CMS (GitHub-Backend, schreibt direkt in `main`). `admin/config.yml` definiert Collections (magazin, galerie, team, fahrzeuge, shop, settings). `admin/cloudflare-oauth-worker.js` ist der OAuth-Vermittler für den GitHub-Login (muss auf Cloudflare Workers deployt und die `base_url` in `config.yml` entsprechend gesetzt werden — aktuell noch Platzhalter `DEIN-OAUTH-WORKER.workers.dev`).
- **`data/*.json`** — Inhalte: `magazin.json`, `galerie.json`, `team.json`, `fahrzeuge.json`, `shop.json`, `settings.json` (u.a. Hero-Video). Jede Datei ist entweder ein direktes Array oder ein Wrapper-Objekt mit Schlüssel (`beitraege`, `bilder`, `mitglieder`, `fahrzeuge`, `produkte`).
- **`js/site-data.js`** — lädt die JSON-Dateien per `fetch()` und rendert die Kacheln in Container mit `data-dynamic="<typ>"` (z.B. `galerie-grid`, `magazin-featured`, `fahrzeuge`, `team-preview`, `shop`). Rendert exakt dasselbe Markup/CSS wie vorher hartcodiert. Reagiert auf `pageshow` (bfcache) und wird vom DE/EN-Umschalter erneut aufgerufen.
- **Lokal testen:** NICHT per `file://` öffnen (fetch wird geblockt) — stattdessen z.B. `python3 -m http.server` im Projektordner starten.
- Neue Felder pro Eintrag typischerweise `_de`/`_en`-Varianten (z.B. `titel_de`/`titel_en`); `pick()` in `site-data.js` wählt je nach Sprache mit DE-Fallback.

## Bilder / Platzhalter-Stand
- **Team:** echte Fotos vorhanden, 7 Stück unter `images/team/<vorname-nachname>.webp` (z.B. `andreas-irmler.webp`).
- **Fahrzeuge & Shop:** noch KEINE echten Fotos — `bild`-Feld in `data/fahrzeuge.json` / `data/shop.json` ist leer (`""`), `site-data.js` fällt dann auf Emoji-Platzhalter zurück (🏎️ bzw. produktspezifisches Emoji). Ordner `images/fahrzeuge/` und `images/shop/` existieren nur mit `.gitkeep`.
- **Galerie/Magazin:** echte Bilder unter `images/galerie/`, `images/magazin/` (Anzahl kann von CMS-Bearbeitung abhängen, nicht mehr fix 24/19 wie in der alten Struktur — im Zweifel `data/galerie.json` / `data/magazin.json` prüfen).
- Logo weiterhin als base64-Data-URI inline in jeder Seite (nav + footer).

## i18n (DE→EN-Umschalter)
Jede HTML-Seite hat inline `const DICT={...}` (DE→EN) + `DICT_REV` (auto-invertiert). `translateNode` läuft per TreeWalker über alle Text-Knoten und ersetzt nur, wenn der **komplett getrimmte** `textContent` eines Knotens exakt ein DICT-Key ist.

- Elemente mit `data-dynamic` (siehe oben) werden vom TreeWalker übersprungen — deren Sprache steuert `site-data.js` selbst über `_de`/`_en`-Felder und die globale `window.__DICT`-Lookup-Funktion `L()` für Einzelwerte (z.B. Fahrzeug-Eckdaten, „auf Anfrage").
- Neue statische UI-Texte übersetzen: exakten deutschen String als Key ins DICT eintragen (`&amp;` im HTML wird zu `&` im textContent → Key mit literalem `&`).
- Englische Werte müssen eindeutig sein, sonst bricht der Rück-Toggle (DE→EN→DE).
- Rechtstext (Fließtext auf impressum/datenschutz/shop-agb) bleibt bewusst Deutsch; nur Nav/H1/Abschnitts-Überschriften/Footer/Buttons werden übersetzt.
- Sprachwahl wird in `localStorage` unter `9elf-lang` gespeichert.

## Sonstiges
- `robots.txt` und `sitemap.xml` vorhanden (SEO).
- `.claude/settings.local.json` enthält u.a. erlaubte Bash-Befehle für Bildkonvertierung (`sips`, `cwebp`, `convert`) — Rohbilder werden lokal nach `.webp` konvertiert, bevor sie nach `images/` wandern.
- Letzter Commit laut Git-Log: "Echte Fotos, SEO, Kontaktformular, Burger-Menü, Maps" — vor dem Committen `git status` prüfen, da zuletzt viele Dateien (inkl. `admin/`, `data/`, `js/`) noch ungetrackt/uncommitted waren.
