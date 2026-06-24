/* =========================================================================
   GEFF GROUP — main.js (condiviso su tutte le pagine)
   Contiene: reveal allo scroll, menu mobile, modale form con lock scroll,
   submit Web3Forms (fetch -> grazie.html), cookie banner con preferenze.
   Tutto difensivo: se qualcosa manca in pagina, il blocco si salta in
   silenzio MA gli errori veri (es. invio fallito) restano visibili.
   ========================================================================= */
(function () {
  "use strict";

  /* ----------------------------------------------------------------------
     1) REVEAL — ingresso staggered al load + rivela allo scroll.
        Se IntersectionObserver manca, gli elementi restano visibili.
     ---------------------------------------------------------------------- */
  try {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var rvs = document.querySelectorAll(".rv");
    if (rvs.length && !reduceMotion && "IntersectionObserver" in window) {
      rvs.forEach(function (el) { el.classList.add("rv-pre"); });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      rvs.forEach(function (el) { io.observe(el); });
    }
  } catch (err) {
    /* gli elementi restano visibili: nessun contenuto nascosto */
  }

  /* ----------------------------------------------------------------------
     2) MENU MOBILE (hamburger). La chiusura è sempre raggiungibile:
        l'hamburger resta visibile e ogni link chiude il menu.
     ---------------------------------------------------------------------- */
  var burger = document.querySelector(".burger");
  var nav = document.getElementById("primary-nav");
  if (burger && nav) {
    // chiude il menu (se aperto) e sblocca lo scroll dello sfondo
    var closeMenu = function (refocus) {
      if (!nav.classList.contains("open")) return;
      nav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
      unlockScroll();
      if (refocus) burger.focus();
    };
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      // menu aperto -> sfondo fermo (stesso contatore di lock della modale)
      if (open) { lockScroll(); } else { unlockScroll(); }
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { closeMenu(false); });
    });
    // ESC chiude il menu
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu(true);
    });
  }

  /* ----------------------------------------------------------------------
     3) LOCK SCROLL — a modale o menu aperto lo sfondo resta fermo.
        Tecnica position:fixed + ripristino della posizione alla chiusura.
     ---------------------------------------------------------------------- */
  var _scrollY = 0;
  var _locks = 0; // conta quante cose hanno bloccato lo scroll
  function lockScroll() {
    if (_locks === 0) {
      _scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = "-" + _scrollY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    _locks++;
  }
  function unlockScroll() {
    _locks = Math.max(0, _locks - 1);
    if (_locks === 0) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, _scrollY);
    }
  }

  /* ----------------------------------------------------------------------
     4) MODALE FORM (presente in home; assente nelle pagine legali).
        Apertura/chiusura con focus, ESC e click fuori.
     ---------------------------------------------------------------------- */
  var lastFocused = null;

  window.openModal = function (id) {
    var m = document.getElementById(id);
    if (!m) return;
    lastFocused = document.activeElement;
    m.classList.add("open");
    lockScroll();
    var focusTarget = m.querySelector(".modal-close") || m.querySelector("input,button");
    if (focusTarget) focusTarget.focus();
  };
  window.closeModal = function (id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("open");
    unlockScroll();
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  };

  document.querySelectorAll(".modal-backdrop").forEach(function (bd) {
    // click sullo sfondo (non sul contenuto) chiude
    bd.addEventListener("click", function (e) {
      if (e.target === bd) window.closeModal(bd.id);
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach(function (m) {
        window.closeModal(m.id);
      });
    }
  });

  // qualunque elemento con [data-open-modal="ID"] apre quella modale
  document.querySelectorAll("[data-open-modal]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.openModal(btn.getAttribute("data-open-modal"));
    });
  });

  /* ----------------------------------------------------------------------
     5) SUBMIT FORM -> Web3Forms (stesso meccanismo di relacs).
        Stati: invio in corso / errore leggibile / successo+redirect.
        Niente fallback silenzioso: se l'invio fallisce lo diciamo.
     ---------------------------------------------------------------------- */
  function setStatus(form, msg, kind) {
    var s = form.querySelector(".form-status");
    if (!s) return;
    s.textContent = msg;
    s.classList.remove("ok", "err");
    if (kind) s.classList.add(kind);
  }

  document.querySelectorAll("form.geff-form").forEach(function (form) {
    var submitBtn = form.querySelector(".form-submit");
    var originalLabel = submitBtn ? submitBtn.textContent : "Invia";

    // MODALITÀ ANTEPRIMA: finché non esiste una vera access key Web3Forms per
    // info@geffgroup.it, la chiave è un segnaposto. In quel caso NON inviamo
    // (otterremmo solo un errore): lo diciamo chiaro e indichiamo la mail.
    // Niente finto "inviato", niente errore rosso fuorviante.
    var keyField = form.querySelector('input[name="access_key"]');
    var isAnteprima = !keyField || /REPLACE_WITH/i.test(keyField.value || "");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      if (isAnteprima) {
        setStatus(form, "Anteprima dimostrativa — il modulo non è ancora attivo. Per ora scrivici a info@geffgroup.it.", "");
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Invio in corso…"; }
      setStatus(form, "", "");

      try {
        var res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(form)))
        });
        var data = await res.json();
        if (data.success) {
          // redirect relativo (GitHub Pages): grazie.html
          window.location.href = "grazie.html";
        } else {
          throw new Error(data.message || "Risposta non valida dal servizio.");
        }
      } catch (err) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
        setStatus(form, "Invio non riuscito. Riprova oppure scrivici a info@geffgroup.it", "err");
      }
    });
  });

  /* ----------------------------------------------------------------------
     6) COOKIE BANNER con preferenze granulari (stesso comportamento di
        relacs). Necessari sempre attivi + statistiche opzionali.
        Lo stato vive in localStorage e scade dopo 12 mesi.
        NOTA: nessuno strumento statistico è ancora collegato; quando lo
        sarà, basterà completare loadAnalytics().
     ---------------------------------------------------------------------- */
  (function cookie() {
    var banner = document.getElementById("cookie-banner");
    if (!banner) return; // pagina senza banner: niente da fare

    var KEY = "geff_consent";
    var prefs = document.getElementById("cb-prefs");
    var customBtn = banner.querySelector('[data-action="prefs"]');
    var analyticsToggle = document.getElementById("cb-analytics");

    function normalize(v) {
      if (v == null) return null;
      if (typeof v === "string") return { analytics: v === "granted" };
      if (typeof v === "object") return { analytics: !!v.analytics };
      return null;
    }
    function readConsent() {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        // scade dopo 12 mesi -> ri-mostra il banner
        if (obj && obj.t && (Date.now() - obj.t) > 365 * 24 * 3600 * 1000) return null;
        return obj ? normalize(obj.v) : null;
      } catch (e) { return null; }
    }
    function writeConsent(v) {
      try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
    }
    function showBanner() {
      banner.classList.add("show");
      void banner.offsetWidth; // forza reflow per l'animazione
      banner.classList.add("in");
    }
    function hideBanner() {
      banner.classList.remove("in");
      setTimeout(function () { banner.classList.remove("show"); }, 400);
    }
    function openPrefs(open) {
      if (prefs) prefs.hidden = !open;
      if (customBtn) customBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function loadAnalytics() {
      /* SEGNAPOSTO: nessuno strumento statistico ancora collegato.
         Quando ne sceglieremo uno (es. Cloudflare Web Analytics, cookieless),
         qui andrà l'iniezione dello script. Per ora non carica nulla. */
    }
    function applyConsent(consent) {
      if (consent && consent.analytics) loadAnalytics();
    }
    function commit(consent) {
      writeConsent(consent);
      applyConsent(consent);
      hideBanner();
    }

    // API esposta: la cookie policy la usa per riaprire le preferenze
    window.openCookieBanner = function () {
      var c = readConsent();
      if (analyticsToggle) analyticsToggle.checked = !!(c && c.analytics);
      openPrefs(false);
      showBanner();
    };

    banner.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      var action = btn.dataset.action;
      var consent = btn.dataset.consent;
      if (action === "prefs") {
        openPrefs(prefs && prefs.hidden);
      } else if (action === "save") {
        commit({ analytics: !!(analyticsToggle && analyticsToggle.checked) });
      } else if (consent === "accept") {
        commit({ analytics: true });
      } else if (consent === "deny") {
        commit({ analytics: false });
      }
    });

    // ESC chiude senza attivare nulla di opzionale
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && banner.classList.contains("show")) commit({ analytics: false });
    });

    // stato iniziale
    var c = readConsent();
    if (c === null) {
      setTimeout(showBanner, 700);
    } else {
      applyConsent(c);
    }
  })();

  /* ----------------------------------------------------------------------
     7) LOGO BUSSOLA — al click l'ago compie un giro e poi va alla home.
        Il logo è un <a href="index.html">: se navigassimo subito, lo spin
        non si vedrebbe. Quindi: preveniamo il link, facciamo girare l'ago,
        poi navighiamo. Se siamo GIÀ nella pagina di destinazione (home),
        giriamo soltanto, senza ricaricare. Con prefers-reduced-motion non
        animiamo nulla e lasciamo che il link funzioni in modo normale.
     ---------------------------------------------------------------------- */
  var brand = document.querySelector(".site-header .brand");
  if (brand && !reduceMotion) {
    var needle = brand.querySelector(".mark .needle");
    var SPIN_MS = 600;     // durata della keyframe (deve combaciare col CSS)
    var NAV_MS = 470;      // dopo quanto navigare: si vede quasi tutto il giro

    brand.addEventListener("click", function (e) {
      if (!needle) return; // niente bussola: lascia fare al link
      e.preventDefault();

      var href = brand.getAttribute("href");
      // la destinazione coincide con la pagina attuale? (es. sono già in home)
      var samePage = new URL(href, location.href).href === location.href;

      // riavvia l'animazione anche su click ravvicinati: togli, forza un
      // reflow e rimetti la classe, così la keyframe riparte da capo.
      brand.classList.remove("is-spinning");
      void brand.offsetWidth;
      brand.classList.add("is-spinning");

      if (samePage) {
        // restiamo in pagina: a fine giro togliamo la classe (torna normale)
        setTimeout(function () { brand.classList.remove("is-spinning"); }, SPIN_MS);
      } else {
        // lasciamo vedere il giro, poi navighiamo alla home
        setTimeout(function () { window.location.href = href; }, NAV_MS);
      }
    });
  }
})();
