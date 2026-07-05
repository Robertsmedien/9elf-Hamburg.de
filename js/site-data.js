/* =========================================================================
   9elf Hamburg — zentrales Daten-Rendering
   -------------------------------------------------------------------------
   Lädt die Inhalte aus /data/*.json und rendert die Kacheln in EXAKT dem
   gleichen HTML/CSS wie zuvor hartcodiert. Einzige Änderung: WOHER der
   Inhalt kommt, nicht WIE er aussieht.

   - Container werden über das Attribut  data-dynamic="<typ>"  angesteuert.
     Der bestehende DE/EN-Umschalter (translateNode) überspringt alle
     Elemente mit data-dynamic; die Sprache dieser Inhalte steuert dieses
     Skript selbst über die _de/_en-Felder.
   - reveal-Animation: neu eingefügte .reveal-Kacheln werden hier erneut per
     IntersectionObserver beobachtet (der Seiten-Observer bindet nur einmal
     beim Laden).
   - Lightbox: nutzt Event-Delegation, funktioniert daher automatisch; die
     Kacheln erhalten die Klasse .lb-clickable (Zoom-Cursor) direkt im Markup.

   Hinweis: liest per fetch() aus /data — beim lokalen Testen einen kleinen
   Webserver nutzen (z.B.  python3 -m http.server ), NICHT die Datei per
   file:// öffnen (dann blockiert der Browser fetch).
   ========================================================================= */
(function () {
  'use strict';

  /* ---------- Helfer ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Einzel-Feld-Werte, die zuvor über das Seiten-DICT übersetzt wurden
  // (z.B. Fahrzeug-Eckdaten, "auf Anfrage", Shop-Kategorie) 1:1 wie bisher
  // übersetzen, wenn EN aktiv ist.
  function L(v, lang) {
    return (lang === 'en' && window.__DICT && window.__DICT[v] != null)
      ? window.__DICT[v] : v;
  }
  // _de/_en-Feld je nach Sprache wählen (mit DE-Fallback)
  function pick(e, base, lang) {
    var k = base + '_' + lang;
    return (e[k] != null && e[k] !== '') ? e[k] : e[base + '_de'];
  }

  var DATA = {}, ready = false, currentLang = 'de';
  try { currentLang = localStorage.getItem('9elf-lang') || 'de'; } catch (e) {}

  // Schlüssel, unter dem in jeder JSON-Datei das Array liegt (CMS-freundliche Struktur).
  var ARR_KEY = { magazin: 'beitraege', galerie: 'bilder', team: 'mitglieder', fahrzeuge: 'fahrzeuge', shop: 'produkte' };
  // Zentrale Entpack-Funktion: liefert IMMER das Array – egal ob { "<key>": [...] } (Wrapper) oder direktes [...].
  function arr(name) {
    var d = DATA[name];
    if (Array.isArray(d)) return d;
    if (d && ARR_KEY[name] && Array.isArray(d[ARR_KEY[name]])) return d[ARR_KEY[name]];
    return [];
  }

  /* ---------- reveal: dynamisch eingefügte Kacheln beobachten ---------- */
  var IO = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (x) {
          if (x.isIntersecting) { x.target.classList.add('visible'); IO.unobserve(x.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' })
    : null;

  function reveal(container, animate) {
    var els = container.querySelectorAll('.reveal:not(.visible)');
    if (animate && IO) { els.forEach(function (el) { IO.observe(el); }); return; }
    // Sprach-Umschaltung / kein IO: sofort einblenden, ohne Flackern
    els.forEach(function (el) { el.style.transition = 'none'; el.classList.add('visible'); });
    void container.offsetWidth;
    els.forEach(function (el) { el.style.transition = ''; });
  }
  function fill(el, html, animate) { el.innerHTML = html; reveal(el, animate); }

  /* ---------- feste Layout-Muster (wie im Original) ---------- */
  var GP_POS = ['gp-item tall reveal', 'gp-item wide reveal delay-1',
                'gp-item reveal delay-2', 'gp-item reveal', 'gp-item wide reveal delay-1'];
  var DLY = ['reveal', 'reveal delay-1', 'reveal delay-2'];

  /* ---------- Kachel-Builder (identisches Markup) ---------- */
  function gp(e, cls, lang) {
    return '<div class="' + cls + ' lb-clickable"><img src="' + esc(e.bild) + '" alt="' + esc(e.bild_alt || '') +
      '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"><span class="gp-label">' +
      esc(pick(e, 'titel', lang)) + '</span></div>';
  }
  function magCard(e, dly, lang) {
    return '<div class="mag-card ' + dly + '"><div class="mag-img lb-clickable"><img src="' + esc(e.bild) + '" alt="' +
      esc(e.bild_alt || '') + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"><span class="mag-cat">' +
      esc(pick(e, 'kategorie', lang)) + '</span></div><div class="mag-body"><div class="mag-date">' + esc(e.datum) +
      '</div><h4>' + esc(pick(e, 'titel', lang)) + '</h4><p>' + esc(pick(e, 'excerpt', lang)) + '</p></div></div>';
  }
  function featured(e, lang) {
    var date = esc(e.datum) + (e.lesezeit ? ' · Lesezeit ' + esc(e.lesezeit) : '');
    return '<div class="featured-img"><img src="' + esc(e.bild) + '" alt="' + esc(e.bild_alt || '') +
      '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"><span class="featured-cat">' +
      esc(pick(e, 'kategorie', lang)) + '</span></div><div class="featured-body"><div class="featured-date">' + date +
      '</div><h2>' + esc(pick(e, 'titel', lang)) + '</h2><p>' + esc(pick(e, 'excerpt', lang)) +
      '</p><a href="#" class="read-link">Beitrag lesen →</a></div>';
  }
  function car(e, dly, lang) {
    var media = e.bild
      ? '<img src="' + esc(e.bild) + '" alt="' + esc(e.modell) + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">'
      : '<span class="car-icon">🏎️</span>';
    return '<div class="car-card ' + dly + '"><div class="car-img lb-clickable">' + media + '<span class="car-status ' +
      esc(e.status_klasse) + '">' + esc(pick(e, 'status', lang)) + '</span></div><div class="car-body"><h4>' +
      esc(L(e.modell, lang)) + '</h4><div class="car-specs">' + esc(L(e.eckdaten, lang)) + '</div><div class="car-price">' +
      esc(L(e.preis, lang)) + '</div></div></div>';
  }
  function masonry(e, i, lang) {
    return '<div class="masonry-item ' + DLY[i % 3] + ' lb-clickable" data-cat="' + esc(e.kategorie_de) +
      '" data-idx="' + i + '" style="height:' + e.hoehe + 'px"><img src="' + esc(e.bild) + '" alt="' +
      esc(e.bild_alt || '') + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"><div class="gcap"><div class="gt">' +
      esc(pick(e, 'kategorie', lang)) + '</div><div class="gn">' + esc(pick(e, 'titel', lang)) + '</div></div></div>';
  }
  function teamCard(e, i, lang) {
    var photo = e.foto
      ? '<img src="' + esc(e.foto) + '" alt="' + esc(e.foto_alt || '') + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">'
      : esc(e.initialen);
    return '<div class="team-card ' + DLY[i % 3] + '"><div class="team-photo">' + photo +
      '</div><div class="team-overlay"><div class="team-name">' + esc(e.name) + '</div><div class="team-role">' +
      esc(pick(e, 'rolle', lang)) + '</div><div class="team-bio">' + esc(pick(e, 'bio', lang)) + '</div></div></div>';
  }
  function shopCard(e, i, lang) {
    var media = e.bild
      ? '<img src="' + esc(e.bild) + '" alt="' + esc(pick(e, 'titel', lang)) + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">'
      : '<span class="mi">' + esc(e.emoji) + '</span>';
    return '<div class="shop-card ' + DLY[i % 3] + '"><div class="shop-img lb-clickable" data-tag="' + esc(e.kategorie) +
      '" data-name="' + esc(e.titel_de) + '" data-price="' + esc(e.preis) + '">' + media +
      '<span class="shop-cat">' + esc(L(e.kategorie, lang)) + '</span></div><div class="shop-body"><h4>' +
      esc(pick(e, 'titel', lang)) + '</h4><p>' + esc(pick(e, 'beschreibung', lang)) + '</p><div class="shop-price">' +
      esc(e.preis) + '</div><a href="kontakt.html" class="shop-cta">' + esc(pick(e, 'status', lang)) + '</a></div></div>';
  }

  /* ---------- Galerie-Filter nach Re-Render erneut anwenden ---------- */
  function reapplyFilter() {
    var active = document.querySelector('.filter-btn.active');
    if (!active) return;
    var f = active.dataset.filter;
    document.querySelectorAll('.masonry-item').forEach(function (item) {
      item.style.display = (f === 'all' || item.dataset.cat === f) ? '' : 'none';
    });
  }

  /* ---------- ein Container ---------- */
  function renderOne(el, lang) {
    var type = el.getAttribute('data-dynamic'), h;
    var mag = arr('magazin'), gal = arr('galerie');
    switch (type) {
      case 'galerie-preview':
        h = gal.slice(0, 5).map(function (e, i) { return gp(e, GP_POS[i] || 'gp-item reveal', lang); }).join(''); break;
      case 'galerie-grid':
        h = gal.map(function (e, i) { return masonry(e, i, lang); }).join(''); break;
      case 'magazin-preview':
        h = mag.slice(0, 3).map(function (e, i) { return magCard(e, DLY[i % 3], lang); }).join(''); break;
      case 'magazin-featured':
        var f = mag.filter(function (e) { return e.featured; })[0] || mag[0];
        h = f ? featured(f, lang) : ''; break;
      case 'magazin-grid':
        h = mag.filter(function (e) { return !e.featured; }).map(function (e, i) { return magCard(e, DLY[i % 3], lang); }).join(''); break;
      case 'fahrzeuge':
        h = arr('fahrzeuge').map(function (e, i) { return car(e, DLY[i % 3], lang); }).join(''); break;
      case 'team':
        h = arr('team').map(function (e, i) { return teamCard(e, i, lang); }).join(''); break;
      case 'team-preview':
        h = arr('team').slice(0, 6).map(function (e, i) { return teamCard(e, i, lang); }).join(''); break;
      case 'shop':
        h = arr('shop').map(function (e, i) { return shopCard(e, i, lang); }).join(''); break;
      default: return;
    }
    fill(el, h, !el.__rendered);   // Einblend-Animation nur beim ersten Rendern
    el.__rendered = true;
    if (type === 'galerie-grid') reapplyFilter();
  }

  /* ---------- Hero-Hintergrundvideo (Startseite) aus settings.json ---------- */
  function heroVideo() {
    if (!DATA.settings) return;
    var v = document.getElementById('heroVideo'); if (!v) return;
    var src = v.querySelector('source');
    if (src && DATA.settings.hero_video && src.getAttribute('src') !== DATA.settings.hero_video) {
      src.setAttribute('src', DATA.settings.hero_video); v.load();
    }
  }

  function renderAll(lang) {
    currentLang = lang;
    if (!ready) return;
    document.querySelectorAll('[data-dynamic]').forEach(function (el) { renderOne(el, lang); });
    heroVideo();
  }
  // Hook für den bestehenden DE/EN-Umschalter (wird aus setLang aufgerufen)
  window.__renderDynamic = function (lang) { renderAll(lang); };

  /* ---------- laden ---------- */
  var NEED = {
    'galerie-preview': 'galerie', 'galerie-grid': 'galerie',
    'magazin-preview': 'magazin', 'magazin-featured': 'magazin', 'magazin-grid': 'magazin',
    'fahrzeuge': 'fahrzeuge', 'team': 'team', 'team-preview': 'team', 'shop': 'shop'
  };
  // Welche JSON-Dateien braucht die aktuelle Seite? (aus den vorhandenen data-dynamic-Containern)
  function neededFiles() {
    var files = {};
    document.querySelectorAll('[data-dynamic]').forEach(function (el) {
      var t = el.getAttribute('data-dynamic'); if (NEED[t]) files[NEED[t]] = 1;
    });
    if (document.getElementById('heroVideo')) files['settings'] = 1;
    return Object.keys(files);
  }
  function allLoaded() {
    return neededFiles().every(function (n) { return DATA[n] !== undefined; });
  }

  var loading = false;
  // Lädt NUR die noch fehlenden Dateien; danach IMMER rendern.
  // Promise.all stellt sicher, dass renderAll() erst NACH allen fetch()-Aufrufen läuft (keine Race Condition).
  function boot() {
    if (loading) return;                       // gegen doppelte parallele Läufe
    var names = neededFiles().filter(function (n) { return DATA[n] === undefined; });
    if (!names.length) { ready = true; renderAll(currentLang); return; }
    loading = true;
    Promise.all(names.map(function (n) {
      return fetch('data/' + n + '.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) { DATA[n] = j; })   // roh speichern; Entpacken zentral über arr()
        .catch(function (err) { console.error('site-data: konnte data/' + n + '.json nicht laden —', err); });
    })).then(function () { loading = false; ready = true; renderAll(currentLang); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Robust beim normalen Navigieren UND beim Anzeigen aus dem Back-/Forward-Cache (bfcache):
  // pageshow feuert bei jeder Anzeige der Seite. Fehlt noch etwas, wird (erneut) geladen.
  window.addEventListener('pageshow', function () {
    if (allLoaded()) renderAll(currentLang);
    else boot();
  });
})();
