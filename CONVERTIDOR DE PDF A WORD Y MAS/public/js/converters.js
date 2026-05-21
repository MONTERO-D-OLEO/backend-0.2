/* ═══════════════════════════════════════════
   Converters Module — 100% Client-Side
   All conversions run in the browser
   ═══════════════════════════════════════════ */
const Converters = (() => {
  const { PDFDocument, StandardFonts, rgb, degrees, PageSizes } = PDFLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const MAX_FILE_SIZE = 500 * 1024 * 1024;

  const TOOLS = {
    'pdf-to-word': { title: 'PDF a Word', desc: 'Convierte PDF a documento Word editable', formats: 'PDF • Máx. 500MB', accept: '.pdf', multiple: false, icon: 'pdf-word' },
    'word-to-pdf': { title: 'Word a PDF', desc: 'Convierte documentos Word a PDF', formats: 'DOCX • Máx. 500MB', accept: '.docx,.doc', multiple: false, icon: 'word-pdf' },
    'image-to-pdf': { title: 'Imagen a PDF', desc: 'Convierte JPG o PNG a PDF', formats: 'JPG, PNG • Máx. 500MB c/u', accept: '.jpg,.jpeg,.png', multiple: true, icon: 'img-pdf' },
    'merge-pdf': { title: 'Unir PDFs', desc: 'Combina múltiples PDFs en uno', formats: 'PDF • Mín. 2 archivos', accept: '.pdf', multiple: true, icon: 'merge' },
    'compress-pdf': { title: 'Comprimir PDF', desc: 'Reduce el tamaño de tu PDF', formats: 'PDF • Máx. 500MB', accept: '.pdf', multiple: false, icon: 'compress' },
    'pdf-to-image': { title: 'PDF a Imágenes', desc: 'Extrae cada página como JPG', formats: 'PDF • Máx. 500MB', accept: '.pdf', multiple: false, icon: 'pdf-img' },
    'rotate-pdf': { title: 'Rotar PDF', desc: 'Gira las páginas de tu PDF', formats: 'PDF • Máx. 500MB', accept: '.pdf', multiple: false, icon: 'rotate', hasOptions: true },
    'extract-pages': { title: 'Extraer Páginas', desc: 'Selecciona qué páginas extraer', formats: 'PDF • Máx. 500MB', accept: '.pdf', multiple: false, icon: 'extract', hasOptions: true },
    'watermark-pdf': { title: 'Marca de Agua', desc: 'Agrega texto como marca de agua', formats: 'PDF • Máx. 500MB', accept: '.pdf', multiple: false, icon: 'watermark', hasOptions: true },
  };

  function getToolConfig(id) { return TOOLS[id] || null; }

  function validateFiles(files, toolId) {
    const c = TOOLS[toolId];
    if (!c) return { valid: false, error: 'Herramienta no válida' };
    if (!c.multiple && files.length > 1) return { valid: false, error: 'Solo se permite un archivo' };
    if (toolId === 'merge-pdf' && files.length < 2) return { valid: false, error: 'Se necesitan al menos 2 PDFs' };
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) return { valid: false, error: `"${f.name}" supera 500MB` };
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!c.accept.split(',').includes(ext)) return { valid: false, error: `"${f.name}" no es compatible. Se acepta: ${c.accept}` };
    }
    return { valid: true };
  }

  // ─── PDF to Word (Backend pdf2docx + Fallback Client-Side) ─────────

  // Detecta la URL base del backend automáticamente
  const BACKEND_URL = (() => {
    // Si alojas el proyecto COMPLETO (Frontend + Backend) en Render a través de app.py,
    // el frontend y el backend comparten la misma URL, por lo que location.origin funciona perfecto.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    return location.origin;
  })();

  async function pdfToWord(file, onP) {
    // Intentar conversión por servidor (mejor calidad con pdf2docx)
    try {
      return await pdfToWordServer(file, onP);
    } catch (serverErr) {
      console.warn('Backend no disponible, usando conversión local:', serverErr.message);
      // Fallback: conversión client-side
      return await pdfToWordLocal(file, onP);
    }
  }

  // ─── Conversión por servidor (pdf2docx) ─────────
  async function pdfToWordServer(file, onP) {
    onP(5, 'Preparando archivo...');

    const formData = new FormData();
    formData.append('file', file);

    onP(15, 'Subiendo PDF al servidor...');

    // Enviar al backend con timeout de 5 minutos para archivos grandes
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);

    let response;
    try {
      response = await fetch(`${BACKEND_URL}/convert/pdf-to-word`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      throw new Error('Servidor no disponible');
    }
    clearTimeout(timeout);

    onP(70, 'Convirtiendo PDF a Word...');

    if (!response.ok) {
      let errorMsg = 'Error en el servidor';
      try {
        const errData = await response.json();
        errorMsg = errData.error || errorMsg;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    onP(90, 'Descargando documento convertido...');

    const blob = await response.blob();
    const outputName = file.name.replace(/\.pdf$/i, '.docx');

    // Obtener número de páginas del PDF original para estadísticas
    let pages = 0;
    try {
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      pages = pdf.numPages;
    } catch (_) {
      pages = 1;
    }

    onP(100, '¡Completado!');
    return { blob, filename: outputName, pages };
  }

  // ─── Conversión local (fallback client-side) ─────────
  async function pdfToWordLocal(file, onP) {
    try {
      onP(5, 'Leyendo PDF (modo local)...');
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const total = pdf.numPages;
      const docChildren = [];

      for (let i = 1; i <= total; i++) {
        onP(5 + (i / total) * 85, `Procesando texto de página ${i} de ${total}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Parse items and extract positions and fonts
        const items = textContent.items.map(item => {
          const fontSize = Math.max(Math.abs(item.transform[0]), Math.abs(item.transform[3]));
          const fontName = item.fontName ? item.fontName.toLowerCase() : '';
          return {
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            fontSize: fontSize,
            isBold: fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy'),
            isItalic: fontName.includes('italic') || fontName.includes('oblique')
          };
        }).filter(item => item.text.trim().length > 0);

        if (items.length === 0) {
          docChildren.push(new docx.Paragraph({ text: " ", pageBreakBefore: i > 1 }));
          continue;
        }

        // Sort items: Y descending (top to bottom), X ascending (left to right)
        items.sort((a, b) => {
          const maxFont = Math.max(a.fontSize, b.fontSize) || 12;
          if (Math.abs(b.y - a.y) > maxFont * 0.4) return b.y - a.y; 
          return a.x - b.x;
        });

        // Group items into lines
        const lines = [];
        let currentLine = [];
        let lastY = null;

        items.forEach(item => {
          if (lastY === null) {
            currentLine.push(item);
            lastY = item.y;
          } else {
            const maxFont = Math.max(item.fontSize, currentLine[currentLine.length - 1].fontSize) || 12;
            if (Math.abs(item.y - lastY) > maxFont * 0.4) {
              lines.push(currentLine);
              currentLine = [item];
              lastY = item.y;
            } else {
              currentLine.push(item);
            }
          }
        });
        if (currentLine.length > 0) lines.push(currentLine);

        // Convert lines to docx Paragraphs
        lines.forEach((line, lineIndex) => {
          const runs = line.map((item, idx) => {
            let halfPtSize = Math.round(item.fontSize * 2);
            if (halfPtSize < 8) halfPtSize = 8;
            if (halfPtSize > 144) halfPtSize = 144;

            let text = item.text;
            if (idx > 0) {
              const prev = line[idx - 1];
              const approxPrevWidth = prev.text.length * prev.fontSize * 0.5;
              const gap = item.x - (prev.x + approxPrevWidth);
              if (gap > item.fontSize * 0.5 && !text.startsWith(' ')) {
                text = ' ' + text;
              }
            }

            return new docx.TextRun({
              text: text,
              size: halfPtSize,
              bold: item.isBold,
              italics: item.isItalic,
              font: "Calibri"
            });
          });

          docChildren.push(
            new docx.Paragraph({
              children: runs,
              pageBreakBefore: (lineIndex === 0 && i > 1),
              spacing: { after: 120 }
            })
          );
        });
      }

      onP(95, 'Generando documento Word...');
      
      const doc = new docx.Document({
        sections: [{
          properties: {
            page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
          },
          children: docChildren.length ? docChildren : [new docx.Paragraph(" ")]
        }],
      });

      const resultBlob = await docx.Packer.toBlob(doc);

      onP(100, '¡Completado!');
      return { blob: resultBlob, filename: file.name.replace(/\.pdf$/i, '.docx'), pages: total };
    } catch (error) {
      console.error('Error detallado en PDF a Word (local):', error);
      throw new Error('Error técnico: ' + error.message);
    }
  }

  // ─── Word to PDF (with HTML formatting) ───
  async function wordToPdf(file, onP) {
    onP(10, 'Leyendo documento Word...');
    const ab = await file.arrayBuffer();

    // Use mammoth HTML conversion for better formatting
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: ab });
    const htmlContent = htmlResult.value;

    // Also get raw text as fallback
    const textResult = await mammoth.extractRawText({ arrayBuffer: ab });
    const text = textResult.value;

    if (!text?.trim() && !htmlContent?.trim()) throw new Error('No se pudo extraer contenido del Word');

    onP(30, 'Analizando contenido...');

    // Parse HTML to extract styled content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const boldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    const m = 72; // 1 inch margin
    const [pw, ph] = PageSizes.A4;
    const cw = pw - m * 2;

    // Extract elements from HTML
    const elements = [];
    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) elements.push({ text: t, tag: node.parentElement?.tagName || 'P', isBold: false, isItalic: false });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      const t = node.textContent.trim();
      if (!t && !['BR','HR'].includes(tag)) return;

      if (['H1','H2','H3','H4','H5','H6'].includes(tag)) {
        elements.push({ text: t, tag, isBold: true, isItalic: false });
      } else if (tag === 'P' || tag === 'DIV') {
        // Check for bold/italic children
        const hasBold = node.querySelector('strong, b');
        const hasItalic = node.querySelector('em, i');
        elements.push({ text: t, tag: 'P', isBold: !!hasBold, isItalic: !!hasItalic });
      } else if (['LI'].includes(tag)) {
        elements.push({ text: '•  ' + t, tag: 'LI', isBold: false, isItalic: false });
      } else if (tag === 'BR' || tag === 'HR') {
        elements.push({ text: '', tag: 'BR' });
      } else {
        Array.from(node.children).forEach(processNode);
      }
    }
    Array.from(tempDiv.children).forEach(processNode);

    // If no elements parsed, fallback to raw text
    if (!elements.length) {
      text.split('\n').forEach(line => {
        elements.push({ text: line.trim(), tag: 'P', isBold: false, isItalic: false });
      });
    }

    onP(50, 'Generando PDF...');

    // Render elements to PDF
    let page = pdfDoc.addPage(PageSizes.A4);
    let y = ph - m;

    function getFont(el) {
      if (el.isBold && el.isItalic) return boldItalic;
      if (el.isBold) return bold;
      if (el.isItalic) return italic;
      return font;
    }

    function getFontSize(tag) {
      switch(tag) {
        case 'H1': return 22;
        case 'H2': return 18;
        case 'H3': return 15;
        case 'H4': return 13;
        default: return 11;
      }
    }

    function getSpacing(tag) {
      switch(tag) {
        case 'H1': return 28;
        case 'H2': return 24;
        case 'H3': return 20;
        default: return 16;
      }
    }

    elements.forEach((el, idx) => {
      onP(50 + (idx / elements.length) * 40, 'Creando páginas...');
      const fs = getFontSize(el.tag);
      const lh = getSpacing(el.tag);
      const f = getFont(el);

      if (!el.text) { y -= lh * 0.5; return; }

      // Word wrap
      const words = el.text.split(/\s+/);
      let currentLine = '';
      const wrappedLines = [];

      words.forEach(word => {
        const test = currentLine ? `${currentLine} ${word}` : word;
        try {
          if (f.widthOfTextAtSize(test, fs) > cw && currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = test;
          }
        } catch(e) { currentLine = test; }
      });
      if (currentLine) wrappedLines.push(currentLine);

      wrappedLines.forEach(line => {
        if (y < m + lh) { page = pdfDoc.addPage(PageSizes.A4); y = ph - m; }
        try {
          // Replace problematic characters for PDF standard fonts
          const safeLine = line.replace(/[^\x00-\xFF]/g, c => {
            const replacements = { '\u2018':"'", '\u2019':"'", '\u201C':'"', '\u201D':'"', '\u2013':'-', '\u2014':'--', '\u2026':'...', '\u00A0':' ', '\u2022':'*' };
            return replacements[c] || '?';
          });
          page.drawText(safeLine, { x: m, y, size: fs, font: f, color: rgb(0.1, 0.1, 0.1) });
        } catch(e) { /* skip problematic characters */ }
        y -= lh;
      });

      // Extra spacing after headings
      if (['H1','H2','H3'].includes(el.tag)) y -= 6;
    });

    onP(95, 'Finalizando...');
    const bytes = await pdfDoc.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: file.name.replace(/\.docx?$/i, '.pdf'), pages: pdfDoc.getPageCount() };
  }

  // ─── Image to PDF ────────────────────────
  async function imageToPdf(files, onP) {
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      onP(10 + (i / files.length) * 80, `Imagen ${i + 1}/${files.length}...`);
      const bytes = new Uint8Array(await files[i].arrayBuffer());
      const ext = files[i].name.split('.').pop().toLowerCase();
      const img = ext === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const landscape = img.width > img.height;
      const [pw, ph] = landscape ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
      const page = pdfDoc.addPage([pw, ph]);
      const mg = 36, scale = Math.min((pw - mg * 2) / img.width, (ph - mg * 2) / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    onP(95, 'Finalizando...');
    const bytes = await pdfDoc.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'imagenes-convertidas.pdf', pages: files.length };
  }

  // ─── Merge PDFs ──────────────────────────
  async function mergePdfs(files, onP) {
    const merged = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      onP(10 + (i / files.length) * 80, `PDF ${i + 1}/${files.length}...`);
      try {
        const src = await PDFDocument.load(await files[i].arrayBuffer(), { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      } catch (e) { throw new Error(`Error en "${files[i].name}". Verifica que sea válido.`); }
    }
    onP(95, 'Finalizando...');
    const bytes = await merged.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'documentos-unidos.pdf', pages: merged.getPageCount(), mergedFiles: files.length };
  }

  // ─── Compress PDF ────────────────────────
  async function compressPdf(file, quality, onP) {
    onP(10, 'Leyendo PDF...');
    const ab = await file.arrayBuffer();
    const originalSize = ab.byteLength;
    onP(40, 'Comprimiendo...');
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    onP(70, 'Optimizando...');
    const bytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });
    onP(100, '¡Completado!');
    const compressedSize = bytes.length;
    const reduction = Math.max(0, ((originalSize - compressedSize) / originalSize * 100)).toFixed(1);
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `comprimido-${file.name}`, pages: pdfDoc.getPageCount(), originalSize, compressedSize, reduction: parseFloat(reduction) };
  }

  // ─── PDF to Images ───────────────────────
  async function pdfToImages(file, onP) {
    onP(10, 'Leyendo PDF...');
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const total = pdf.numPages;
    const zip = new JSZip();
    const imgFolder = zip.folder('imagenes');

    for (let i = 1; i <= total; i++) {
      onP(10 + (i / total) * 75, `Renderizando página ${i}/${total}...`);
      const page = await pdf.getPage(i);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = dataUrl.split(',')[1];
      imgFolder.file(`pagina-${String(i).padStart(3, '0')}.jpg`, base64, { base64: true });
    }
    onP(90, 'Creando ZIP...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    onP(100, '¡Completado!');
    return { blob: zipBlob, filename: file.name.replace(/\.pdf$/i, '-imagenes.zip'), pages: total, isZip: true };
  }

  // ─── Rotate PDF ──────────────────────────
  async function rotatePdf(file, angle, onP) {
    onP(10, 'Leyendo PDF...');
    const ab = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    onP(50, 'Rotando páginas...');
    pages.forEach(page => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + angle));
    });
    onP(90, 'Guardando...');
    const bytes = await pdfDoc.save();
    onP(100, '¡Completado!');
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `rotado-${file.name}`, pages: pages.length, rotation: angle };
  }

  // ─── Extract Pages ───────────────────────
  async function extractPages(file, pageNumbers, onP) {
    onP(10, 'Leyendo PDF...');
    const ab = await file.arrayBuffer();
    const srcDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // Parse page numbers (e.g., "1,3,5-8")
    const indices = parsePageRange(pageNumbers, totalPages);
    if (!indices.length) throw new Error('No se seleccionaron páginas válidas');

    onP(40, `Extrayendo ${indices.length} páginas...`);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    copiedPages.forEach(p => newDoc.addPage(p));

    onP(90, 'Guardando...');
    const bytes = await newDoc.save();
    onP(100, '¡Completado!');
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `extraido-${file.name}`, pages: indices.length, totalOriginal: totalPages };
  }

  function parsePageRange(input, max) {
    const indices = new Set();
    input.split(',').forEach(part => {
      part = part.trim();
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = Math.max(1, start); i <= Math.min(max, end); i++) indices.add(i - 1);
      } else {
        const n = parseInt(part);
        if (n >= 1 && n <= max) indices.add(n - 1);
      }
    });
    return Array.from(indices).sort((a, b) => a - b);
  }

  // ─── Watermark PDF ───────────────────────
  async function watermarkPdf(file, text, onP) {
    onP(10, 'Leyendo PDF...');
    const ab = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    onP(40, 'Aplicando marca de agua...');
    pages.forEach((page, i) => {
      onP(40 + (i / pages.length) * 50, `Página ${i + 1}/${pages.length}...`);
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) * 0.08;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      
      // Draw diagonal watermark
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.3,
        rotate: degrees(-45),
      });
    });

    onP(95, 'Guardando...');
    const bytes = await pdfDoc.save();
    onP(100, '¡Completado!');
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `marca-${file.name}`, pages: pages.length };
  }

  // ─── Get PDF page count (for extract UI) ──
  async function getPdfPageCount(file) {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    return pdf.numPages;
  }

  // ─── Get PDF thumbnail ───────────────────
  async function getPdfThumbnail(file, maxWidth = 200) {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const scale = maxWidth / vp.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  // ─── Main convert ────────────────────────
  async function convert(files, toolId, options, onP) {
    switch (toolId) {
      case 'pdf-to-word': return pdfToWord(files[0], onP);
      case 'word-to-pdf': return wordToPdf(files[0], onP);
      case 'image-to-pdf': return imageToPdf(files, onP);
      case 'merge-pdf': return mergePdfs(files, onP);
      case 'compress-pdf': return compressPdf(files[0], options.quality, onP);
      case 'pdf-to-image': return pdfToImages(files[0], onP);
      case 'rotate-pdf': return rotatePdf(files[0], options.angle || 90, onP);
      case 'extract-pages': return extractPages(files[0], options.pages || '1', onP);
      case 'watermark-pdf': return watermarkPdf(files[0], options.watermarkText || 'CONFIDENCIAL', onP);
      default: throw new Error('Herramienta no válida');
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return { getToolConfig, validateFiles, convert, triggerDownload, getPdfPageCount, getPdfThumbnail, TOOLS };
})();
