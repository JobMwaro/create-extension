// PDF export — emits the manual in the OBRS template:
//   - Cover page (title, subtitle, tagline, organization, portal name, URL, version)
//   - Body page(s): section title, intro, numbered steps with screenshots and figure captions
//   - Header (page 2+): right-aligned, italic, gray
//   - Footer: center, gray, "Organization · Page X of Y"
//
// Uses jsPDF (loaded as window.jspdf.jsPDF).

(function () {
  const A4 = { width: 210, height: 297 };           // mm
  const MARGIN = { top: 22, right: 18, bottom: 22, left: 18 };
  const CONTENT_W = A4.width - MARGIN.left - MARGIN.right;

  // Colors from the OBRS template
  const COLOR_TITLE     = '#0C3461';
  const COLOR_SUBTITLE  = '#4472C4';
  const COLOR_TAGLINE   = '#555555';
  const COLOR_URL       = '#0066CC';
  const COLOR_MUTED     = '#888888';
  const COLOR_BODY      = '#111111';

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = src;
    });
  }

  function setText(doc, text, opts) {
    doc.setFont('helvetica', opts.bold ? 'bold' : (opts.italic ? 'italic' : 'normal'));
    doc.setFontSize(opts.size);
    doc.setTextColor(opts.color || COLOR_BODY);
    const align = opts.align || 'left';
    const x = align === 'center'
      ? A4.width / 2
      : (align === 'right' ? A4.width - MARGIN.right : MARGIN.left);
    doc.text(text, x, opts.y, { align, maxWidth: CONTENT_W });
  }

  function wrapText(doc, text, fontSize, maxWidth) {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth);
  }

  function drawCoverPage(doc, meta) {
    let y = 70;
    setText(doc, meta.title || '',        { y, size: 28, bold: true, color: COLOR_TITLE,    align: 'center' });
    y += 14;
    setText(doc, meta.subtitle || '',     { y, size: 20, bold: true, color: COLOR_SUBTITLE, align: 'center' });
    y += 10;
    setText(doc, meta.tagline || '',      { y, size: 12,             color: COLOR_TAGLINE,  align: 'center' });
    y += 40;
    setText(doc, meta.organization || '', { y, size: 13, bold: true,                        align: 'center' });
    y += 7;
    setText(doc, meta.portalName || '',   { y, size: 12,                                    align: 'center' });
    y += 6;
    if (meta.url) {
      setText(doc, meta.url, { y, size: 12, color: COLOR_URL, align: 'center' });
      y += 8;
    }
    setText(doc, meta.version || '', { y, size: 12, color: COLOR_TAGLINE, align: 'center' });
  }

  // Reserve room at the top/bottom for header + footer once drawn.
  function drawHeader(doc, meta) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(COLOR_MUTED);
    const headerText = [meta.title, meta.subtitle].filter(Boolean).join(' · ');
    doc.text(headerText, A4.width - MARGIN.right, 12, { align: 'right' });
  }

  function drawFooter(doc, meta, page, totalPages) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(COLOR_MUTED);
    const left = meta.organization ? meta.organization.split('(')[0].trim() : '';
    const text = `${left ? left + ' · ' : ''}Page ${page} of ${totalPages}`;
    doc.text(text, A4.width / 2, A4.height - 10, { align: 'center' });
  }

  function newBodyPage(doc) {
    doc.addPage();
    return MARGIN.top;
  }

  function ensureSpace(doc, y, needed) {
    if (y + needed > A4.height - MARGIN.bottom) return newBodyPage(doc);
    return y;
  }

  async function drawBody(doc, renderSections, compiled) {
    let y = MARGIN.top;
    let firstSection = true;
    for (const section of renderSections) {
      if (!firstSection) {
        // Start each new section on a fresh page — matches the OBRS layout
        // where each chapter begins on its own page.
        y = newBodyPage(doc);
      }
      firstSection = false;
      const stepsInSection = section.id == null
        ? compiled.filter(s => !s.sectionId)
        : compiled.filter(s => s.sectionId === section.id);
      y = await drawSection(doc, section, stepsInSection, y);
    }
  }

  async function drawSection(doc, section, steps, startY) {
    let y = startY;

    // H1 section title (large bold navy)
    if (section.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(COLOR_TITLE);
      const lines = wrapText(doc, section.title, 20, CONTENT_W);
      for (const line of lines) {
        y = ensureSpace(doc, y, 10);
        doc.text(line, MARGIN.left, y);
        y += 9;
      }
      y += 2;
    }

    // Intro
    if (section.intro) {
      const lines = wrapText(doc, section.intro, 11, CONTENT_W);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(COLOR_BODY);
      for (const line of lines) {
        y = ensureSpace(doc, y, 6);
        doc.text(line, MARGIN.left, y);
        y += 5.5;
      }
      y += 4;
    }

    if (section.purpose) {
      y = drawMetaBlock(doc, 'Purpose', section.purpose, y);
    }
    if (section.prerequisites) {
      y = drawBulletedMetaBlock(doc, 'Prerequisites', section.prerequisites, y);
    }

    // Steps within this section — numbering restarts at 1
    let prevStep = null;
    let manualOrdinal = 0;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Narrative blocks: pass through as a plain prose paragraph
      if (step.kind === 'narrative') {
        const text = (step.description || '').trim();
        if (!text) continue;
        const lines = wrapText(doc, text, 11, CONTENT_W);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(COLOR_BODY);
        for (const line of lines) {
          y = ensureSpace(doc, y, 6);
          doc.text(line, MARGIN.left, y);
          y += 5.5;
        }
        y += 4;
        prevStep = step;
        continue;
      }

      manualOrdinal += 1;
      const ordinal = manualOrdinal;
      const description = step.description && step.description.length > 0
        ? step.description
        : StepsRepo.describeStep(step);
      const numberedText = `${ordinal}. ${description}`;
      const numberedLines = wrapText(doc, numberedText, 11, CONTENT_W);

      // Estimate height for the whole step block so we can avoid splitting
      // the screenshot from its number when possible.
      let img;
      try { img = await loadImage(step.image); } catch (e) { img = null; }
      const imgPlannedW = img ? Math.min(CONTENT_W, 150) : 0;
      const imgPlannedH = img ? imgPlannedW * (img.height / img.width) : 0;

      const blockH = numberedLines.length * 5.5 + 4 + imgPlannedH + 8 + 5;
      if (y + blockH > A4.height - MARGIN.bottom && y > MARGIN.top) {
        y = newBodyPage(doc);
      }

      // Numbered description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(COLOR_BODY);
      for (const line of numberedLines) {
        y = ensureSpace(doc, y, 6);
        doc.text(line, MARGIN.left, y);
        y += 5.5;
      }

      // Context extras (Tabs / Filters / Status counters / freeform)
      const extras = StepsRepo.visibleExtras(step, prevStep);
      if (extras.length > 0) {
        y += 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(COLOR_BODY);
        for (const extra of extras) {
          const extraLines = wrapText(doc, extra, 11, CONTENT_W - 6);
          for (const line of extraLines) {
            y = ensureSpace(doc, y, 6);
            doc.text(line, MARGIN.left + 6, y);
            y += 5.2;
          }
        }
      }
      y += 3;

      // Screenshot — the click marker (purple ribbon + cursor pointer) is
      // already baked into the captured image at click time.
      if (img) {
        const imgW = imgPlannedW;
        const imgH = imgPlannedH;
        y = ensureSpace(doc, y, imgH + 8);
        const x = MARGIN.left + (CONTENT_W - imgW) / 2;
        doc.addImage(step.image, 'PNG', x, y, imgW, imgH);
        y += imgH + 3;
      }

      // Caption
      const caption = step.caption && step.caption.length > 0
        ? step.caption
        : StepsRepo.defaultCaption(step);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(COLOR_TAGLINE);
      const captionLines = wrapText(doc, caption, 10, CONTENT_W);
      for (const line of captionLines) {
        y = ensureSpace(doc, y, 5);
        doc.text(line, A4.width / 2, y, { align: 'center' });
        y += 4.5;
      }

      // Result line (toast / validation text observed after the action)
      if (step.result && step.result.trim().length > 0) {
        const resultText = `→ Result: ${step.result.trim()}`;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(31, 95, 198); // #1F5FC6
        const lines = wrapText(doc, resultText, 10, CONTENT_W - 12);
        for (const line of lines) {
          y = ensureSpace(doc, y, 5);
          doc.text(line, A4.width / 2, y, { align: 'center' });
          y += 4.5;
        }
        y += 1;
      }

      // Note callout — rounded card with light-gold outline + thicker gold
      // left rule, matching the editor design.
      if (step.note && step.note.trim().length > 0) {
        y += 4;
        const noteText = step.note.trim();
        const padX = 4;
        const padY = 4;
        const innerW = CONTENT_W - 12;
        const radius = 1.5;          // ~6px equivalent — modern, subtle
        const labelW = doc.getTextDimensions('Note: ', { fontSize: 11 }).w + 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const bodyLines = doc.splitTextToSize(noteText, innerW - labelW - padX * 2 - 3);
        const blockH = padY * 2 + bodyLines.length * 5.5;
        y = ensureSpace(doc, y, blockH + 4);

        // Background fill + light-gold outline (drawn together with style 'FD')
        doc.setFillColor(255, 248, 225);     // #FFF8E1
        doc.setDrawColor(245, 229, 168);     // #F5E5A8
        doc.setLineWidth(0.25);              // ~0.7pt outline (slimmer)
        doc.roundedRect(MARGIN.left + 6, y, innerW, blockH, radius, radius, 'FD');

        // Gold left rule — clipped to the rounded silhouette so its outer
        // corners curve with the card while the right edge stays flat.
        doc.saveGraphicsState();
        doc.roundedRect(MARGIN.left + 6, y, innerW, blockH, radius, radius);
        doc.clip();
        doc.discardPath();
        doc.setFillColor(245, 180, 0);       // #F5B400
        doc.rect(MARGIN.left + 6, y, 1.4, blockH, 'F');
        doc.restoreGraphicsState();

        // "Note:" label (bold)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(74, 58, 6);         // #4A3A06
        const textBaseY = y + padY + 4;
        const textStartX = MARGIN.left + 6 + padX + 3; // past the gold rule
        doc.text('Note:', textStartX, textBaseY);
        // Body (regular)
        doc.setFont('helvetica', 'normal');
        let bodyY = textBaseY;
        for (const line of bodyLines) {
          doc.text(line, textStartX + labelW, bodyY);
          bodyY += 5.5;
        }
        y += blockH + 9; // breathing room before the next step
      } else {
        y += 4;
      }

      prevStep = step;
    }

    if (section.expectedOutcome) {
      y += 2;
      y = drawMetaBlock(doc, 'Expected outcome', section.expectedOutcome, y);
    }
    return y;
  }

  function drawMetaBlock(doc, label, body, y) {
    y = ensureSpace(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(COLOR_BODY);
    doc.text(`${label}:`, MARGIN.left, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR_BODY);
    const lines = wrapText(doc, body, 11, CONTENT_W - 6);
    for (const line of lines) {
      y = ensureSpace(doc, y, 6);
      doc.text(line, MARGIN.left + 6, y);
      y += 5.2;
    }
    return y + 4;
  }

  function drawBulletedMetaBlock(doc, label, body, y) {
    y = ensureSpace(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(COLOR_BODY);
    doc.text(`${label}:`, MARGIN.left, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    const items = String(body).split(/\r?\n/).map(s => s.replace(/^\s*[•\-\*]\s*/, '').trim()).filter(Boolean);
    for (const item of items) {
      const lines = wrapText(doc, item, 11, CONTENT_W - 12);
      lines.forEach((line, idx) => {
        y = ensureSpace(doc, y, 6);
        if (idx === 0) doc.text('•', MARGIN.left + 6, y);
        doc.text(line, MARGIN.left + 12, y);
        y += 5.2;
      });
    }
    return y + 4;
  }

  async function exportPdf() {
    const [meta, raw, sections] = await Promise.all([
      StepsRepo.getMeta(),
      StepsRepo.listSteps(),
      StepsRepo.listSections(),
    ]);
    const compiled = StepsRepo.compileSteps(raw);
    const doc = new window.jspdf.jsPDF('p', 'mm', 'a4');

    // Page 1: cover (no header/footer)
    drawCoverPage(doc, meta);

    const renderSections = sections.length > 0
      ? sections
      : [{
          id: null,
          title:           meta.sectionTitle,
          intro:           meta.intro,
          purpose:         meta.purpose,
          prerequisites:   meta.prerequisites,
          expectedOutcome: meta.expectedOutcome,
        }];

    const hasAnyBodyContent = compiled.length > 0
      || renderSections.some(s => s.title || s.intro || s.purpose || s.prerequisites || s.expectedOutcome);

    if (hasAnyBodyContent) {
      doc.addPage();
      await drawBody(doc, renderSections, compiled);
    }

    // Header/footer pass (skip cover page)
    const totalPages = doc.getNumberOfPages();
    for (let p = 2; p <= totalPages; p++) {
      doc.setPage(p);
      drawHeader(doc, meta);
      drawFooter(doc, meta, p - 1, totalPages - 1);
    }

    const safeName = (meta.title || 'user-manual').replace(/[^a-z0-9_\- ]+/gi, '').trim().replace(/\s+/g, '_') || 'user-manual';
    doc.save(`${safeName}.pdf`);
  }

  window.CreateExtPdf = { export: exportPdf };
})();
