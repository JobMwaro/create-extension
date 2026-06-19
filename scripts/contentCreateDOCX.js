// Word export — emits the manual as a .docx file matching the OBRS template.
//
// Uses the `docx` library (browser IIFE build at scripts/docx.js).
// Window global: `docx`.
//
// Reference template (OBRS_NonIndividual_User_Manual.docx):
//   Cover page: Arial. Title 24pt bold #0C3461. Subtitle 18pt bold #4472C4.
//   Tagline 12pt #555555. Organization 12pt bold. Portal 11pt. URL 11pt #0066CC.
//   Version 11pt #555555.
//   Header (p2+): right-aligned italic 9pt #888888 "<title> · <subtitle>"
//   Footer:       center            9pt #888888 "<organization> · Page X of Y"
//   Body: Heading2 numbered section title. Intro paragraph.
//   Numbered list of step descriptions. Centered image. Italic figure caption.

(function () {
  if (!window.docx) {
    console.warn('docx library not loaded; Word export disabled.');
    return;
  }
  const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Header, Footer, AlignmentType, PageNumber,
    LevelFormat, HeadingLevel, BorderStyle, PageOrientation,
    ShadingType,
    Table, TableRow, TableCell, WidthType,
    TableOfContents, PageBreak,
  } = window.docx;

  // EMU dimensions for embedded images. Word uses EMUs at 914400/inch.
  // A4 content width with 1-inch margins ≈ 6.27 inches → 5.5 inch image fits well.
  const IMAGE_TARGET_PX = 520; // ~5.4" at 96dpi

  function colour(hex) {
    return hex.replace('#', '').toUpperCase();
  }

  function dataUrlToUint8(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const b64 = dataUrl.slice(comma + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function loadImageDimensions(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 800, h: 450 });
      img.src = src;
    });
  }


  function blankLine() {
    return new Paragraph({ children: [new TextRun('')] });
  }

  function coverParagraphs(meta) {
    const cover = [];
    const spacer = (n = 1) => { for (let i = 0; i < n; i++) cover.push(blankLine()); };
    spacer(6);
    cover.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: meta.title || '', bold: true, size: 48, color: colour('#0C3461'), font: 'Arial' })],
    }));
    cover.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: meta.subtitle || '', bold: true, size: 36, color: colour('#4472C4'), font: 'Arial' })],
    }));
    cover.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: meta.tagline || '', size: 24, color: colour('#555555'), font: 'Arial' })],
    }));
    cover.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: meta.organization || '', bold: true, size: 24, font: 'Arial' })],
    }));
    cover.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: meta.portalName || '', size: 22, font: 'Arial' })],
    }));
    if (meta.url) {
      cover.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: meta.url, size: 22, color: colour('#0066CC'), font: 'Arial' })],
      }));
    }
    cover.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: meta.version || '', size: 22, color: colour('#555555'), font: 'Arial' })],
    }));
    // Page break out of the cover page
    cover.push(new Paragraph({ children: [new TextRun({ break: 1 })], pageBreakBefore: false }));
    return cover;
  }

  function sectionParagraphs(section, _numberingRef, isFirst) {
    const out = [];
    if (section.title) {
      out.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        // Every section after the first starts on a new page so chapters
        // don't collide visually in the TOC.
        pageBreakBefore: !isFirst,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: section.title, bold: true, size: 32, color: colour('#0C3461'), font: 'Arial' })],
      }));
    }
    if (section.intro) {
      out.push(new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: section.intro, size: 22, font: 'Arial' })],
      }));
    }
    if (section.purpose) {
      out.push(...labelledMetaBlock('Purpose', section.purpose));
    }
    if (section.prerequisites) {
      out.push(...bulletedMetaBlock('Prerequisites', section.prerequisites));
    }
    return out;
  }

  function labelledMetaBlock(label, body) {
    return [
      new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [new TextRun({ text: `${label}:`, bold: true, size: 22, font: 'Arial' })],
      }),
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 160 },
        children: [new TextRun({ text: String(body), size: 22, font: 'Arial' })],
      }),
    ];
  }

  function bulletedMetaBlock(label, body) {
    const items = String(body).split(/\r?\n/).map(s => s.replace(/^\s*[•\-\*]\s*/, '').trim()).filter(Boolean);
    const out = [new Paragraph({
      spacing: { before: 80, after: 40 },
      children: [new TextRun({ text: `${label}:`, bold: true, size: 22, font: 'Arial' })],
    })];
    for (const item of items) {
      out.push(new Paragraph({
        numbering: { reference: 'meta-bullets', level: 0 },
        spacing: { after: 40 },
        children: [new TextRun({ text: item, size: 22, font: 'Arial' })],
      }));
    }
    return out;
  }

  async function stepParagraphs(steps, numberingRef) {
    const out = [];
    let prevStep = null;
    for (const step of steps) {
      // Narrative blocks render as a plain prose paragraph, not numbered.
      if (step.kind === 'narrative') {
        const text = (step.description || '').trim();
        if (text) {
          out.push(new Paragraph({
            spacing: { before: 80, after: 160 },
            children: [new TextRun({ text, size: 22, font: 'Arial' })],
          }));
        }
        prevStep = step;
        continue;
      }
      const description = step.description && step.description.length > 0
        ? step.description
        : StepsRepo.describeStep(step);
      out.push(new Paragraph({
        numbering: { reference: numberingRef, level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: description, size: 22, font: 'Arial' })],
      }));

      // Context extras (tabs, filters, status counters, free-form),
      // deduped against the previous step so the same line doesn't repeat
      // on every step of the same screen.
      const extras = StepsRepo.visibleExtras(step, prevStep);
      for (const extra of extras) {
        out.push(new Paragraph({
          indent: { left: 720 },
          spacing: { after: 60 },
          children: [new TextRun({ text: extra, size: 22, font: 'Arial' })],
        }));
      }

      // Image — the click marker (purple ribbon + cursor pointer) is
      // already baked into the captured screenshot at click time.
      try {
        const { w, h } = await loadImageDimensions(step.image);
        const ratio = h / w;
        const imgW = IMAGE_TARGET_PX;
        const imgH = Math.round(imgW * ratio);
        out.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 60 },
          children: [new ImageRun({
            type: 'png',
            data: dataUrlToUint8(step.image),
            transformation: { width: imgW, height: imgH },
            altText: {
              title: `Step ${step.order ?? step.id}`,
              description: description,
              name: `step-${step.id}`,
            },
          })],
        }));
      } catch (err) {
        console.warn(`Skipping image for step ${step.id}:`, err);
      }

      const caption = step.caption && step.caption.length > 0
        ? step.caption
        : StepsRepo.defaultCaption(step);
      out.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: caption, italics: true, size: 20, color: colour('#555555'), font: 'Arial' })],
      }));

      // Result line (toast / validation text observed after the action)
      if (step.result && step.result.trim().length > 0) {
        out.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({ text: '→ ', size: 20, color: colour('#94A3B8'), font: 'Arial' }),
            new TextRun({ text: 'Result: ', bold: true, size: 20, color: colour('#1F5FC6'), font: 'Arial' }),
            new TextRun({ text: step.result.trim(), italics: true, size: 20, color: colour('#1F5FC6'), font: 'Arial' }),
          ],
        }));
      }

      // Note callout — single-cell table so we get cell margins (text
      // padding) independent of the gold left border + yellow shading.
      // Word doesn't support rounded paragraph/cell borders natively; the
      // export keeps right-angle corners while the editor preview is rounded.
      if (step.note && step.note.trim().length > 0) {
        const noBorder      = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' };
        const outlineBorder = { style: BorderStyle.SINGLE, size: 2,  color: 'F5E5A8' }; // ~0.25pt light gold
        const goldBorder    = { style: BorderStyle.SINGLE, size: 12, color: 'F5B400' }; // ~1.5pt gold rule
        out.push(new Table({
          width: { size: 9026, type: WidthType.DXA }, // ~A4 content width with 1" margins
          columnWidths: [9026],
          // Suppress Word's default table borders; only the cell shows the
          // gold left rule + light-gold outline below.
          borders: {
            top:              noBorder,
            bottom:           noBorder,
            left:             noBorder,
            right:            noBorder,
            insideHorizontal: noBorder,
            insideVertical:   noBorder,
          },
          rows: [new TableRow({
            children: [new TableCell({
              width: { size: 9026, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: 'FFF8E1', color: 'auto' },
              margins: { top: 120, bottom: 120, left: 180, right: 180 },
              borders: {
                top:    outlineBorder,
                bottom: outlineBorder,
                right:  outlineBorder,
                left:   goldBorder,
              },
              children: [new Paragraph({
                children: [
                  new TextRun({ text: 'Note: ',           bold: true, size: 22, color: '4A3A06', font: 'Arial' }),
                  new TextRun({ text: step.note.trim(),               size: 22, color: '4A3A06', font: 'Arial' }),
                ],
              })],
            })],
          })],
        }));
        // Spacer paragraph after the table for breathing room
        out.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun('')] }));
      }

      prevStep = step;
    }
    return out;
  }

  function buildHeader(meta) {
    const headerText = [meta.title, meta.subtitle].filter(Boolean).join(' · ');
    return new Header({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: headerText, italics: true, size: 18, color: colour('#888888'), font: 'Arial' })],
      })],
    });
  }

  function buildFooter(meta) {
    const orgPrefix = meta.organization ? meta.organization.split('(')[0].trim() + ' · ' : '';
    return new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${orgPrefix}Page `, size: 18, color: colour('#888888'), font: 'Arial' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: colour('#888888'), font: 'Arial' }),
          new TextRun({ text: ' of ',                  size: 18, color: colour('#888888'), font: 'Arial' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: colour('#888888'), font: 'Arial' }),
        ],
      })],
    });
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportDocx() {
    const [meta, raw, sectionsRaw] = await Promise.all([
      StepsRepo.getMeta(),
      StepsRepo.listSteps(),
      StepsRepo.listSections(),
    ]);
    const compiled = StepsRepo.compileSteps(raw);

    const renderSections = sectionsRaw.length > 0
      ? sectionsRaw
      : [{
          id: null,
          title:           meta.sectionTitle,
          intro:           meta.intro,
          purpose:         meta.purpose,
          prerequisites:   meta.prerequisites,
          expectedOutcome: meta.expectedOutcome,
        }];

    const cover = coverParagraphs(meta);

    // One numbering reference per section so the counter restarts at 1
    // for each chapter. docx-js doesn't expose Word's startOverride directly,
    // so independent references are the cleanest path.
    const numberingConfig = renderSections.map((_, idx) => ({
      reference: `step-numbering-${idx + 1}`,
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    })).concat([{
      reference: 'meta-bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }]);

    // Build body section-by-section
    const bodyChildren = [];
    for (let i = 0; i < renderSections.length; i++) {
      const section = renderSections[i];
      const stepsInSection = section.id == null
        ? compiled.filter(s => !s.sectionId)
        : compiled.filter(s => s.sectionId === section.id);
      const numberingRef = `step-numbering-${i + 1}`;
      const isFirst = (i === 0);
      bodyChildren.push(...sectionParagraphs(section, numberingRef, isFirst));
      bodyChildren.push(...(await stepParagraphs(stepsInSection, numberingRef)));
      if (section.expectedOutcome) {
        bodyChildren.push(...labelledMetaBlock('Expected outcome', section.expectedOutcome));
      }
    }
    const tocParagraphs = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'Table of Contents', bold: true, size: 32, font: 'Arial' })],
      }),
      new Paragraph({
        children: [new TableOfContents('Table of Contents', {
          hyperlink: true,
          headingStyleRange: '1-3',
        })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ];

    const doc = new Document({
      creator: 'Create Chrome Extension',
      title: meta.title || 'User Manual',
      styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 32, bold: true, font: 'Arial' },
            paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 28, bold: true, font: 'Arial' },
            paragraph: { spacing: { before: 200, after: 160 }, outlineLevel: 1 } },
        ],
      },
      numbering: { config: numberingConfig },
      sections: [
        // Cover section: no header/footer
        {
          properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: cover,
        },
        // Body section: TOC + header + footer + section-by-section content.
        // Word will prompt the reader to update the TOC field on open (or
        // they can right-click → Update Field).
        {
          properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          headers: { default: buildHeader(meta) },
          footers: { default: buildFooter(meta) },
          children: [...tocParagraphs, ...bodyChildren],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const safeName = (meta.title || 'user-manual')
      .replace(/[^a-z0-9_\- ]+/gi, '').trim().replace(/\s+/g, '_') || 'user-manual';
    triggerDownload(blob, `${safeName}.docx`);
  }

  window.CreateExtDocx = { export: exportDocx };
})();
