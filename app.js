(() => {
  const qs = (sel, el=document) => el.querySelector(sel);
  const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const el = (tag, cls, attrs={}) => { const e=document.createElement(tag); if(cls) e.className=cls; for(const k in attrs){ if(k==='text') e.textContent=attrs[k]; else if(k==='html') e.innerHTML=attrs[k]; else e.setAttribute(k, attrs[k]); } return e; };

  let slidesData = [];
  let currentIndex = 0;
  let isAnimatingNav = false;
  let observer = null;
  let wheelLockUntil = 0;

  function setTopOffset() {
    const nav = qs('#topNav');
    const h = nav ? nav.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--topOffset', h + 'px');
  }

  function applyCompactMode() {
    const compact = window.innerHeight < 720; // auto-compact for short viewports
    document.body.setAttribute('data-compact', compact ? 'true' : 'false');
  }

  function renderSlides(data) {
    const container = qs('#slides');
    if (!container) return;
    container.innerHTML = '';

    slidesData = data.slides || [];

    slidesData.forEach((s, idx) => {
      const section = el('section', `slide slide--${s.type || 'content'}`);
      section.setAttribute('data-index', String(idx));
      // allow per-slide auto text sizing
      section.style.setProperty('--textScale', '1');

      const inner = el('div', 'slideInner');
      const header = el('div', 'header');

      // Headline
      const isGrad = s.type === 'title' || s.type === 'section';
      const hTag = s.type === 'title' ? 'h1' : 'h2';
      const h = el(hTag, isGrad ? 'grad' : '');
      h.textContent = s.headline || '';
      h.setAttribute('data-animate', '');
      header.appendChild(h);

      if (s.subheadline) {
        const sub = el('p', 'sub');
        sub.textContent = s.subheadline;
        sub.setAttribute('data-animate', '');
        header.appendChild(sub);
      }

      inner.appendChild(header);

      // Body
      const body = el('div', 's-body');

      if (s.type === 'content') {
        const grid = el('div', 'contentGrid');
        // Left: bullets/content
        const left = el('div');
        if (Array.isArray(s.bullets)) {
          const ul = el('ul', 'bullets');
          s.bullets.slice(0, 6).forEach((b, i) => {
            const li = el('li');
            li.textContent = b;
            li.setAttribute('data-animate', '');
            li.style.transitionDelay = `${i * 60}ms`;
            ul.appendChild(li);
          });
          left.appendChild(ul);
        }
        // Optional note
        if (s.note) {
          const note = el('div', 'note');
          note.textContent = s.note;
          note.setAttribute('data-animate', '');
          left.appendChild(note);
        }
        grid.appendChild(left);

        // Right: highlight/callout (optional)
        const right = el('div');
        if (Array.isArray(s.bullets) && s.bullets.length > 0) {
          const call = el('div', 'card callout');
          const lab = el('div', 'label');
          lab.textContent = 'Highlight';
          const hi = el('div', 'grad');
          hi.textContent = s.bullets[0];
          call.appendChild(lab);
          call.appendChild(hi);
          call.setAttribute('data-animate', '');
          call.style.transitionDelay = '120ms';
          right.appendChild(call);
        }
        grid.appendChild(right);
        body.appendChild(grid);
      }

      if (s.type === 'title') {
        if (Array.isArray(s.bullets) && s.bullets.length) {
          const ul = el('ul', 'bullets');
          s.bullets.slice(0, 4).forEach((b, i) => {
            const li = el('li'); li.textContent = b; li.setAttribute('data-animate',''); li.style.transitionDelay = `${i*60}ms`; ul.appendChild(li);
          });
          body.appendChild(ul);
        }
      }

      if (s.type === 'section') {
        // Minimal section slide, maybe brief bullets
        if (Array.isArray(s.bullets) && s.bullets.length) {
          const ul = el('ul', 'bullets');
          s.bullets.slice(0, 4).forEach((b, i) => { const li = el('li'); li.textContent=b; li.setAttribute('data-animate',''); li.style.transitionDelay=`${i*60}ms`; ul.appendChild(li); });
          body.appendChild(ul);
        }
      }

      if (s.type === 'beforeAfter') {
        const grid = el('div', 'contentGrid');
        const left = el('div');
        const right = el('div');
        if (s.left) {
          const t = el('div', 'card');
          const th = el('div', 'h3 grad'); th.textContent = s.left.title || 'Before'; th.setAttribute('data-animate','');
          t.appendChild(th);
          const ul = el('ul', 'bullets');
          (s.left.bullets||[]).slice(0,6).forEach((b,i)=>{ const li=el('li'); li.textContent=b; li.setAttribute('data-animate',''); li.style.transitionDelay=`${i*60}ms`; ul.appendChild(li); });
          t.appendChild(ul);
          left.appendChild(t);
        }
        if (s.right) {
          const t = el('div', 'card callout');
          const th = el('div', 'h3 grad'); th.textContent = s.right.title || 'After'; th.setAttribute('data-animate','');
          t.appendChild(th);
          const ul = el('ul', 'bullets');
          (s.right.bullets||[]).slice(0,6).forEach((b,i)=>{ const li=el('li'); li.textContent=b; li.setAttribute('data-animate',''); li.style.transitionDelay=`${i*60}ms`; ul.appendChild(li); });
          t.appendChild(ul);
          right.appendChild(t);
        }
        grid.appendChild(left);
        grid.appendChild(right);
        body.appendChild(grid);
      }

      if (s.type === 'closing') {
        // Keep it simple
        if (Array.isArray(s.bullets) && s.bullets.length) {
          const ul = el('ul', 'bullets');
          s.bullets.slice(0, 4).forEach((b, i) => { const li = el('li'); li.textContent = b; li.setAttribute('data-animate',''); li.style.transitionDelay=`${i*60}ms`; ul.appendChild(li); });
          body.appendChild(ul);
        }
      }

      inner.appendChild(body);
      section.appendChild(inner);
      container.appendChild(section);
    });
  }

  function initObserver() {
    const slideEls = qsa('.slide');
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      // pick the most visible slide
      const vis = entries.filter(e => e.isIntersecting).sort((a,b)=> b.intersectionRatio - a.intersectionRatio);
      if (vis.length) {
        const idx = Number(vis[0].target.getAttribute('data-index'));
        activateSlide(idx, false);
      }
    }, { root: qs('#slides'), threshold: [0.5, 0.6, 0.75] });
    slideEls.forEach(s => observer.observe(s));
  }

  function activateSlide(index, scroll=true) {
    index = Math.max(0, Math.min(index, slidesData.length - 1));
    currentIndex = index;

    const slidesRoot = qs('#slides');
    const slideEls = qsa('.slide');

    slideEls.forEach((s, i) => s.classList.toggle('is-active', i === index));

    if (scroll && slidesRoot && slideEls[index]) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      slideEls[index].scrollIntoView({ behavior, block: 'start' });
    }

    updateProgressUI();
    fitTypographyFor(index);
  }

  function nextSlide() { if (currentIndex < slidesData.length - 1) activateSlide(currentIndex + 1); }
  function prevSlide() { if (currentIndex > 0) activateSlide(currentIndex - 1); }

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && (e.target.tagName || '')).toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.altKey || e.metaKey) return;
      if (e.code === 'Space') { e.preventDefault(); e.shiftKey ? prevSlide() : nextSlide(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') { e.preventDefault(); nextSlide(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); prevSlide(); }
      else if (e.key === 'Home') { e.preventDefault(); activateSlide(0); }
      else if (e.key === 'End') { e.preventDefault(); activateSlide(slidesData.length - 1); }
    });
  }

  function isScrollable(el, dir) {
    if (!el) return false;
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScroll = (overflowY === 'auto' || overflowY === 'scroll');
    if (!canScroll) return false;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return false;
    if (dir > 0) return el.scrollTop < max - 1;
    return el.scrollTop > 0;
  }

  function allowInnerScroll(target, dir) {
    let n = target instanceof Element ? target : null;
    while (n && n !== document.body) {
      if (isScrollable(n, dir)) return true;
      n = n.parentElement;
    }
    return false;
  }

  function setupWheelNav() {
    document.addEventListener('wheel', (e) => {
      const now = Date.now();
      const dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
      if (!dir) return;

      if (allowInnerScroll(e.target, dir)) return; // let the user scroll inside

      const bigDelta = (e.deltaMode === 1 && Math.abs(e.deltaY) >= 3) || (e.deltaMode === 0 && Math.abs(e.deltaY) >= 50) || (e.deltaMode === 2);
      if (!bigDelta) return; // likely a trackpad micro scroll

      if (now < wheelLockUntil) return;
      wheelLockUntil = now + 600; // debounce

      dir > 0 ? nextSlide() : prevSlide();
    }, { passive: true });
  }

  function updateProgressUI() {
    const bar = qs('#topProgressBar');
    const dots = qsa('#sideDots button');
    const total = Math.max(1, slidesData.length - 1);
    const pct = (currentIndex / total) * 100;
    if (bar) bar.style.width = pct + '%';
    dots.forEach((d, i) => d.setAttribute('aria-current', i === currentIndex ? 'true' : 'false'));
  }

  function buildDots() {
    const wrap = qs('#sideDots');
    if (!wrap) return;
    wrap.innerHTML = '';
    slidesData.forEach((_, i) => {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Go to slide ${i+1}`);
      b.addEventListener('click', (ev) => { ev.preventDefault(); activateSlide(i); });
      wrap.appendChild(b);
    });
  }

  function fitTypographyAll() {
    qsa('.slide').forEach((_, i) => fitTypographyFor(i));
  }

  function fitTypographyFor(index) {
    const slide = qsa('.slide')[index];
    if (!slide) return;
    const inner = qs('.slideInner', slide);
    if (!inner) return;

    // Reset before measuring
    slide.style.setProperty('--textScale', '1');

    // We measure the inner body content
    const body = qs('.s-body', slide) || inner;
    const available = inner.clientHeight - (inner.offsetTop || 0);

    let scale = 1.0;
    const minScale = window.innerWidth < 560 ? 0.90 : 0.85; // protect mobile legibility
    const maxScale = 1.08;

    const fits = () => body.scrollHeight <= inner.clientHeight - 4; // small buffer

    // Shrink if overflowing
    let guard = 0;
    while (!fits() && scale > minScale && guard < 40) {
      scale -= 0.02; guard++;
      slide.style.setProperty('--textScale', scale.toFixed(3));
    }
    // Gentle grow if there is lots of free space
    guard = 0;
    while (fits() && scale < maxScale && guard < 12) {
      // only upscale if there's at least ~18% free vertical space
      const free = (inner.clientHeight - body.scrollHeight) / Math.max(1, inner.clientHeight);
      if (free < 0.18) break;
      scale += 0.02; guard++;
      slide.style.setProperty('--textScale', scale.toFixed(3));
    }
  }

  function setupNavButtons() {
    const prev = qs('#prevBtn');
    const next = qs('#nextBtn');
    prev && prev.addEventListener('click', prevSlide);
    next && next.addEventListener('click', nextSlide);
  }

  async function loadLib(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }

  async function setupPdfExport() {
    const btn = qs('#exportPdfBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true; const old = btn.textContent; btn.textContent = 'Exporting…';
        document.body.classList.add('exportingPdf');

        // Ensure current styles are settled
        await new Promise(r => setTimeout(r, 50));

        // Load libs
        try {
          await loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
          await loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        } catch (e) {
          alert('Failed to load PDF libraries from cdnjs.cloudflare.com. Please allow the CDN or self-host the libraries.');
          throw e;
        }

        const { jsPDF } = window.jspdf || {};
        if (!window.html2canvas || !jsPDF) throw new Error('Libraries not available after load');

        // Prepare PDF
        const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: [1920, 1080] });
        const scale = Math.max(2, window.devicePixelRatio || 1);

        const stageRoot = qs('#pdfStage');
        if (!stageRoot) throw new Error('PDF stage not found');

        const slides = qsa('.slide');

        for (let i = 0; i < slides.length; i++) {
          // Clean stage
          stageRoot.innerHTML = '';

          // Clone background layers into stage
          qsa('.bgLayer').forEach(layer => {
            stageRoot.appendChild(layer.cloneNode(true));
          });

          // Clone a slide into stage
          const clone = slides[i].cloneNode(true);
          clone.classList.add('is-active');

          // Wrap in a container that mimics viewport
          const wrap = el('div');
          wrap.style.position = 'absolute';
          wrap.style.left = '0';
          wrap.style.top = '0';
          wrap.style.width = '1920px';
          wrap.style.height = '1080px';
          wrap.appendChild(clone);
          stageRoot.appendChild(wrap);

          // Ensure sizing/padding per CSS (#pdfStage rules already size .slideInner)

          const canvas = await window.html2canvas(stageRoot, {
            backgroundColor: '#050611',
            scale,
            width: 1920,
            height: 1080,
            useCORS: true,
            allowTaint: true,
            logging: false,
            windowWidth: 1920,
            windowHeight: 1080
          });

          const img = canvas.toDataURL('image/png');
          if (i > 0) pdf.addPage([1920,1080], 'l');
          pdf.addImage(img, 'PNG', 0, 0, 1920, 1080, undefined, 'FAST');
        }

        pdf.save('FlowPitch.pdf');
        document.body.classList.remove('exportingPdf');
        btn.disabled = false; btn.textContent = old;
      } catch (err) {
        console.error(err);
        document.body.classList.remove('exportingPdf');
        const btn = qs('#exportPdfBtn'); if (btn) { btn.disabled = false; btn.textContent = 'Export PDF'; }
      }
    });
  }

  function generateStagger() {
    // Add small stagger delays to each [data-animate] in active slide
    const active = qsa('.slide.is-active [data-animate]');
    active.forEach((n, i) => { n.style.transitionDelay = `${i * 60}ms`; });
  }

  async function init() {
    setTopOffset();
    applyCompactMode();
    window.addEventListener('resize', () => { setTopOffset(); applyCompactMode(); fitTypographyAll(); });
    window.addEventListener('orientationchange', () => { setTimeout(() => { setTopOffset(); applyCompactMode(); fitTypographyAll(); }, 100); });

    // Load content
    let data = null;
    try {
      const res = await fetch('./content.json?ts=' + Date.now(), { cache: 'no-store' });
      data = await res.json();
    } catch (e) {
      console.error('Failed to load content.json', e);
      return;
    }

    renderSlides(data);
    buildDots();
    initObserver();
    setupKeyboard();
    setupWheelNav();
    setupNavButtons();
    setupPdfExport();

    // Activate first slide
    requestAnimationFrame(() => {
      activateSlide(0, false);
      generateStagger();
      fitTypographyAll();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
