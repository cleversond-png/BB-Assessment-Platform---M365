const PDFDocument = require('pdfkit');

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0f1117',
  bg2:      '#1a1d2e',
  bg3:      '#242840',
  border:   '#2a2d45',
  text:     '#c8cde8',
  textDim:  '#6b7a99',
  textH:    '#e8ecff',
  blue:     '#4f8ef7',
  green:    '#22c55e',
  amber:    '#f59e0b',
  orange:   '#f97316',
  red:      '#ef4444',
  white:    '#ffffff',
};

const DOMAIN_LABELS = {
  baseline:      'Fundamentos',
  entraId:       'Identidade',
  emailSecurity: 'Email Security',
  sharePoint:    'SharePoint',
  governance:    'Governança',
  iaReadiness:   'IA Readiness',
};

const DOMAIN_ICONS = {
  baseline:      '🏢',
  entraId:       '🔐',
  emailSecurity: '📧',
  sharePoint:    '📁',
  governance:    '🏷',
  iaReadiness:   '🤖',
};

const SEVERITY_META = {
  critical: { label: 'Crítico',  color: C.red    },
  high:     { label: 'Alto',     color: C.amber  },
  medium:   { label: 'Médio',    color: C.blue   },
  low:      { label: 'Baixo',    color: C.textDim},
};

function scoreColor(v) {
  if (v == null) return C.textDim;
  if (v >= 4) return C.green;
  if (v >= 3) return C.amber;
  if (v >= 2) return C.orange;
  return C.red;
}

function scoreLabel(v) {
  if (v >= 4) return 'Boa';
  if (v >= 3) return 'Moderada';
  if (v >= 2) return 'Baixa';
  return 'Crítica';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

// ── Helpers de desenho ────────────────────────────────────────────────────────
function fullBg(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
}

function hLine(doc, y, opts = {}) {
  const { x = 48, width = doc.page.width - 96, color = C.border } = opts;
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.5).strokeColor(color).stroke();
}

function scoreBar(doc, x, y, w, h, value) {
  // track
  doc.roundedRect(x, y, w, h, h / 2).fill(C.bg3);
  if (value != null) {
    const fill = Math.max(h, (value / 5) * w);
    doc.roundedRect(x, y, fill, h, h / 2).fill(scoreColor(value));
  }
}

function pill(doc, x, y, text, bg, fg) {
  const pad = 8;
  const textW = doc.widthOfString(text);
  const pillW = textW + pad * 2;
  const pillH = 14;
  doc.roundedRect(x, y - 2, pillW, pillH, pillH / 2).fill(bg);
  doc.fontSize(7).fillColor(fg).text(text, x + pad, y + 1, { lineBreak: false });
  return pillW;
}

// ── Cabeçalho de seção ────────────────────────────────────────────────────────
function sectionHeader(doc, title, y) {
  doc.rect(48, y, doc.page.width - 96, 28).fill(C.bg2);
  doc.fontSize(9).fillColor(C.blue).font('Helvetica-Bold')
     .text(title.toUpperCase(), 60, y + 9, { lineBreak: false, characterSpacing: 0.8 });
  return y + 36;
}

// ── Página 1: Capa ────────────────────────────────────────────────────────────
function buildCover(doc, result) {
  fullBg(doc);

  const W = doc.page.width;
  const H = doc.page.height;
  const cx = W / 2;
  const score = result.overallScore;
  const color = scoreColor(score);

  // Faixa superior decorativa
  doc.rect(0, 0, W, 6).fill(C.blue);

  // Logo / produto
  doc.fontSize(10).fillColor(C.blue).font('Helvetica-Bold')
     .text('BB ASSESSMENT PLATFORM', 48, 40, { lineBreak: false });
  doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
     .text('Microsoft 365', 48, 55, { lineBreak: false });

  // Data
  doc.fontSize(8).fillColor(C.textDim)
     .text(fmtDate(result.assessedAt), 0, 40, { align: 'right', width: W - 48, lineBreak: false });

  // Nome do tenant
  const tenantName = result.tenantName || result.tenantId;
  doc.fontSize(28).fillColor(C.textH).font('Helvetica-Bold')
     .text(tenantName, 48, H / 2 - 120, { align: 'center', width: W - 96, lineBreak: false });

  doc.fontSize(10).fillColor(C.textDim).font('Helvetica')
     .text(result.tenantId, 48, H / 2 - 84, { align: 'center', width: W - 96, lineBreak: false });

  // Círculo de score
  const gaugeR = 72;
  const gx = cx;
  const gy = H / 2 + 20;

  // Anel de fundo
  doc.circle(gx, gy, gaugeR).lineWidth(10).strokeColor(C.bg3).stroke();
  // Valor
  doc.fontSize(36).fillColor(color).font('Helvetica-Bold')
     .text(score != null ? score.toFixed(1) : '—', gx - 40, gy - 26, { lineBreak: false });
  doc.fontSize(14).fillColor(C.textDim).font('Helvetica')
     .text('/5', gx + 14, gy - 16, { lineBreak: false });

  // Label maturidade
  doc.fontSize(13).fillColor(color).font('Helvetica-Bold')
     .text(`Maturidade ${scoreLabel(score)}`, 48, gy + gaugeR + 16, { align: 'center', width: W - 96, lineBreak: false });

  // Rodapé
  hLine(doc, H - 48);
  doc.fontSize(7).fillColor(C.textDim)
     .text('Documento gerado automaticamente — uso interno / pré-venda', 48, H - 36, { align: 'center', width: W - 96 });
}

// ── Página 2: Scores por domínio ─────────────────────────────────────────────
function buildScorePage(doc, result) {
  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('Resumo por Domínio', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  const domains = result.domains || {};

  for (const [key, meta] of Object.entries(DOMAIN_LABELS)) {
    const d = domains[key];
    const score = d?.domainScore;
    const hasError = !d || d.error;
    const color = scoreColor(score);
    const barW = W - 96 - 220;

    // Fundo da linha
    doc.rect(48, y - 4, W - 96, 36).fill(C.bg2);

    // Ícone + label
    doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
       .text(`${DOMAIN_ICONS[key]}  ${meta}`, 60, y + 4, { lineBreak: false });

    if (hasError) {
      doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
         .text('Indisponível', W - 180, y + 5, { lineBreak: false });
    } else {
      // Score numérico
      doc.fontSize(14).fillColor(color).font('Helvetica-Bold')
         .text(score != null ? score.toFixed(1) : '—', W - 180, y, { lineBreak: false });
      doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
         .text('/5', W - 156, y + 5, { lineBreak: false });

      // Barra de score
      scoreBar(doc, W - 136, y + 8, 88, 8, score);
    }

    y += 40;
  }

  // Linha de total
  y += 8;
  hLine(doc, y);
  y += 16;
  doc.fontSize(10).fillColor(C.textDim).font('Helvetica')
     .text('Score Geral', 60, y, { lineBreak: false });
  doc.fontSize(16).fillColor(scoreColor(result.overallScore)).font('Helvetica-Bold')
     .text(result.overallScore != null ? result.overallScore.toFixed(1) : '—', W - 180, y - 2, { lineBreak: false });
}

// ── Páginas de recomendações ──────────────────────────────────────────────────
function buildRecommendations(doc, recommendations) {
  if (!recommendations?.items?.length) return;

  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('Recomendações', 48, y);

  // Contadores por severidade
  const bs = recommendations.bySeverity || {};
  let bx = 48 + doc.widthOfString('Recomendações') + 16;
  for (const [sev, meta] of Object.entries(SEVERITY_META)) {
    if (bs[sev]) {
      bx += pill(doc, bx, y + 4, `${bs[sev]} ${meta.label}`, meta.color + '22', meta.color) + 6;
    }
  }

  y += 32;
  hLine(doc, y);
  y += 20;

  const items = recommendations.items || [];
  const order = ['critical', 'high', 'medium', 'low'];

  for (const sev of order) {
    const group = items.filter((i) => i.severity === sev);
    if (!group.length) continue;

    const meta = SEVERITY_META[sev];

    // Cabeçalho do grupo
    y = sectionHeader(doc, meta.label, y);

    for (const rec of group) {
      // Verificar se precisa de nova página (margem de 120px para o item)
      if (y > doc.page.height - 140) {
        doc.addPage();
        fullBg(doc);
        y = 48;
      }

      // Faixa lateral colorida
      doc.rect(48, y, 3, 0).fill(meta.color); // será ajustada após medir altura

      const startY = y;
      const textX = 60;
      const textW = W - 108;

      // Categoria + esforço
      doc.fontSize(7).fillColor(meta.color).font('Helvetica-Bold')
         .text(rec.category?.toUpperCase() || '', textX, y + 2, { lineBreak: false });

      const effortLabels = { low: 'Esforço baixo', medium: 'Esforço médio', high: 'Esforço alto' };
      const effortTxt = effortLabels[rec.effort] || rec.effort || '';
      if (effortTxt) {
        doc.fontSize(7).fillColor(C.textDim).font('Helvetica')
           .text(effortTxt, W - 48 - doc.widthOfString(effortTxt), y + 2, { lineBreak: false });
      }
      y += 14;

      // Finding
      doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
         .text(rec.finding || '', textX, y, { width: textW, lineBreak: true });
      y += doc.heightOfString(rec.finding || '', { width: textW }) + 4;

      // Recomendação
      doc.fontSize(8.5).fillColor(C.text).font('Helvetica')
         .text(rec.recommendation || '', textX, y, { width: textW, lineBreak: true });
      y += doc.heightOfString(rec.recommendation || '', { width: textW }) + 8;

      // Faixa lateral (ajustada à altura real do item)
      doc.rect(48, startY, 3, y - startY).fill(meta.color);

      hLine(doc, y, { color: C.bg3 });
      y += 12;
    }

    y += 8;
  }
}

// ── Página: IA Readiness ──────────────────────────────────────────────────────
function buildIAReadiness(doc, result) {
  const ia = result.domains?.iaReadiness;
  if (!ia) return;

  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('🤖  IA Readiness — Copilot M365', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  // Score + nível
  const score = ia.domainScore;
  const color = scoreColor(score);
  doc.fontSize(32).fillColor(color).font('Helvetica-Bold')
     .text(score != null ? score.toFixed(1) : '—', 48, y, { lineBreak: false });
  doc.fontSize(10).fillColor(C.textDim).font('Helvetica')
     .text('/5', 90, y + 14, { lineBreak: false });
  if (ia.readinessLevel) {
    doc.fontSize(12).fillColor(color).font('Helvetica-Bold')
       .text(ia.readinessLevel, 110, y + 10, { lineBreak: false });
  }
  y += 52;

  // Blockers críticos
  const blockers = ia.summary?.criticalBlockers || 0;
  const blockerColor = blockers > 0 ? C.red : C.green;
  const blockerMsg = blockers > 0
    ? `${blockers} bloqueador${blockers > 1 ? 'es' : ''} crítico${blockers > 1 ? 's' : ''} identificado${blockers > 1 ? 's' : ''}`
    : 'Nenhum bloqueador crítico identificado';
  doc.rect(48, y, W - 96, 32).fill(blockerColor + '15');
  doc.fontSize(9).fillColor(blockerColor).font('Helvetica-Bold')
     .text(blockerMsg, 64, y + 10, { lineBreak: false });
  y += 44;

  // Checklist
  const checks = ia.checks || [];
  if (checks.length) {
    y = sectionHeader(doc, 'Critérios Avaliados', y);

    for (const check of checks) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        fullBg(doc);
        y = 48;
      }

      const icon = check.passed ? '✓' : '✗';
      const iColor = check.passed ? C.green : C.red;

      doc.fontSize(9).fillColor(iColor).font('Helvetica-Bold')
         .text(icon, 48, y, { lineBreak: false });
      doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
         .text(check.label || '', 66, y, { lineBreak: false });
      y += 14;

      if (check.detail) {
        doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
           .text(check.detail, 66, y, { width: W - 114, lineBreak: true });
        y += doc.heightOfString(check.detail, { width: W - 114 }) + 6;
      } else {
        y += 4;
      }
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
function generatePDF(result, outputStream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: `M365 Assessment — ${result.tenantName || result.tenantId}`,
      Author: 'BB Assessment Platform',
      Subject: 'Microsoft 365 Security & Governance Assessment',
    },
  });

  doc.pipe(outputStream);

  buildCover(doc, result);
  buildScorePage(doc, result);
  buildRecommendations(doc, result.recommendations);
  buildIAReadiness(doc, result);

  doc.end();
}

module.exports = { generatePDF };
