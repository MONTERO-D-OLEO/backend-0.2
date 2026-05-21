/* App Controller — History, Counter, Keyboard Shortcuts, All Tools */
(function() {
  'use strict';
  let currentTool = null, selectedFiles = [], options = { quality:'medium', angle:90, pages:'', watermarkText:'CONFIDENCIAL' }, lastResult = null;
  const $ = id => document.getElementById(id);

  const els = {
    tools: $('herramientas'), converter: $('converter-section'), title: $('converter-title'), desc: $('converter-desc'),
    dropZone: $('drop-zone'), fileInput: $('file-input'), formats: $('drop-zone-formats'),
    preview: $('file-preview'), previewList: $('preview-list'),
    progress: $('progress-container'), convertBtn: $('convert-btn'), btnText: $('convert-btn-text'),
    result: $('result-container'), resultInfo: $('result-info'), resultStats: $('result-stats'),
    downloadBtn: $('download-btn'), anotherBtn: $('convert-another-btn'), backBtn: $('back-btn'),
    qualitySel: $('quality-selector'), rotateSel: $('rotate-options'), extractSel: $('extract-options'),
    watermarkSel: $('watermark-options'), extractInput: $('extract-input'), watermarkInput: $('watermark-input'),
    totalPages: $('total-pages-info'), features: $('caracteristicas'), steps: $('como-funciona'),
    comparison: $('comparacion'), faq: $('faq'), historySection: $('historial-section'),
    historyList: $('history-list'), counter: $('counter-value'), clearHistory: $('clear-history'),
  };

  function init() {
    UI.initTheme(); UI.initScrollAnimations(); UI.initParticles(); UI.initFAQ();
    bindToolCards(); bindConverterEvents(); bindQualityButtons(); bindAngleButtons();
    loadCounter(); loadHistory(); bindKeyboardShortcuts();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  // ─── Tools ────────────────────────────
  function bindToolCards() {
    document.querySelectorAll('.tool-card').forEach(c => c.addEventListener('click', () => openTool(c.dataset.tool)));
  }

  function openTool(id) {
    const cfg = Converters.getToolConfig(id);
    if (!cfg) return;
    currentTool = id; selectedFiles = [];
    els.title.textContent = cfg.title; els.desc.textContent = cfg.desc;
    els.formats.textContent = cfg.formats; els.fileInput.setAttribute('accept', cfg.accept);
    els.fileInput.multiple = cfg.multiple;
    // Hide all option panels
    els.qualitySel.style.display = els.rotateSel.style.display = els.extractSel.style.display = els.watermarkSel.style.display = 'none';
    // Show relevant panel
    if (id === 'compress-pdf') els.qualitySel.style.display = 'block';
    else if (id === 'rotate-pdf') els.rotateSel.style.display = 'block';
    else if (id === 'extract-pages') els.extractSel.style.display = 'block';
    else if (id === 'watermark-pdf') els.watermarkSel.style.display = 'block';

    const texts = { 'pdf-to-word':'Convertir a Word','word-to-pdf':'Convertir a PDF','image-to-pdf':'Convertir a PDF','merge-pdf':'Unir PDFs','compress-pdf':'Comprimir','pdf-to-image':'Extraer imágenes','rotate-pdf':'Rotar PDF','extract-pages':'Extraer páginas','watermark-pdf':'Aplicar marca' };
    els.btnText.textContent = texts[id] || 'Convertir';
    resetConverter();
    els.tools.style.display = 'none'; els.features.style.display = els.steps.style.display = els.comparison.style.display = els.faq.style.display = els.historySection.style.display = 'none';
    els.converter.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetConverter() {
    selectedFiles = []; lastResult = null;
    els.preview.style.display = 'none'; els.previewList.innerHTML = '';
    els.progress.style.display = 'none'; els.result.style.display = 'none';
    els.dropZone.style.display = 'block'; els.convertBtn.style.display = 'flex';
    els.convertBtn.disabled = true; els.convertBtn.classList.remove('loading');
    $('progress-fill').style.width = '0%'; els.fileInput.value = '';
    if (els.totalPages) els.totalPages.textContent = '';
  }

  function goBack() {
    els.converter.style.display = 'none';
    els.tools.style.display = els.features.style.display = els.steps.style.display = els.comparison.style.display = els.faq.style.display = 'block';
    updateHistorySection(); currentTool = null;
  }

  // ─── Events ───────────────────────────
  function bindConverterEvents() {
    UI.initDropZone(els.dropZone, els.fileInput, handleFilesSelected);
    els.convertBtn.addEventListener('click', handleConvert);
    els.backBtn.addEventListener('click', goBack);
    els.anotherBtn.addEventListener('click', resetConverter);
    els.clearHistory.addEventListener('click', () => { localStorage.removeItem('cpHistory'); updateHistorySection(); UI.showToast('Historial limpiado', 'success'); });
  }

  function handleFilesSelected(files) {
    const cfg = Converters.getToolConfig(currentTool);
    if (!cfg) return;
    selectedFiles = cfg.multiple ? [...selectedFiles, ...files] : [files[0]];
    const v = Converters.validateFiles(selectedFiles, currentTool);
    if (!v.valid) { UI.showToast(v.error, 'error'); if (!cfg.multiple) selectedFiles = []; return; }
    els.preview.style.display = 'block';
    UI.renderPreviews(els.previewList, selectedFiles, handleRemoveFile);
    els.convertBtn.disabled = selectedFiles.length < (currentTool === 'merge-pdf' ? 2 : 1);
    // For extract pages, show total pages
    if (currentTool === 'extract-pages' && selectedFiles.length) {
      Converters.getPdfPageCount(selectedFiles[0]).then(n => { els.totalPages.textContent = `(Total: ${n} páginas)`; }).catch(()=>{});
    }
  }

  function handleRemoveFile(i) {
    selectedFiles.splice(i, 1);
    if (!selectedFiles.length) { els.preview.style.display = 'none'; els.convertBtn.disabled = true; }
    else { UI.renderPreviews(els.previewList, selectedFiles, handleRemoveFile); els.convertBtn.disabled = selectedFiles.length < (currentTool === 'merge-pdf' ? 2 : 1); }
  }

  function bindQualityButtons() {
    document.querySelectorAll('#quality-selector .quality-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#quality-selector .quality-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active'); options.quality = b.dataset.quality;
      });
    });
  }

  function bindAngleButtons() {
    document.querySelectorAll('#rotate-options .quality-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#rotate-options .quality-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active'); options.angle = parseInt(b.dataset.angle);
      });
    });
  }

  // ─── Convert ──────────────────────────
  async function handleConvert() {
    if (!selectedFiles.length || els.convertBtn.disabled) return;
    const v = Converters.validateFiles(selectedFiles, currentTool);
    if (!v.valid) { UI.showToast(v.error, 'error'); return; }

    // Collect options
    options.pages = els.extractInput?.value || '1';
    options.watermarkText = els.watermarkInput?.value || 'CONFIDENCIAL';

    els.dropZone.style.display = 'none';
    els.qualitySel.style.display = els.rotateSel.style.display = els.extractSel.style.display = els.watermarkSel.style.display = 'none';
    els.preview.style.display = 'none'; els.progress.style.display = 'block';
    els.convertBtn.disabled = true; els.convertBtn.classList.add('loading');

    try {
      const result = await Converters.convert(selectedFiles, currentTool, options, (p, l) => UI.updateProgress(p, l));
      lastResult = result;
      showResult(result);
      setTimeout(() => Converters.triggerDownload(result.blob, result.filename), 800);
      UI.showToast('¡Conversión completada!', 'success');
      UI.launchConfetti();
      incrementCounter();
      addToHistory(currentTool, selectedFiles[0]?.name || 'archivo', result.filename);
    } catch (err) {
      console.error(err);
      UI.showToast(err.message || 'Error en la conversión', 'error');
      els.progress.style.display = 'none'; els.dropZone.style.display = 'block';
      els.preview.style.display = selectedFiles.length ? 'block' : 'none';
      const cfg = Converters.getToolConfig(currentTool);
      if (cfg?.hasOptions || currentTool === 'compress-pdf') {
        if (currentTool === 'compress-pdf') els.qualitySel.style.display = 'block';
        if (currentTool === 'rotate-pdf') els.rotateSel.style.display = 'block';
        if (currentTool === 'extract-pages') els.extractSel.style.display = 'block';
        if (currentTool === 'watermark-pdf') els.watermarkSel.style.display = 'block';
      }
      els.convertBtn.disabled = false; els.convertBtn.classList.remove('loading');
    }
  }

  function showResult(r) {
    els.progress.style.display = 'none'; els.convertBtn.style.display = 'none'; els.result.style.display = 'block';
    els.resultInfo.textContent = `Archivo: ${r.filename}`;
    let s = '';
    if (r.pages) s += `<div class="result-stat"><div class="result-stat-value">${r.pages}</div><div class="result-stat-label">Páginas</div></div>`;
    if (r.mergedFiles) s += `<div class="result-stat"><div class="result-stat-value">${r.mergedFiles}</div><div class="result-stat-label">Unidos</div></div>`;
    if (r.reduction !== undefined) {
      s += `<div class="result-stat"><div class="result-stat-value">${r.reduction}%</div><div class="result-stat-label">Reducción</div></div>`;
      if (r.compressedSize) s += `<div class="result-stat"><div class="result-stat-value">${UI.formatFileSize(r.compressedSize)}</div><div class="result-stat-label">Nuevo tamaño</div></div>`;
    }
    if (r.rotation) s += `<div class="result-stat"><div class="result-stat-value">${r.rotation}°</div><div class="result-stat-label">Rotación</div></div>`;
    if (r.isZip) s += `<div class="result-stat"><div class="result-stat-value">ZIP</div><div class="result-stat-label">Formato</div></div>`;
    els.resultStats.innerHTML = s;
    els.downloadBtn.onclick = () => Converters.triggerDownload(r.blob, r.filename);
  }

  // ─── Counter ──────────────────────────
  function loadCounter() {
    const c = parseInt(localStorage.getItem('cpCounter') || '0');
    els.counter.textContent = c;
  }
  function incrementCounter() {
    const c = parseInt(localStorage.getItem('cpCounter') || '0') + 1;
    localStorage.setItem('cpCounter', c);
    els.counter.textContent = c;
    els.counter.style.transform = 'scale(1.3)';
    setTimeout(() => els.counter.style.transform = 'scale(1)', 300);
  }

  // ─── History ──────────────────────────
  function getHistory() {
    try { return JSON.parse(localStorage.getItem('cpHistory') || '[]'); } catch { return []; }
  }
  function addToHistory(tool, inputName, outputName) {
    const h = getHistory();
    h.unshift({ tool, input: inputName, output: outputName, date: new Date().toLocaleString('es') });
    if (h.length > 20) h.length = 20;
    localStorage.setItem('cpHistory', JSON.stringify(h));
  }
  function loadHistory() { updateHistorySection(); }

  function updateHistorySection() {
    const h = getHistory();
    if (!h.length) { els.historySection.style.display = 'none'; return; }
    els.historySection.style.display = 'block';
    const colors = { 'pdf-to-word':'#EF4444','word-to-pdf':'#3B82F6','image-to-pdf':'#10B981','merge-pdf':'#7C3AED','compress-pdf':'#F59E0B','pdf-to-image':'#06B6D4','rotate-pdf':'#EC4899','extract-pages':'#14B8A6','watermark-pdf':'#6366F1' };
    const labels = { 'pdf-to-word':'PDF→W','word-to-pdf':'W→PDF','image-to-pdf':'IMG→P','merge-pdf':'UNIR','compress-pdf':'COMP','pdf-to-image':'PDF→I','rotate-pdf':'ROT','extract-pages':'EXTR','watermark-pdf':'MARC' };
    els.historyList.innerHTML = h.map(item => `<div class="history-item"><div class="history-icon" style="background:${colors[item.tool]||'#3B82F6'}20;color:${colors[item.tool]||'#3B82F6'}">${labels[item.tool]||'???'}</div><div class="history-info"><div class="history-name">${item.input} → ${item.output}</div><div class="history-meta">${item.date}</div></div></div>`).join('');
  }

  // ─── Keyboard Shortcuts ───────────────
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentTool) goBack();
      // Ctrl+V paste from clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && currentTool) {
        navigator.clipboard?.read?.().then(items => {
          const files = [];
          items.forEach(item => {
            item.types.forEach(type => {
              if (type.startsWith('image/')) {
                item.getType(type).then(blob => {
                  const file = new File([blob], `clipboard.${type.split('/')[1]}`, { type });
                  handleFilesSelected([file]);
                });
              }
            });
          });
        }).catch(() => {});
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
