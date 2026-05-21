/* UI Module — Theme, Drag&Drop, Toast, Particles, Confetti */
const UI = (() => {
  function initTheme() {
    const saved = localStorage.getItem('theme');
    const sys = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', saved || sys);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  function initDropZone(dropZone, fileInput, onFiles) {
    ['dragenter','dragover','dragleave','drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    dropZone.addEventListener('dragenter', () => dropZone.classList.add('drag-over'));
    dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { dropZone.classList.remove('drag-over'); const f = Array.from(e.dataTransfer.files); if (f.length) onFiles(f); });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { const f = Array.from(fileInput.files); if (f.length) onFiles(f); });
  }

  function formatFileSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function renderPreviews(container, files, onRemove) {
    container.innerHTML = '';
    files.forEach((file, i) => {
      const item = document.createElement('div');
      item.className = 'preview-item';
      const ext = file.name.split('.').pop().toLowerCase();
      let thumb = '';
      if (['jpg','jpeg','png','webp'].includes(ext)) {
        thumb = `<img src="${URL.createObjectURL(file)}" alt="preview">`;
      } else if (ext === 'pdf') {
        thumb = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>`;
        // Try to render PDF thumbnail
        renderPdfThumb(file, item);
      } else {
        thumb = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/><path d="M9 15h6M9 11h6"/></svg>`;
      }
      item.innerHTML = `<div class="preview-thumb">${thumb}</div><div class="preview-info"><div class="preview-name" title="${file.name}">${file.name}</div><div class="preview-size">${formatFileSize(file.size)}</div></div><button class="preview-remove" aria-label="Eliminar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
      item.querySelector('.preview-remove').addEventListener('click', e => { e.stopPropagation(); onRemove(i); });
      container.appendChild(item);
    });
  }

  async function renderPdfThumb(file, item) {
    try {
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const thumbEl = item.querySelector('.preview-thumb');
      if (thumbEl) { thumbEl.innerHTML = ''; thumbEl.appendChild(canvas); }
    } catch (e) { /* fallback to icon */ }
  }

  function showToast(msg, type = 'success', duration = 4000) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const icons = { success:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', error:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', warning:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' };
    t.innerHTML = `${icons[type]||icons.success}<span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100px)'; t.style.transition='all .3s'; setTimeout(() => t.remove(), 300); }, duration);
  }

  function updateProgress(pct, label) {
    const f = document.getElementById('progress-fill');
    const p = document.getElementById('progress-percent');
    const l = document.getElementById('progress-label');
    if (f) f.style.width = pct + '%';
    if (p) p.textContent = Math.round(pct) + '%';
    if (label && l) l.textContent = label;
  }

  function initScrollAnimations() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.tool-card,.feature-card,.step-card,.faq-item').forEach(el => {
      el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; el.style.transition = 'all .5s ease'; obs.observe(el);
    });
  }

  // ─── Particles ────────────────────────
  function initParticles() {
    const canvas = document.getElementById('hero-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
    resize(); window.addEventListener('resize', resize);
    
    for (let i = 0; i < 40; i++) {
      particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 2 + 0.5, dx: (Math.random() - 0.5) * 0.5, dy: (Math.random() - 0.5) * 0.5, o: Math.random() * 0.4 + 0.1 });
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3B82F6';
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = accent; ctx.globalAlpha = p.o; ctx.fill();
      });
      // Lines between close particles
      ctx.globalAlpha = 0.05; ctx.strokeStyle = accent; ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) { ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ─── Confetti ─────────────────────────
  function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#3B82F6','#7C3AED','#06B6D4','#10B981','#F59E0B','#EF4444','#EC4899'];
    const pieces = [];
    for (let i = 0; i < 80; i++) {
      pieces.push({ x: window.innerWidth / 2 + (Math.random() - 0.5) * 200, y: window.innerHeight / 2, w: Math.random() * 10 + 5, h: Math.random() * 6 + 3, color: colors[Math.floor(Math.random() * colors.length)], vx: (Math.random() - 0.5) * 15, vy: Math.random() * -18 - 5, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 10, gravity: 0.4, opacity: 1 });
    }
    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        p.vy += p.gravity; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        p.opacity -= 0.008;
        if (p.opacity > 0 && p.y < canvas.height + 50) {
          alive = true;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });
      if (alive && frame < 180) { frame++; requestAnimationFrame(animate); }
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    animate();
  }

  // ─── FAQ Accordion ────────────────────
  function initFAQ() {
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });
  }

  return { initTheme, initDropZone, renderPreviews, showToast, updateProgress, formatFileSize, initScrollAnimations, initParticles, launchConfetti, initFAQ };
})();
