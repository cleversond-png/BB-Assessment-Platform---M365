const PDFDocument = require('pdfkit');
const path = require('path');

// ── Paleta light ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#ffffff',
  bg2:     '#f8fafc',
  bg3:     '#f1f5f9',
  border:  '#e2e8f0',
  text:    '#334155',
  textDim: '#64748b',
  textH:   '#0f172a',
  blue:    '#2563eb',
  green:   '#16a34a',
  amber:   '#d97706',
  orange:  '#ea580c',
  red:     '#dc2626',
  white:   '#ffffff',
  accent:  '#1e40af',
};

const FONT_DIR = path.join(__dirname, 'fonts');

const DOMAIN_LABELS = {
  baseline:      'Fundamentos',
  entraId:       'Identidade',
  emailSecurity: 'Email Security',
  sharePoint:    'SharePoint',
  governance:    'Governanca',
  teams:         'Teams',
  iaReadiness:   'IA Readiness',
};

const SEVERITY_META = {
  critical: { label: 'Critico', color: C.red    },
  high:     { label: 'Alto',    color: C.amber  },
  medium:   { label: 'Medio',   color: C.blue   },
  low:      { label: 'Baixo',   color: C.textDim},
};

// ── Helpers de dado ───────────────────────────────────────────────────────────
function scoreColor(v) {
  if (v == null) return C.textDim;
  if (v >= 4)   return C.green;
  if (v >= 3)   return C.amber;
  if (v >= 2)   return C.orange;
  return C.red;
}

function scoreLabel(v) {
  if (v >= 4) return 'Boa';
  if (v >= 3) return 'Moderada';
  if (v >= 2) return 'Baixa';
  return 'Critica';
}

function trafficColor(v) {
  if (v == null) return C.textDim;
  if (v >= 3.5)  return C.green;
  if (v >= 2.5)  return C.amber;
  return C.red;
}

function trafficLabel(v) {
  if (v == null) return '-';
  if (v >= 3.5)  return 'Bom';
  if (v >= 2.5)  return 'Atencao';
  return 'Critico';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
}

// ── Helpers de icone (vector) ─────────────────────────────────────────────────
function drawCheck(doc, x, y, size, color) {
  doc.lineWidth(1.5).strokeColor(color)
     .moveTo(x + size * 0.15, y + size * 0.52)
     .lineTo(x + size * 0.42, y + size * 0.78)
     .lineTo(x + size * 0.85, y + size * 0.22)
     .stroke();
}

function drawCross(doc, x, y, size, color) {
  const p = size * 0.22;
  doc.lineWidth(1.5).strokeColor(color)
     .moveTo(x + p, y + p).lineTo(x + size - p, y + size - p).stroke();
  doc.lineWidth(1.5).strokeColor(color)
     .moveTo(x + size - p, y + p).lineTo(x + p, y + size - p).stroke();
}

// ── Helpers de layout ─────────────────────────────────────────────────────────
function hLine(doc, y, opts = {}) {
  const { x = 48, width = doc.page.width - 96, color = C.border } = opts;
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.5).strokeColor(color).stroke();
}

function scoreBar(doc, x, y, w, h, value) {
  doc.roundedRect(x, y, w, h, h / 2).fill(C.bg3);
  if (value != null) {
    const fill = Math.max(0, (value / 5) * w);
    doc.roundedRect(x, y, fill, h, h / 2).fill(scoreColor(value));
  }
}

function pill(doc, x, y, text, bg, fg) {
  const pad = 8;
  const textW = doc.widthOfString(text);
  const pillW = textW + pad * 2;
  const pillH = 14;
  doc.roundedRect(x, y - 2, pillW, pillH, pillH / 2).fill(bg);
  doc.fontSize(7).fillColor(fg).font('Body').text(text, x + pad, y + 1, { lineBreak: false });
  return pillW;
}

function trafficDot(doc, cx, cy, score) {
  doc.circle(cx, cy, 7).fill(trafficColor(score));
}

function sectionHeader(doc, title, y) {
  doc.rect(48, y, doc.page.width - 96, 26).fill(C.bg3);
  doc.moveTo(48, y).lineTo(doc.page.width - 48, y).lineWidth(0.5).strokeColor(C.border).stroke();
  doc.moveTo(48, y + 26).lineTo(doc.page.width - 48, y + 26).lineWidth(0.5).strokeColor(C.border).stroke();
  doc.fontSize(8).fillColor(C.accent).font('Body-Bold')
     .text(title.toUpperCase(), 60, y + 9, { lineBreak: false, characterSpacing: 0.6 });
  return y + 34;
}

function pageKicker(doc, text, y) {
  doc.fontSize(7.5).fillColor(C.accent).font('Body-Bold')
     .text(text.toUpperCase(), 48, y, { lineBreak: false, characterSpacing: 0.8 });
  return y + 16;
}

// ── Página 1: Capa ────────────────────────────────────────────────────────────
function buildCover(doc, result) {
  const W = doc.page.width;
  const H = doc.page.height;
  const cx = W / 2;
  const score = result.overallScore;
  const color = scoreColor(score);

  const ia = result.domains?.iaReadiness;
  const copilotReady   = ia?.copilotReady ?? false;
  const readinessLevel = ia?.readinessLevel ?? null;
  const verdictColor   = copilotReady ? C.green
    : (readinessLevel?.includes('Parcial') || readinessLevel?.includes('Moderada')) ? C.amber
    : C.red;

  // Faixa superior azul escuro
  doc.rect(0, 0, W, 8).fill(C.accent);

  // Cabecalho do produto
  doc.fontSize(9).fillColor(C.accent).font('Body-Bold')
     .text('BB ASSESSMENT PLATFORM', 48, 28, { lineBreak: false });
  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text('Microsoft 365  ·  Security & Governance', 48, 42, { lineBreak: false });

  // Linha separadora no topo
  hLine(doc, 60, { color: C.border });

  // Nome do tenant centralizado
  const tenantName = result.tenantName || result.tenantId;
  doc.fontSize(28).fillColor(C.textH).font('Body-Bold')
     .text(tenantName, 48, H / 2 - 150, { align: 'center', width: W - 96, lineBreak: false });
  doc.fontSize(9).fillColor(C.textDim).font('Body')
     .text(result.tenantId, 48, H / 2 - 112, { align: 'center', width: W - 96, lineBreak: false });

  hLine(doc, H / 2 - 88, { color: C.border });

  // Bloco de score centralizado
  const gaugeR = 60;
  const gx = cx - 100;
  const gy = H / 2 - 20;

  // Circulo de score (outline azul)
  doc.circle(gx, gy, gaugeR).lineWidth(6).strokeColor(C.bg3).stroke();
  doc.circle(gx, gy, gaugeR).lineWidth(2).strokeColor(color + '60').stroke();
  doc.fontSize(30).fillColor(color).font('Body-Bold')
     .text(score != null ? score.toFixed(1) : '-', gx - 34, gy - 22, { lineBreak: false });
  doc.fontSize(11).fillColor(C.textDim).font('Body')
     .text('/5', gx + 10, gy - 10, { lineBreak: false });
  doc.fontSize(8.5).fillColor(color).font('Body-Bold')
     .text('Maturidade ' + scoreLabel(score), gx - 60, gy + gaugeR + 10, { width: 120, align: 'center', lineBreak: false });

  // Bloco de readiness (lado direito do score)
  if (readinessLevel) {
    const rx = cx + 30;
    const ry = H / 2 - 20;
    doc.rect(rx, ry - 40, 180, 80).fill(verdictColor + '0D');
    doc.roundedRect(rx, ry - 40, 180, 80, 8).lineWidth(1).strokeColor(verdictColor + '40').stroke();
    doc.fontSize(7.5).fillColor(verdictColor).font('Body-Bold')
       .text('COPILOT READINESS', rx + 12, ry - 30, { lineBreak: false, characterSpacing: 0.5 });
    doc.fontSize(11).fillColor(verdictColor).font('Body-Bold')
       .text(readinessLevel, rx + 12, ry - 14, { width: 156, lineBreak: false });
    const verdict = copilotReady ? 'Pronto para deployment' : 'Requer remediacoes';
    doc.fontSize(8).fillColor(C.textDim).font('Body')
       .text(verdict, rx + 12, ry + 10, { lineBreak: false });
    if (copilotReady) drawCheck(doc, rx + 12, ry + 28, 16, verdictColor);
    else              drawCross(doc, rx + 12, ry + 28, 16, verdictColor);
  }

  hLine(doc, H / 2 + gaugeR + 36, { color: C.border });

  // Dados do documento
  const infoY = H / 2 + gaugeR + 52;
  const preparedBy = result.preparedBy || 'BB Assessment Platform';
  const assessedAt = result.assessedAt ? fmtDateShort(result.assessedAt) : '-';

  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text('Preparado por', 48, infoY, { lineBreak: false });
  doc.fontSize(9).fillColor(C.textH).font('Body-Bold')
     .text(preparedBy, 48, infoY + 14, { lineBreak: false });

  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text('Data do Assessment', W / 2 + 10, infoY, { lineBreak: false });
  doc.fontSize(9).fillColor(C.textH).font('Body-Bold')
     .text(assessedAt, W / 2 + 10, infoY + 14, { lineBreak: false });

  // Rodape
  doc.rect(0, H - 36, W, 36).fill(C.accent);
  doc.fontSize(7.5).fillColor('#ffffff').font('Body')
     .text('Confidencial — Uso Interno e Pre-Venda', 0, H - 21, { align: 'center', width: W, lineBreak: false });
}

// ── Página 2: Sumário ─────────────────────────────────────────────────────────
function buildTableOfContents(doc, result) {
  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Indice', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Sumario', 48, y);
  y += 36;
  hLine(doc, y);
  y += 24;

  const ia = result.domains?.iaReadiness;
  const recs = result.recommendations?.items || [];

  // Entradas do sumario
  const tocEntries = [
    { num: '1', title: 'Veredicto Executivo', page: 3 },
    { num: '2', title: 'Score por Dominio', page: 4 },
    { num: '3', title: 'Radar de Maturidade', page: 5 },
    { num: '4', title: 'Copilot Readiness', page: 6 },
    { num: '5', title: 'Roadmap de Remediacao', page: 7 },
    { num: '6', title: 'Analise de Risco', page: 8 },
    { num: '7', title: 'Mapeamento de Compliance', page: 9 },
    { num: '8', title: 'Recomendacoes Detalhadas', page: 10 },
    { num: '9', title: 'Metodologia e Assinaturas', page: '-' },
  ];

  for (const entry of tocEntries) {
    const numW = 22;
    // Numero
    doc.circle(48 + numW / 2, y + 8, 9).fill(C.accent);
    doc.fontSize(8).fillColor(C.white).font('Body-Bold')
       .text(entry.num, 48, y + 4, { width: numW, align: 'center', lineBreak: false });

    // Titulo
    doc.fontSize(10).fillColor(C.textH).font('Body-Bold')
       .text(entry.title, 48 + numW + 12, y + 2, { lineBreak: false });

    // Linha pontilhada
    const titleW = doc.widthOfString(entry.title);
    const dotStart = 48 + numW + 12 + titleW + 8;
    const dotEnd = W - 90;
    if (dotEnd > dotStart) {
      doc.moveTo(dotStart, y + 8).lineTo(dotEnd, y + 8)
         .lineWidth(0.5).dash(1, { space: 4 }).strokeColor(C.border).stroke();
      doc.undash();
    }

    // Numero de pagina
    doc.fontSize(10).fillColor(C.textDim).font('Body')
       .text(String(entry.page), W - 80, y + 2, { width: 32, align: 'right', lineBreak: false });

    y += 28;
  }

  y += 16;
  hLine(doc, y);
  y += 20;

  // Metadados rapidos
  const passed = ia?.summary?.passedCount ?? 0;
  const total = ia?.summary?.totalChecks ?? 0;
  const critBlk = ia?.summary?.criticalBlockers ?? 0;
  const boxes = [
    { label: 'Dominios avaliados', value: String(Object.keys(result.domains || {}).length) },
    { label: 'Score geral', value: result.overallScore != null ? result.overallScore.toFixed(1) + '/5' : '-' },
    { label: 'Requisitos Copilot', value: `${passed}/${total}` },
    { label: 'Bloqueadores criticos', value: String(critBlk) },
    { label: 'Recomendacoes', value: String(recs.length) },
  ];
  const bw = (W - 96 - 40) / 5;
  let bx = 48;
  for (const b of boxes) {
    doc.rect(bx, y, bw, 52).fill(C.bg2);
    doc.roundedRect(bx, y, bw, 52, 4).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fontSize(16).fillColor(C.accent).font('Body-Bold')
       .text(b.value, bx + 4, y + 10, { width: bw - 8, align: 'center', lineBreak: false });
    doc.fontSize(7).fillColor(C.textDim).font('Body')
       .text(b.label, bx + 4, y + 35, { width: bw - 8, align: 'center', lineBreak: false });
    bx += bw + 10;
  }
}

// ── Página 3: Veredicto Executivo ─────────────────────────────────────────────
function buildVerdict(doc, result) {
  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  const ia             = result.domains?.iaReadiness;
  const copilotReady   = ia?.copilotReady ?? false;
  const level          = ia?.readinessLevel ?? '-';
  const score          = result.overallScore;
  const passed         = ia?.summary?.passedCount ?? 0;
  const total          = ia?.summary?.totalChecks ?? 0;
  const criticalBlk    = ia?.summary?.criticalBlockers ?? 0;
  const recs           = result.recommendations?.items || [];
  const tenantName     = result.tenantName || result.tenantId;

  const verdictColor = copilotReady ? C.green
    : (level.includes('Parcial') || level.includes('Moderada')) ? C.amber
    : C.red;

  y = pageKicker(doc, 'Veredicto Executivo', y);

  // Nivel de prontidao em destaque
  doc.fontSize(26).fillColor(verdictColor).font('Body-Bold')
     .text(level, 48, y, { lineBreak: false });
  y += 42;
  hLine(doc, y);
  y += 20;

  // Paragrafos narrativos
  let p1, p2, p3;
  if (copilotReady) {
    p1 = `O ambiente Microsoft 365 de ${tenantName} atende os pre-requisitos tecnicos para o deployment do Copilot for Microsoft 365. Os controles essenciais de protecao de identidade, seguranca de dados e governanca estao em vigor, e o risco de exposicao inadvertida de informacoes confidenciais via IA e classificado como baixo.`;
    p2 = `A organizacao esta em posicao favoravel para iniciar o rollout do Copilot, priorizando grupos com perfis de dados bem delimitados. Recomenda-se um piloto inicial com 50-100 usuarios de diferentes areas antes da expansao geral, com monitoramento ativo nos primeiros 30 dias de uso.`;
    p3 = `As recomendacoes identificadas neste assessment sao de carater evolutivo - nao bloqueiam o inicio do projeto mas, quando implementadas, elevarao ainda mais a maturidade e o valor gerado pela IA.`;
  } else if (level.includes('Moderada')) {
    p1 = `O ambiente Microsoft 365 de ${tenantName} apresenta maturidade moderada em seguranca e governanca de dados. O Copilot for Microsoft 365 pode ser implantado de forma controlada em grupos piloto, mas existem riscos que precisam ser resolvidos para garantir que a IA nao exponha informacoes confidenciais de forma inadvertida.`;
    p2 = `Recomenda-se um piloto limitado e monitorado enquanto os itens de risco sao enderecados pelas equipes de TI. A expansao do Copilot para toda a organizacao deve aguardar a conclusao das acoes prioritarias de curto prazo descritas neste relatorio.`;
    p3 = `Com foco nas acoes de Fase 1 e 2 do roadmap, estima-se que o ambiente estara preparado para rollout amplo em 60 a 90 dias.`;
  } else if (level.includes('Parcial')) {
    p1 = `O ambiente Microsoft 365 de ${tenantName} apresenta lacunas relevantes nos controles de seguranca e governanca de dados. A implantacao do Copilot for Microsoft 365 no estado atual representa um risco real: a IA pode acessar e compartilhar com qualquer usuario informacoes que nao foram intencionalmente expostas de forma ampla.`;
    p2 = `Nao e recomendado iniciar o rollout do Copilot antes de resolver os bloqueadores identificados. O principal risco e que a IA amplifique permissoes excessivas ja existentes - conteudo que estava disponivel mas ignorado passa a ser descoberto e citado nas respostas para qualquer colaborador.`;
    p3 = `Seguindo o roadmap de remediacao deste relatorio, estima-se que o ambiente pode estar em condicoes adequadas para um piloto controlado em 60 a 90 dias, e para rollout geral em 90 a 120 dias.`;
  } else {
    p1 = `O ambiente Microsoft 365 de ${tenantName} NAO esta em condicoes de receber o Copilot for Microsoft 365 com seguranca. Foram identificados ${criticalBlk} bloqueador${criticalBlk !== 1 ? 'es' : ''} critico${criticalBlk !== 1 ? 's' : ''} que, se ignorados, podem resultar em exposicao de dados sensiveis, violacoes de privacidade e riscos de conformidade regulatoria.`;
    p2 = `O deployment do Copilot deve ser suspenso ou mantido em espera ate a resolucao dos itens criticos. A IA, sem os controles de governanca adequados, atua como um amplificador de permissoes existentes - tornando acessivel a qualquer usuario conteudo que deveria ser restrito.`;
    p3 = `Este relatorio apresenta um plano de remediacao em fases. Seguido com comprometimento das liderancas de TI e do negocio, o ambiente pode estar pronto para um piloto seguro do Copilot em 90 a 120 dias.`;
  }

  for (const para of [p1, p2, p3]) {
    doc.fontSize(10).fillColor(C.text).font('Body')
       .text(para, 48, y, { width: W - 96, lineBreak: true, align: 'justify' });
    y += doc.heightOfString(para, { width: W - 96 }) + 14;
  }

  y += 6;
  hLine(doc, y);
  y += 22;

  // Metricas executivas
  const metrics = [
    { label: 'Score Geral',              value: score != null ? score.toFixed(1) + '/5' : '-', color: scoreColor(score) },
    { label: 'Requisitos Atendidos',     value: `${passed} / ${total}`,                       color: passed === total ? C.green : C.amber },
    { label: 'Bloqueadores Criticos',    value: String(criticalBlk),                          color: criticalBlk === 0 ? C.green : C.red },
    { label: 'Total Recomendacoes',      value: String(recs.length),                          color: C.blue },
  ];

  const boxW = (W - 96 - 36) / 4;
  let bx = 48;
  for (const m of metrics) {
    doc.rect(bx, y, boxW, 60).fill(C.bg2);
    doc.roundedRect(bx, y, boxW, 60, 4).lineWidth(0.5).strokeColor(m.color + '60').stroke();
    doc.rect(bx, y, 3, 60).fill(m.color);
    doc.fontSize(22).fillColor(m.color).font('Body-Bold')
       .text(m.value, bx + 10, y + 12, { width: boxW - 18, align: 'center', lineBreak: false });
    doc.fontSize(7.5).fillColor(C.textDim).font('Body')
       .text(m.label, bx + 10, y + 43, { width: boxW - 18, align: 'center', lineBreak: false });
    bx += boxW + 12;
  }
  y += 78;

  // Principais bloqueadores
  const blockers = ia?.blockers || [];
  if (!copilotReady && blockers.length > 0) {
    doc.fontSize(9).fillColor(C.textH).font('Body-Bold')
       .text('Principais bloqueadores para o Copilot:', 48, y);
    y += 18;

    for (const b of blockers.slice(0, 4)) {
      if (y > doc.page.height - 70) break;
      const bColor = b.impact === 'critical' ? C.red : C.amber;
      const startY = y;

      doc.rect(48, startY, 4, 0).fill(bColor);
      doc.rect(48, startY, W - 96, 1).fill(C.border);

      doc.fontSize(8.5).fillColor(C.textH).font('Body-Bold')
         .text(b.label, 62, y + 4, { width: W - 118, lineBreak: false });
      y += 16;
      if (b.detail) {
        doc.fontSize(8).fillColor(C.textDim).font('Body')
           .text(b.detail, 62, y, { width: W - 118, lineBreak: true });
        y += doc.heightOfString(b.detail, { width: W - 118 }) + 4;
      }
      doc.rect(48, startY, 4, y - startY).fill(bColor);
      y += 10;
    }
  }
}

// ── Página 4: Scores por dominio ──────────────────────────────────────────────
function buildScorePage(doc, result) {
  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Visao por Dominio', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Score por Dominio', 48, y);
  y += 36;

  // Legenda
  const legends = [
    { color: C.green, label: 'Bom (>= 3.5)' },
    { color: C.amber, label: 'Atencao (2.5-3.5)' },
    { color: C.red,   label: 'Critico (< 2.5)' },
  ];
  let lx = 48;
  for (const l of legends) {
    doc.circle(lx + 5, y + 5, 5).fill(l.color);
    doc.fontSize(7.5).fillColor(C.textDim).font('Body')
       .text(l.label, lx + 14, y + 1, { lineBreak: false });
    lx += doc.widthOfString(l.label) + 30;
  }
  y += 22;
  hLine(doc, y);
  y += 16;

  // Cabecalho
  doc.fontSize(7.5).fillColor(C.textDim).font('Body-Bold')
     .text('DOMINIO', 88, y, { lineBreak: false });
  doc.text('STATUS', W - 260, y, { lineBreak: false });
  doc.text('SCORE', W - 180, y, { lineBreak: false });
  doc.text('BARRA', W - 128, y, { lineBreak: false });
  y += 16;

  const domains = result.domains || {};

  for (const [key, label] of Object.entries(DOMAIN_LABELS)) {
    const d     = domains[key];
    const score = d?.domainScore;
    const tColor = trafficColor(score);
    const barW  = 88;
    const rowH  = 38;

    // Alternancia de fundo
    const rowBg = (Object.keys(DOMAIN_LABELS).indexOf(key) % 2 === 0) ? C.bg2 : C.bg;
    doc.rect(48, y - 6, W - 96, rowH).fill(rowBg);
    doc.moveTo(48, y - 6).lineTo(W - 48, y - 6).lineWidth(0.5).strokeColor(C.border).stroke();

    doc.circle(66, y + 10, 7).fill(tColor);
    doc.fontSize(9).fillColor(C.textH).font('Body-Bold')
       .text(label, 84, y + 5, { lineBreak: false });

    if (!d || d.error) {
      doc.fontSize(8).fillColor(C.textDim).font('Body')
         .text('Indisponivel', W - 260, y + 6, { lineBreak: false });
    } else {
      doc.fontSize(8).fillColor(tColor).font('Body-Bold')
         .text(trafficLabel(score), W - 260, y + 6, { lineBreak: false });
      doc.fontSize(14).fillColor(scoreColor(score)).font('Body-Bold')
         .text(score != null ? score.toFixed(1) : '-', W - 180, y + 1, { lineBreak: false });
      doc.fontSize(8).fillColor(C.textDim).font('Body')
         .text('/5', W - 158, y + 6, { lineBreak: false });
      scoreBar(doc, W - 128, y + 10, barW, 8, score);
    }

    y += rowH + 2;
  }

  // Total geral
  y += 4;
  hLine(doc, y);
  y += 16;
  doc.rect(48, y - 4, W - 96, 40).fill(C.bg3);
  doc.circle(66, y + 14, 7).fill(trafficColor(result.overallScore));
  doc.fontSize(10).fillColor(C.textH).font('Body-Bold')
     .text('Score Consolidado', 84, y + 9, { lineBreak: false });
  doc.fontSize(18).fillColor(scoreColor(result.overallScore)).font('Body-Bold')
     .text(result.overallScore != null ? result.overallScore.toFixed(1) : '-', W - 180, y + 5, { lineBreak: false });
  doc.fontSize(9).fillColor(C.textDim).font('Body')
     .text('/5', W - 156, y + 11, { lineBreak: false });
  y += 56;

  doc.fontSize(7.5).fillColor(C.textDim).font('Body')
     .text('Escala 0-5 por dominio. Score consolidado = media ponderada dos dominios. Cada dominio agrega coletores que consultam a Microsoft Graph API do tenant avaliado.', 48, y, { width: W - 96 });
}

// ── Página 5: Radar de Maturidade ─────────────────────────────────────────────
function buildRadarChart(doc, result) {
  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Radar de Maturidade', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Radar de Maturidade por Dominio', 48, y);
  y += 10;
  doc.fontSize(9).fillColor(C.textDim).font('Body')
     .text('Visao consolidada dos 6 eixos de seguranca avaliados. Area azul = postura atual. Area cinza = postura maxima (score 5.0).', 48, y + 20, { width: W - 96 });
  y += 46;

  const axes = ['Identidade', 'SharePoint', 'Governanca', 'Email Security', 'Fundamentos', 'IA Readiness'];
  const domainKeys = ['entraId', 'sharePoint', 'governance', 'emailSecurity', 'baseline', 'iaReadiness'];
  const cx = W / 2;
  const cy = y + 160;
  const r = 110;
  const step = (Math.PI * 2) / 6;

  // Fundo hexagonal maximo (area cinza)
  const maxPts = Array.from({ length: 6 }, (_, i) => {
    const a = i * step - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  doc.polygon(...maxPts).fillColor(C.bg3).fill();
  doc.polygon(...maxPts).lineWidth(1).strokeColor(C.border).stroke();

  // Aneis de referencia
  [1/3, 2/3].forEach(ring => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = i * step - Math.PI / 2;
      return [cx + Math.cos(a) * r * ring, cy + Math.sin(a) * r * ring];
    });
    doc.polygon(...pts).lineWidth(0.5).dash(3, { space: 3 }).strokeColor(C.border).stroke();
    doc.undash();
    const score = (ring * 5).toFixed(1);
    const labelX = cx + Math.cos(0 - Math.PI / 2) * r * ring + 4;
    const labelY = cy + Math.sin(0 - Math.PI / 2) * r * ring - 4;
    doc.fontSize(6).fillColor(C.textDim).font('Body').text(score, labelX, labelY, { lineBreak: false });
  });

  // Linhas dos eixos
  Array.from({ length: 6 }, (_, i) => {
    const a = i * step - Math.PI / 2;
    doc.moveTo(cx, cy).lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
       .lineWidth(0.5).strokeColor(C.border).stroke();
  });

  // Labels dos eixos
  axes.forEach((label, i) => {
    const a = i * step - Math.PI / 2;
    const lx = cx + Math.cos(a) * (r + 22);
    const ly = cy + Math.sin(a) * (r + 22);
    doc.fontSize(8).fillColor(C.textH).font('Body-Bold')
       .text(label, lx - 32, ly - 6, { width: 64, align: 'center', lineBreak: false });
  });

  // Area de dados (scores reais)
  const scores = domainKeys.map(k => {
    const s = result.domains?.[k]?.domainScore;
    return s != null ? Math.min(s, 5) / 5 : 0;
  });
  const dataPts = scores.map((s, i) => {
    const a = i * step - Math.PI / 2;
    return [cx + Math.cos(a) * r * s, cy + Math.sin(a) * r * s];
  });
  doc.polygon(...dataPts).fillColor(C.blue + '28').fill();
  doc.polygon(...dataPts).lineWidth(2).strokeColor(C.blue).stroke();

  // Dots com score
  dataPts.forEach(([px, py], i) => {
    doc.circle(px, py, 4).fill(C.blue);
    const sc = (scores[i] * 5).toFixed(1);
    doc.fontSize(7).fillColor(C.white).font('Body-Bold')
       .text(sc, px - 8, py + cy + 200, { lineBreak: false }); // invisible placeholder
  });

  y = cy + r + 30;

  // Legenda abaixo
  hLine(doc, y, { x: 100, width: W - 200 });
  y += 12;
  doc.circle(W / 2 - 60, y + 5, 6).fill(C.blue + '28');
  doc.circle(W / 2 - 60, y + 5, 3).fill(C.blue);
  doc.fontSize(7.5).fillColor(C.textDim).font('Body')
     .text('Postura atual do tenant', W / 2 - 48, y + 1, { lineBreak: false });
  doc.rect(W / 2 + 40, y, 12, 12).fill(C.bg3);
  doc.rect(W / 2 + 40, y, 12, 12).lineWidth(0.5).strokeColor(C.border).stroke();
  doc.fontSize(7.5).fillColor(C.textDim).font('Body')
     .text('Score maximo (5.0)', W / 2 + 56, y + 1, { lineBreak: false });
}

// ── Página 6: Checklist Copilot Readiness ─────────────────────────────────────
function buildIAReadiness(doc, result) {
  const ia = result.domains?.iaReadiness;
  if (!ia) return;

  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Copilot Readiness', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Checklist de Pre-Requisitos do Copilot', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  const score = ia.domainScore;
  const color = scoreColor(score);
  doc.fontSize(30).fillColor(color).font('Body-Bold')
     .text(score != null ? score.toFixed(1) : '-', 48, y, { lineBreak: false });
  doc.fontSize(10).fillColor(C.textDim).font('Body')
     .text('/5', 92, y + 14, { lineBreak: false });
  if (ia.readinessLevel) {
    doc.fontSize(14).fillColor(color).font('Body-Bold')
       .text(ia.readinessLevel, 112, y + 11, { lineBreak: false });
  }
  const passed = ia.summary?.passedCount ?? 0;
  const total  = ia.checks?.length ?? 0;
  doc.fontSize(9).fillColor(C.textDim).font('Body')
     .text(`${passed} de ${total} pre-requisitos atendidos`, 112, y + 30, { lineBreak: false });
  y += 54;

  const critBlk    = ia.summary?.criticalBlockers ?? 0;
  const bannerColor = critBlk > 0 ? C.red : ia.copilotReady ? C.green : C.amber;
  const bannerMsg   = critBlk > 0
    ? `${critBlk} bloqueador${critBlk > 1 ? 'es' : ''} critico${critBlk > 1 ? 's' : ''} — deployment do Copilot nao recomendado`
    : ia.copilotReady
      ? 'Nenhum bloqueador critico — ambiente pronto para Copilot'
      : 'Sem bloqueadores criticos, mas existem riscos altos a enderacar';

  doc.rect(48, y, W - 96, 30).fill(bannerColor + '12');
  doc.roundedRect(48, y, W - 96, 30, 4).lineWidth(0.5).strokeColor(bannerColor + '60').stroke();
  doc.rect(48, y, 4, 30).fill(bannerColor);
  doc.fontSize(9).fillColor(bannerColor).font('Body-Bold')
     .text(bannerMsg, 62, y + 10, { lineBreak: false });
  y += 44;

  const checks = ia.checks || [];
  if (!checks.length) return;

  const critical = checks.filter(c => c.impact === 'critical' || c.impact === 'high');
  const medium   = checks.filter(c => c.impact === 'medium');

  for (const group of [
    { title: 'Pre-Requisitos Criticos e Altos', items: critical },
    { title: 'Praticas Recomendadas', items: medium },
  ]) {
    if (!group.items.length) continue;
    if (y > doc.page.height - 100) { doc.addPage(); y = 52; }
    y = sectionHeader(doc, group.title, y);

    for (const check of group.items) {
      if (y > doc.page.height - 70) { doc.addPage(); y = 52; }

      const iColor = check.passed ? C.green : (check.impact === 'critical' ? C.red : C.amber);

      doc.roundedRect(48, y, 18, 18, 3).fill(check.passed ? C.green + '18' : iColor + '15');
      doc.roundedRect(48, y, 18, 18, 3).lineWidth(0.5).strokeColor(iColor + '60').stroke();
      if (check.passed) drawCheck(doc, 48, y, 18, iColor);
      else              drawCross(doc, 48, y, 18, iColor);

      doc.fontSize(9).fillColor(C.textH).font('Body-Bold')
         .text(check.label || check.id, 76, y + 4, { width: W - 180, lineBreak: false });

      const impactTxt = check.impact === 'critical' ? 'CRITICO'
        : check.impact === 'high' ? 'ALTO' : 'MEDIO';
      doc.fontSize(7).fillColor(iColor).font('Body-Bold')
         .text(impactTxt, W - 96, y + 5, { lineBreak: false });
      doc.fontSize(6.5).fillColor(C.textDim).font('Body')
         .text(`peso ${check.weight}`, W - 96, y + 16, { lineBreak: false });

      y += 22;

      if (check.detail) {
        doc.fontSize(8).fillColor(C.textDim).font('Body')
           .text(check.detail, 76, y, { width: W - 144, lineBreak: true });
        y += doc.heightOfString(check.detail, { width: W - 144 }) + 6;
      } else {
        y += 4;
      }

      hLine(doc, y, { x: 76, width: W - 124 });
      y += 10;
    }
    y += 8;
  }
}

// ── Página 7: Roadmap de Remediação ──────────────────────────────────────────
function buildRoadmap(doc, recommendations) {
  const items = recommendations?.items || [];
  if (!items.length) return;

  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Plano de Remediacao', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Roadmap em 3 Fases', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  const phases = [
    {
      num: '1', title: 'Acao Imediata', timeline: '0 - 30 dias', color: C.red,
      description: 'Bloqueadores que impedem o rollout seguro do Copilot. Devem ser resolvidos antes de qualquer piloto de IA.',
      items: items.filter(r => r.severity === 'critical'),
    },
    {
      num: '2', title: 'Curto Prazo', timeline: '30 - 90 dias', color: C.amber,
      description: 'Riscos altos que reduzem a qualidade e a seguranca do Copilot. Resolver antes de expandir para toda a organizacao.',
      items: items.filter(r => r.severity === 'high'),
    },
    {
      num: '3', title: 'Medio Prazo', timeline: '90 - 180 dias', color: C.blue,
      description: 'Melhorias de maturidade que potencializam o valor do Copilot e reforcam a postura de seguranca no longo prazo.',
      items: items.filter(r => r.severity === 'medium' || r.severity === 'low'),
    },
  ];

  const effortPt = { low: 'Esforco baixo', medium: 'Esforco medio', high: 'Esforco alto' };

  for (const phase of phases) {
    if (y > doc.page.height - 130) { doc.addPage(); y = 52; }

    const headerH = 44;
    doc.rect(48, y, W - 96, headerH).fill(phase.color + '0F');
    doc.roundedRect(48, y, W - 96, headerH, 4).lineWidth(0.5).strokeColor(phase.color + '40').stroke();
    doc.rect(48, y, 4, headerH).fill(phase.color);

    doc.fontSize(7.5).fillColor(phase.color).font('Body-Bold')
       .text(`FASE ${phase.num}  -  ${phase.timeline}`, 62, y + 8, { lineBreak: false, characterSpacing: 0.4 });
    doc.fontSize(13).fillColor(C.textH).font('Body-Bold')
       .text(phase.title, 62, y + 22, { lineBreak: false });

    const countTxt = `${phase.items.length} ${phase.items.length !== 1 ? 'acoes' : 'acao'}`;
    const cw = doc.widthOfString(countTxt) + 20;
    doc.roundedRect(W - 48 - cw, y + 13, cw, 18, 9).fill(phase.color + '20');
    doc.fontSize(8).fillColor(phase.color).font('Body-Bold')
       .text(countTxt, W - 48 - cw + 10, y + 18, { lineBreak: false });

    y += headerH + 12;

    doc.fontSize(8.5).fillColor(C.textDim).font('Body')
       .text(phase.description, 56, y, { width: W - 104 });
    y += doc.heightOfString(phase.description, { width: W - 104 }) + 10;

    if (!phase.items.length) {
      doc.fontSize(8).fillColor(C.textDim).font('Body')
         .text('Nenhuma acao nesta fase.', 56, y, { lineBreak: false });
      y += 16;
    }

    const shown = phase.items.slice(0, 6);
    for (const item of shown) {
      if (y > doc.page.height - 60) break;
      doc.circle(58, y + 5, 3).fill(phase.color);
      doc.fontSize(8.5).fillColor(C.textH).font('Body-Bold')
         .text(item.finding || item.id, 68, y, { width: W - 188, lineBreak: true });
      const itemH = doc.heightOfString(item.finding || item.id, { width: W - 188 });
      if (item.effort) {
        doc.fontSize(7).fillColor(C.textDim).font('Body')
           .text(effortPt[item.effort] || item.effort, W - 120, y + 2, { lineBreak: false });
      }
      doc.fontSize(7).fillColor(phase.color).font('Body-Bold')
         .text(item.category || '', W - 60, y + 2, { lineBreak: false });
      y += Math.max(itemH, 14) + 6;
    }

    if (phase.items.length > 6) {
      doc.fontSize(7.5).fillColor(C.textDim).font('Body')
         .text(`... e mais ${phase.items.length - 6} acoes nesta fase - ver secao Recomendacoes Detalhadas.`, 68, y, { lineBreak: false });
      y += 14;
    }

    y += 20;
  }
}

// ── Página 8: Risco se não agir ───────────────────────────────────────────────
function buildRiskSection(doc, result) {
  const recs = result.recommendations?.items || [];
  const riskyItems = recs.filter(r => r.severity === 'critical' || r.severity === 'high').slice(0, 6);
  if (!riskyItems.length) return;

  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  const RISK_SCENARIOS = {
    SHARING_ANONYMOUS_LINKS:     'Um colaborador pergunta ao Copilot pela estrategia de produto e recebe trechos de um documento compartilhado publicamente que nunca foi pensado para aquele publico.',
    SHARING_EXTERNAL_HIGH:       'Links de compartilhamento externo permanecem ativos indefinidamente. O Copilot indexa esse conteudo e pode entrega-lo a qualquer usuario do tenant que fizer a pergunta certa.',
    OVERSHARING_EVERYONE:        'Documentos de RH, financeiro ou projetos estrategicos com permissao "para todos" tornam-se fontes do Copilot. Qualquer colaborador acessa esse conteudo via IA sem autorizacao explicita.',
    MFA_LOW_COVERAGE:            'Uma conta sem MFA comprometida por phishing da ao invasor acesso ao Copilot com as permissoes do usuario. Ele pode resumir contratos e extrair dados sem disparar alertas tradicionais.',
    CA_NO_POLICIES:              'O Copilot pode ser acessado de dispositivos pessoais, redes publicas ou paises de alto risco, sem nenhum controle sobre o contexto de acesso.',
    CA_NO_MFA_POLICY:            'Politicas de acesso existem mas nao exigem segundo fator. Uma senha roubada e suficiente para acessar o Copilot com acesso a todos os dados do tenant.',
    GOV_NO_SENSITIVITY_LABELS:   'Sem classificacao de dados, o Copilot nao distingue um documento publico de um contrato NDA. A IA pode incluir clausulas confidenciais num resumo compartilhado em reuniao.',
    DLP_NO_COPILOT_POLICY:       'Um usuario pede ao Copilot para resumir documentos com CPF, dados de cartao ou prontuarios medicos. A IA entrega esses dados na resposta sem nenhum bloqueio.',
    PRIVILEGED_NO_PIM:           'Um Global Administrator comprometido tem acesso irrestrito ao Copilot 24/7 com o maior nivel de privilegio possivel.',
    INACTIVE_ENABLED_USERS:      'Contas de ex-funcionarios ainda ativas com acesso ao Copilot sao alvos de ataques de credential stuffing. Se comprometidas, o invasor herda permissoes acumuladas e acesso a IA.',
    RETENTION_NO_EXCHANGE:       'E-mails relevantes sao deletados antes de investigacoes internas ou auditorias regulatorias. Quando o regulador solicitar, as evidencias nao existirao mais.',
    APPS_LOW_DESKTOP_DEPLOYMENT: 'A organizacao investe em licencas do Copilot mas parcela dos usuarios nao consegue usa-lo. O botao do Copilot nao aparece em versoes desatualizadas do Office.',
    PRIVILEGED_EXCESS_GA:        'Com muitos Global Administrators permanentes, a superficie de ataque e maior. Cada conta e um vetor potencial de acesso irrestrito ao Copilot.',
    PRIVILEGED_GUEST_ADMIN:      'Contas externas com papel administrativo tem acesso privilegiado ao Copilot. Um convidado comprometido tem poder maximo sobre os dados da organizacao via IA.',
  };

  y = pageKicker(doc, 'Analise de Risco', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('O que acontece se nao agir', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  const intro = 'Cada lacuna de governanca identificada neste assessment tem um cenario de risco concreto quando o Copilot for Microsoft 365 estiver ativo. Os principais riscos e seu impacto potencial para o negocio.';
  doc.fontSize(10).fillColor(C.text).font('Body')
     .text(intro, 48, y, { width: W - 96, align: 'justify' });
  y += doc.heightOfString(intro, { width: W - 96 }) + 22;

  for (const rec of riskyItems) {
    if (y > doc.page.height - 100) { doc.addPage(); y = 52; }

    const sevColor = rec.severity === 'critical' ? C.red : C.amber;
    const scenario = RISK_SCENARIOS[rec.id] ?? rec.recommendation;
    const startY   = y;

    doc.rect(48, startY, 4, 0).fill(sevColor);
    doc.rect(48, startY, W - 96, 1).fill(C.bg3);

    const findingTxt = rec.finding || rec.id;
    doc.fontSize(9).fillColor(C.textH).font('Body-Bold')
       .text(findingTxt, 62, y + 4, { width: W - 120, lineBreak: true });
    y += doc.heightOfString(findingTxt, { width: W - 120 }) + 8;

    doc.fontSize(8.5).fillColor(C.textDim).font('Body')
       .text('Cenario: ' + scenario, 62, y, { width: W - 120, lineBreak: true });
    y += doc.heightOfString('Cenario: ' + scenario, { width: W - 120 }) + 8;

    const sevLabel = rec.severity === 'critical' ? 'CRITICO' : 'RISCO ALTO';
    doc.circle(65, y + 4, 3).fill(sevColor);
    doc.fontSize(7).fillColor(sevColor).font('Body-Bold')
       .text(sevLabel, 72, y, { lineBreak: false });
    if (rec.category) {
      doc.fontSize(7).fillColor(C.textDim).font('Body')
         .text('  -  ' + rec.category, 72 + doc.widthOfString(sevLabel) + 2, y, { lineBreak: false });
    }
    y += 14;

    doc.rect(48, startY, 4, y - startY).fill(sevColor);
    hLine(doc, y);
    y += 14;
  }
}

// ── Página 9: Mapeamento de Compliance ───────────────────────────────────────
function buildComplianceMapping(doc, result) {
  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Conformidade Regulatoria', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Mapeamento de Compliance', 48, y);
  y += 10;
  doc.fontSize(9).fillColor(C.textDim).font('Body')
     .text('Correlacao entre os controles avaliados e os principais frameworks regulatorios e de seguranca aplicaveis ao contexto brasileiro e internacional.', 48, y + 20, { width: W - 96 });
  y += 46;
  hLine(doc, y);
  y += 16;

  // Funcao auxiliar para obter status de um dominio
  function domainStatus(key) {
    const s = result.domains?.[key]?.domainScore;
    if (s == null) return { color: C.textDim, label: 'N/A' };
    if (s >= 3.5)  return { color: C.green,   label: 'Conforme' };
    if (s >= 2.5)  return { color: C.amber,   label: 'Parcial' };
    return           { color: C.red,    label: 'Lacuna' };
  }

  function collectorStatus(domainKey, collectorKey) {
    const c = result.domains?.[domainKey]?.collectors?.[collectorKey];
    if (!c || c.unavailable) return { color: C.textDim, label: 'N/A' };
    if (c.score >= 3.5) return { color: C.green, label: 'Conforme' };
    if (c.score >= 2.5) return { color: C.amber, label: 'Parcial' };
    return { color: C.red, label: 'Lacuna' };
  }

  const entraStatus  = domainStatus('entraId');
  const govStatus    = domainStatus('governance');
  const emailStatus  = domainStatus('emailSecurity');
  const mfaStatus    = collectorStatus('entraId', 'mfa');
  const caStatus     = collectorStatus('entraId', 'conditionalAccess');
  const auditStatus  = collectorStatus('governance', 'audit');
  const dlpStatus    = collectorStatus('governance', 'dlp');
  const labelStatus  = collectorStatus('governance', 'sensitivityLabels');
  const privStatus   = collectorStatus('entraId', 'privileged');

  const rows = [
    { framework: 'LGPD Art. 46', control: 'Medidas tecnicas de seguranca dos dados pessoais',      status: entraStatus },
    { framework: 'LGPD Art. 48', control: 'Capacidade de comunicacao de incidentes de seguranca',  status: auditStatus },
    { framework: 'ISO 27001 A.9.4', control: 'Controle de acesso a sistema e aplicacoes',           status: mfaStatus },
    { framework: 'ISO 27001 A.9.2', control: 'Gestao de acesso de usuarios e privilegios',          status: privStatus },
    { framework: 'ISO 27001 A.12.4', control: 'Registro e monitoramento de eventos (log)',          status: auditStatus },
    { framework: 'ISO 27001 A.13.2', control: 'Transferencia de informacoes e DLP',                 status: dlpStatus },
    { framework: 'NIST CSF PR.AC', control: 'Gestao de identidade e controle de acesso',           status: caStatus },
    { framework: 'NIST CSF PR.DS', control: 'Protecao de dados em repouso e em transito',          status: labelStatus },
    { framework: 'NIST CSF DE.CM', control: 'Monitoramento continuo da seguranca',                 status: auditStatus },
    { framework: 'CIS Control 5', control: 'Gestao de contas — break-glass e ciclo de vida',       status: privStatus },
    { framework: 'CIS Control 6', control: 'Gestao de acesso privilegiado — PIM e MFA para admins', status: privStatus },
    { framework: 'CIS Control 9', control: 'Protecao de email — SPF/DKIM/DMARC',                  status: emailStatus },
    { framework: 'CIS Control 3', control: 'Protecao e classificacao de dados',                   status: labelStatus },
  ];

  // Cabecalho da tabela
  doc.rect(48, y, W - 96, 22).fill(C.accent);
  doc.fontSize(8).fillColor(C.white).font('Body-Bold')
     .text('Framework', 56, y + 7, { lineBreak: false });
  doc.text('Controle / Requisito', 180, y + 7, { lineBreak: false });
  doc.text('Status', W - 110, y + 7, { lineBreak: false });
  y += 22;

  rows.forEach((row, i) => {
    const rowH = 26;
    const rowBg = i % 2 === 0 ? C.bg : C.bg2;
    doc.rect(48, y, W - 96, rowH).fill(rowBg);
    doc.moveTo(48, y + rowH).lineTo(W - 48, y + rowH).lineWidth(0.3).strokeColor(C.border).stroke();

    doc.fontSize(7.5).fillColor(C.accent).font('Body-Bold')
       .text(row.framework, 56, y + 9, { lineBreak: false });
    doc.fontSize(7.5).fillColor(C.text).font('Body')
       .text(row.control, 180, y + 9, { width: W - 350, lineBreak: false });

    // Pill de status
    const pillW = 56;
    const pillX = W - 110;
    const pillY = y + 7;
    doc.roundedRect(pillX, pillY, pillW, 13, 6).fill(row.status.color + '18');
    doc.roundedRect(pillX, pillY, pillW, 13, 6).lineWidth(0.5).strokeColor(row.status.color + '60').stroke();
    doc.circle(pillX + 10, pillY + 6.5, 3).fill(row.status.color);
    doc.fontSize(7).fillColor(row.status.color).font('Body-Bold')
       .text(row.status.label, pillX + 16, pillY + 3, { lineBreak: false });

    y += rowH;
  });

  y += 16;
  doc.fontSize(7.5).fillColor(C.textDim).font('Body')
     .text('Status derivado dos scores dos coletores correspondentes. "Conforme" = score >= 3.5/5 | "Parcial" = 2.5-3.5 | "Lacuna" = < 2.5 | "N/A" = dado nao disponivel (permissao ausente no consent).', 48, y, { width: W - 96 });
}

// ── Páginas de recomendações detalhadas ───────────────────────────────────────
function buildRecommendations(doc, recommendations) {
  if (!recommendations?.items?.length) return;

  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Recomendacoes Detalhadas', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Todas as Recomendacoes', 48, y);

  const bs = recommendations.bySeverity || {};
  let bx = 48 + doc.widthOfString('Todas as Recomendacoes') + 16;
  for (const [sev, meta] of Object.entries(SEVERITY_META)) {
    if (bs[sev]) {
      bx += pill(doc, bx, y + 4, `${bs[sev]} ${meta.label}`, meta.color + '18', meta.color) + 6;
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
    y = sectionHeader(doc, meta.label, y);

    for (const rec of group) {
      if (y > doc.page.height - 140) { doc.addPage(); y = 52; }

      const startY = y;
      const textX  = 62;
      const textW  = W - 110;

      doc.rect(48, y, 4, 0).fill(meta.color);

      doc.fontSize(7).fillColor(meta.color).font('Body-Bold')
         .text(rec.category?.toUpperCase() || '', textX, y + 2, { lineBreak: false });

      const effortLabels = { low: 'Esforco baixo', medium: 'Esforco medio', high: 'Esforco alto' };
      const effortTxt = effortLabels[rec.effort] || rec.effort || '';
      if (effortTxt) {
        doc.fontSize(7).fillColor(C.textDim).font('Body')
           .text(effortTxt, W - 48 - doc.widthOfString(effortTxt), y + 2, { lineBreak: false });
      }
      y += 14;

      doc.fontSize(9).fillColor(C.textH).font('Body-Bold')
         .text(rec.finding || '', textX, y, { width: textW, lineBreak: true });
      y += doc.heightOfString(rec.finding || '', { width: textW }) + 4;

      doc.fontSize(8.5).fillColor(C.text).font('Body')
         .text(rec.recommendation || '', textX, y, { width: textW, lineBreak: true });
      y += doc.heightOfString(rec.recommendation || '', { width: textW }) + 8;

      doc.rect(48, startY, 4, y - startY).fill(meta.color);
      hLine(doc, y);
      y += 12;
    }

    y += 8;
  }
}

// ── Última página: Metodologia e Assinaturas ──────────────────────────────────
function buildMethodology(doc, result) {
  doc.addPage();
  const W = doc.page.width;
  let y = 52;

  y = pageKicker(doc, 'Metodologia e Escopo', y);
  doc.fontSize(18).fillColor(C.textH).font('Body-Bold')
     .text('Metodologia e Assinaturas', 48, y);
  y += 36;
  hLine(doc, y);
  y += 24;

  // Descricao da metodologia
  doc.fontSize(10).fillColor(C.textH).font('Body-Bold')
     .text('Sobre este Assessment', 48, y);
  y += 18;

  const methodText = `Este relatorio foi gerado pela plataforma BB Assessment Platform utilizando a Microsoft Graph API em modo somente leitura. Nenhum dado de conteudo foi acessado ou armazenado — apenas metadados de configuracao e governanca foram consultados.

A coleta e executada sob o principio de menor privilegio absoluto: cada coletor solicita apenas as permissoes necessarias para sua funcao especifica. O cliente pode revogar o consentimento a qualquer momento pelo Azure Portal.`;

  doc.fontSize(9).fillColor(C.text).font('Body')
     .text(methodText, 48, y, { width: W - 96 });
  y += doc.heightOfString(methodText, { width: W - 96 }) + 24;

  // Detalhes tecnicos
  doc.fontSize(10).fillColor(C.textH).font('Body-Bold')
     .text('Detalhes Tecnicos', 48, y);
  y += 16;

  const details = [
    { label: 'Tenant avaliado', value: result.tenantId || '-' },
    { label: 'Nome do tenant',  value: result.tenantName || '-' },
    { label: 'Data do assessment', value: result.assessedAt ? fmtDate(result.assessedAt) : '-' },
    { label: 'Versao da plataforma', value: '2.0' },
    { label: 'API utilizada', value: 'Microsoft Graph v1.0 + beta (seletivo)' },
    { label: 'Modo de acesso', value: 'App-only (Client Credentials), somente leitura' },
  ];

  for (const d of details) {
    doc.rect(48, y, W - 96, 22).fill(y % 44 === 0 ? C.bg2 : C.bg);
    doc.fontSize(8).fillColor(C.textDim).font('Body')
       .text(d.label, 56, y + 7, { lineBreak: false });
    doc.fontSize(8).fillColor(C.textH).font('Body-Bold')
       .text(d.value, 56 + 180, y + 7, { lineBreak: false });
    doc.moveTo(48, y + 22).lineTo(W - 48, y + 22).lineWidth(0.3).strokeColor(C.border).stroke();
    y += 22;
  }

  y += 28;
  hLine(doc, y);
  y += 28;

  // Disclaimer
  doc.rect(48, y, W - 96, 46).fill(C.bg2);
  doc.roundedRect(48, y, W - 96, 46, 4).lineWidth(0.5).strokeColor(C.border).stroke();
  doc.fontSize(7.5).fillColor(C.textDim).font('Body')
     .text('Responsabilidade: Os dados refletidos neste relatorio representam o estado do ambiente no momento da coleta. Configuracoes alteradas apos esta data nao estao refletidas. Este documento e de uso exclusivamente interno e pre-venda, nao constituindo declaracao formal de conformidade regulatoria. Para auditorias formais, consulte profissionais certificados nas normas aplicaveis.', 60, y + 10, { width: W - 120, lineBreak: true });
  y += 60;

  // Assinaturas
  doc.fontSize(10).fillColor(C.textH).font('Body-Bold')
     .text('Assinaturas', 48, y);
  y += 20;

  const sigW = (W - 96 - 24) / 2;

  // Assinatura do consultor
  hLine(doc, y + 36, { x: 48, width: sigW });
  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text('Consultor / Parceiro Microsoft', 48, y + 42, { lineBreak: false });
  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text(result.preparedBy || 'BB Assessment Platform', 48, y + 55, { lineBreak: false });

  // Linha de data ao lado
  const dateLineX = 48 + sigW - 90;
  hLine(doc, y + 36, { x: dateLineX, width: 80 });
  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text('Data', dateLineX, y + 42, { lineBreak: false });

  // Assinatura do cliente
  const sigX2 = 48 + sigW + 24;
  hLine(doc, y + 36, { x: sigX2, width: sigW });
  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text('Representante do Cliente', sigX2, y + 42, { lineBreak: false });

  hLine(doc, y + 36, { x: sigX2 + sigW - 90, width: 80 });
  doc.fontSize(8).fillColor(C.textDim).font('Body')
     .text('Data', sigX2 + sigW - 90, y + 42, { lineBreak: false });
}

// ── Entry point ───────────────────────────────────────────────────────────────
function generatePDF(result, outputStream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title:   `M365 Assessment — ${result.tenantName || result.tenantId}`,
      Author:  result.preparedBy || 'BB Assessment Platform',
      Subject: 'Microsoft 365 Security & Governance Assessment',
    },
  });

  // Registrar Open Sans (Unicode completo)
  try {
    doc.registerFont('Body',      path.join(FONT_DIR, 'OpenSans-Regular.ttf'));
    doc.registerFont('Body-Bold', path.join(FONT_DIR, 'OpenSans-Bold.ttf'));
  } catch {
    // Fallback para Helvetica se fontes nao disponíveis
    doc.registerFont('Body',      'Helvetica');
    doc.registerFont('Body-Bold', 'Helvetica-Bold');
  }

  const tenantName = result.tenantName || result.tenantId;
  let pageNum = 0;

  doc.on('pageAdded', () => {
    pageNum++;
    if (pageNum === 1) return; // capa sem header/footer

    const W = doc.page.width;

    // Header azul
    doc.rect(0, 0, W, 32).fill(C.accent);
    doc.fontSize(7).fillColor('#ffffff').font('Body')
       .text('M365 SECURITY ASSESSMENT', 48, 12, { lineBreak: false });
    doc.fillColor('#93c5fd')
       .text(tenantName, 0, 12, { align: 'right', width: W - 48, lineBreak: false });

    // Footer
    const fy = doc.page.height - 26;
    doc.rect(0, fy, W, 26).fill(C.bg3);
    doc.moveTo(0, fy).lineTo(W, fy).lineWidth(0.3).strokeColor(C.border).stroke();
    doc.fontSize(7).fillColor(C.textDim).font('Body')
       .text('Confidencial — Uso Interno e Pre-Venda', 48, fy + 9, { lineBreak: false });
    doc.fillColor(C.textDim)
       .text(`Pagina ${pageNum}`, 0, fy + 9, { align: 'right', width: W - 48, lineBreak: false });
  });

  doc.pipe(outputStream);

  buildCover(doc, result);
  buildTableOfContents(doc, result);
  buildVerdict(doc, result);
  buildScorePage(doc, result);
  buildRadarChart(doc, result);
  buildIAReadiness(doc, result);
  buildRoadmap(doc, result.recommendations);
  buildRiskSection(doc, result);
  buildComplianceMapping(doc, result);
  buildRecommendations(doc, result.recommendations);
  buildMethodology(doc, result);

  doc.end();
}

module.exports = { generatePDF };
