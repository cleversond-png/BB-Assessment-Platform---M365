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

const SEVERITY_META = {
  critical: { label: 'Crítico',  color: C.red    },
  high:     { label: 'Alto',     color: C.amber  },
  medium:   { label: 'Médio',    color: C.blue   },
  low:      { label: 'Baixo',    color: C.textDim},
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
  return 'Crítica';
}

// Semáforo simplificado: 3 estados para leitura executiva
function trafficColor(v) {
  if (v == null)  return C.textDim;
  if (v >= 3.5)  return C.green;
  if (v >= 2.5)  return C.amber;
  return C.red;
}

function trafficLabel(v) {
  if (v == null)  return '—';
  if (v >= 3.5)  return 'Bom';
  if (v >= 2.5)  return 'Atenção';
  return 'Crítico';
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

// ── Sanitização de texto ──────────────────────────────────────────────────────
// PDFKit com Helvetica usa WinAnsi — caracteres fora do Latin-1 não renderizam.
function san(str) {
  return (str || '')
    .replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/✓/g, 'OK').replace(/✗/g, 'X')
    .replace(/●/g, '-').replace(/•/g, '-');
}

// ── Helpers de ícone (vector, independente de fonte) ──────────────────────────
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

// ── Helpers de desenho ────────────────────────────────────────────────────────
function fullBg(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
}

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
  doc.fontSize(7).fillColor(fg).text(text, x + pad, y + 1, { lineBreak: false });
  return pillW;
}

function trafficDot(doc, cx, cy, score) {
  const r = 7;
  doc.circle(cx, cy, r).fill(trafficColor(score));
}

// ── Cabeçalho de seção ────────────────────────────────────────────────────────
function sectionHeader(doc, title, y) {
  doc.rect(48, y, doc.page.width - 96, 28).fill(C.bg2);
  doc.fontSize(9).fillColor(C.blue).font('Helvetica-Bold')
     .text(title.toUpperCase(), 60, y + 9, { lineBreak: false, characterSpacing: 0.8 });
  return y + 36;
}

function pageKicker(doc, text, y) {
  doc.fontSize(8).fillColor(C.blue).font('Helvetica-Bold')
     .text(text.toUpperCase(), 48, y, { lineBreak: false, characterSpacing: 0.8 });
  return y + 16;
}

// ── Página 1: Capa ────────────────────────────────────────────────────────────
function buildCover(doc, result) {
  fullBg(doc);

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

  // Faixa superior
  doc.rect(0, 0, W, 6).fill(C.blue);

  // Produto
  doc.fontSize(10).fillColor(C.blue).font('Helvetica-Bold')
     .text('BB ASSESSMENT PLATFORM', 48, 40, { lineBreak: false });
  doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
     .text('Microsoft 365', 48, 55, { lineBreak: false });

  // Data no topo direito
  doc.fontSize(8).fillColor(C.textDim)
     .text(fmtDate(result.assessedAt), 0, 40, { align: 'right', width: W - 48, lineBreak: false });

  // Nome do tenant
  const tenantName = result.tenantName || result.tenantId;
  doc.fontSize(26).fillColor(C.textH).font('Helvetica-Bold')
     .text(tenantName, 48, H / 2 - 130, { align: 'center', width: W - 96, lineBreak: false });

  doc.fontSize(9).fillColor(C.textDim).font('Helvetica')
     .text(result.tenantId, 48, H / 2 - 96, { align: 'center', width: W - 96, lineBreak: false });

  // Separador
  hLine(doc, H / 2 - 70, { color: C.bg3 });

  // Círculo de score geral
  const gaugeR = 68;
  const gx = cx;
  const gy = H / 2 + 10;
  doc.circle(gx, gy, gaugeR).lineWidth(8).strokeColor(C.bg3).stroke();
  doc.fontSize(34).fillColor(color).font('Helvetica-Bold')
     .text(score != null ? score.toFixed(1) : '—', gx - 38, gy - 24, { lineBreak: false });
  doc.fontSize(13).fillColor(C.textDim).font('Helvetica')
     .text('/5', gx + 12, gy - 12, { lineBreak: false });

  doc.fontSize(12).fillColor(color).font('Helvetica-Bold')
     .text(`Maturidade ${scoreLabel(score)}`, 48, gy + gaugeR + 14, { align: 'center', width: W - 96, lineBreak: false });

  // Veredicto Copilot em destaque
  if (readinessLevel) {
    const verdictTxt = copilotReady
      ? 'Pronto para Copilot for Microsoft 365'
      : `Copilot bloqueado — ${readinessLevel}`;

    const bannerY = gy + gaugeR + 42;
    doc.rect(cx - 170, bannerY, 340, 34).fill(verdictColor + '25');
    doc.roundedRect(cx - 170, bannerY, 340, 34, 6).lineWidth(0.8).strokeColor(verdictColor + '60').stroke();
    // Ícone desenhado via vector (Helvetica não suporta ✓/✗)
    if (copilotReady) {
      drawCheck(doc, cx - 158, bannerY + 8, 18, verdictColor);
    } else {
      drawCross(doc, cx - 158, bannerY + 8, 18, verdictColor);
    }
    doc.fontSize(12).fillColor(verdictColor).font('Helvetica-Bold')
       .text(verdictTxt, cx - 136, bannerY + 10, { width: 296, align: 'center', lineBreak: false });
  }

  // Rodapé
  hLine(doc, H - 48);
  doc.fontSize(7).fillColor(C.textDim)
     .text('Documento gerado automaticamente — uso interno / pré-venda', 48, H - 36, { align: 'center', width: W - 96 });
}

// ── Página 2: Veredicto Executivo ─────────────────────────────────────────────
function buildVerdict(doc, result) {
  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  const ia             = result.domains?.iaReadiness;
  const copilotReady   = ia?.copilotReady ?? false;
  const level          = ia?.readinessLevel ?? '—';
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

  // Nível de prontidão em destaque
  doc.fontSize(30).fillColor(verdictColor).font('Helvetica-Bold')
     .text(level, 48, y, { lineBreak: false });
  y += 46;
  hLine(doc, y);
  y += 22;

  // Parágrafo 1 — situação
  let p1, p2, p3;
  if (copilotReady) {
    p1 = `O ambiente Microsoft 365 de ${tenantName} atende os pré-requisitos técnicos para o deployment do Copilot for Microsoft 365. Os controles essenciais de proteção de identidade, segurança de dados e governança estão em vigor, e o risco de exposição inadvertida de informações confidenciais via IA é classificado como baixo.`;
    p2 = `A organização está em posição favorável para iniciar o rollout do Copilot, priorizando grupos com perfis de dados bem delimitados. Recomenda-se um piloto inicial com 50–100 usuários de diferentes áreas antes da expansão geral, com monitoramento ativo nos primeiros 30 dias de uso.`;
    p3 = `As recomendações identificadas neste assessment são de caráter evolutivo — não bloqueiam o início do projeto mas, quando implementadas, elevarão ainda mais a maturidade e o valor gerado pela IA.`;
  } else if (level.includes('Moderada')) {
    p1 = `O ambiente Microsoft 365 de ${tenantName} apresenta maturidade moderada em segurança e governança de dados. O Copilot for Microsoft 365 pode ser implantado de forma controlada em grupos piloto, mas existem riscos que precisam ser resolvidos para garantir que a IA não exponha informações confidenciais de forma inadvertida para usuários não autorizados.`;
    p2 = `Recomenda-se um piloto limitado e monitorado enquanto os itens de risco são endereçados pelas equipes de TI. A expansão do Copilot para toda a organização deve aguardar a conclusão das ações prioritárias de curto prazo descritas neste relatório.`;
    p3 = `Com foco nas ações de Fase 1 e 2 do roadmap, estima-se que o ambiente estará preparado para rollout amplo em 60 a 90 dias.`;
  } else if (level.includes('Parcial')) {
    p1 = `O ambiente Microsoft 365 de ${tenantName} apresenta lacunas relevantes nos controles de segurança e governança de dados. A implantação do Copilot for Microsoft 365 no estado atual representa um risco real: a IA pode acessar e compartilhar com qualquer usuário informações que não foram intencionalmente expostas de forma ampla.`;
    p2 = `Não é recomendado iniciar o rollout do Copilot antes de resolver os bloqueadores identificados. O principal risco é que a IA amplifique permissões excessivas já existentes — conteúdo que estava disponível mas ignorado passa a ser descoberto e citado nas respostas para qualquer colaborador.`;
    p3 = `Seguindo o roadmap de remediação deste relatório, estima-se que o ambiente pode estar em condições adequadas para um piloto controlado em 60 a 90 dias, e para rollout geral em 90 a 120 dias.`;
  } else {
    p1 = `O ambiente Microsoft 365 de ${tenantName} NÃO está em condições de receber o Copilot for Microsoft 365 com segurança. Foram identificados ${criticalBlk} bloqueador${criticalBlk !== 1 ? 'es' : ''} crítico${criticalBlk !== 1 ? 's' : ''} que, se ignorados, podem resultar em exposição de dados sensíveis, violações de privacidade e riscos de conformidade regulatória.`;
    p2 = `O deployment do Copilot deve ser suspenso ou mantido em espera até a resolução dos itens críticos. A IA, sem os controles de governança adequados, atua como um amplificador de permissões existentes — tornando acessível a qualquer usuário conteúdo que deveria ser restrito.`;
    p3 = `Este relatório apresenta um plano de remediação em fases. Seguido com comprometimento das lideranças de TI e do negócio, o ambiente pode estar pronto para um piloto seguro do Copilot em 90 a 120 dias.`;
  }

  for (const para of [p1, p2, p3]) {
    doc.fontSize(10).fillColor(C.text).font('Helvetica')
       .text(para, 48, y, { width: W - 96, lineBreak: true, align: 'justify' });
    y += doc.heightOfString(para, { width: W - 96 }) + 14;
  }

  y += 6;
  hLine(doc, y);
  y += 22;

  // Métricas executivas em boxes
  const metrics = [
    { label: 'Score Geral',            value: score != null ? score.toFixed(1) + '/5' : '—', color: scoreColor(score) },
    { label: 'Pré-requisitos Atendidos', value: `${passed} / ${total}`,                      color: passed === total ? C.green : C.amber },
    { label: 'Bloqueadores Críticos',  value: String(criticalBlk),                           color: criticalBlk === 0 ? C.green : C.red },
    { label: 'Total de Recomendações', value: String(recs.length),                           color: C.blue },
  ];

  const boxW  = (W - 96 - 36) / 4;
  let   bx    = 48;
  for (const m of metrics) {
    doc.rect(bx, y, boxW, 58).fill(C.bg2);
    doc.roundedRect(bx, y, boxW, 58, 4).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fontSize(24).fillColor(m.color).font('Helvetica-Bold')
       .text(m.value, bx + 6, y + 10, { width: boxW - 12, align: 'center', lineBreak: false });
    doc.fontSize(7.5).fillColor(C.textDim).font('Helvetica')
       .text(m.label, bx + 6, y + 41, { width: boxW - 12, align: 'center', lineBreak: false });
    bx += boxW + 12;
  }
  y += 76;

  // Principais bloqueadores (se houver)
  const blockers = ia?.blockers || [];
  if (!copilotReady && blockers.length > 0) {
    doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
       .text('Principais bloqueadores para o Copilot:', 48, y);
    y += 18;

    for (const b of blockers.slice(0, 4)) {
      if (y > doc.page.height - 70) break;
      const bColor = b.impact === 'critical' ? C.red : C.amber;
      const startY = y;
      doc.rect(48, startY, 3, 0).fill(bColor);

      doc.fontSize(8.5).fillColor(C.textH).font('Helvetica-Bold')
         .text(san(b.label), 60, y, { width: W - 108, lineBreak: false });
      y += 14;
      if (b.detail) {
        doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
           .text(san(b.detail), 60, y, { width: W - 108, lineBreak: true });
        y += doc.heightOfString(b.detail, { width: W - 108 }) + 4;
      }
      doc.rect(48, startY, 3, y - startY).fill(bColor);
      y += 10;
    }
  }
}

// ── Página 3: Scores por domínio com semáforo ─────────────────────────────────
function buildScorePage(doc, result) {
  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  y = pageKicker(doc, 'Visão por Domínio', y);
  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('Score por Domínio', 48, y);
  y += 36;

  // Legenda do semáforo
  const legends = [
    { color: C.green, label: 'Bom (>= 3.5)' },
    { color: C.amber, label: 'Atenção (2.5–3.5)' },
    { color: C.red,   label: 'Crítico (< 2.5)' },
  ];
  let lx = 48;
  for (const l of legends) {
    doc.circle(lx + 5, y + 5, 5).fill(l.color);
    doc.fontSize(7.5).fillColor(C.textDim).font('Helvetica')
       .text(l.label, lx + 14, y + 1, { lineBreak: false });
    lx += doc.widthOfString(l.label) + 30;
  }
  y += 22;
  hLine(doc, y);
  y += 16;

  // Cabeçalho da tabela
  doc.fontSize(7.5).fillColor(C.textDim).font('Helvetica-Bold')
     .text('DOMÍNIO', 88, y, { lineBreak: false });
  doc.text('STATUS', W - 260, y, { lineBreak: false });
  doc.text('SCORE', W - 180, y, { lineBreak: false });
  doc.text('EVOLUÇÃO', W - 128, y, { lineBreak: false });
  y += 16;

  const domains = result.domains || {};

  for (const [key, label] of Object.entries(DOMAIN_LABELS)) {
    const d     = domains[key];
    const score = d?.domainScore;
    const tColor = trafficColor(score);
    const barW   = 88;

    doc.rect(48, y - 6, W - 96, 36).fill(C.bg2);

    // Semáforo dot
    doc.circle(66, y + 10, 7).fill(tColor);

    // Ícone + nome
    doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
       .text(label, 84, y + 4, { lineBreak: false });

    if (!d || d.error) {
      doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
         .text('Indisponível', W - 260, y + 5, { lineBreak: false });
    } else {
      // Status textual (Bom / Atenção / Crítico)
      doc.fontSize(8).fillColor(tColor).font('Helvetica-Bold')
         .text(trafficLabel(score), W - 260, y + 5, { lineBreak: false });

      // Score numérico
      doc.fontSize(14).fillColor(scoreColor(score)).font('Helvetica-Bold')
         .text(score != null ? score.toFixed(1) : '—', W - 180, y, { lineBreak: false });
      doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
         .text('/5', W - 158, y + 5, { lineBreak: false });

      // Barra de progresso
      scoreBar(doc, W - 128, y + 8, barW, 8, score);
    }

    y += 40;
  }

  // Total geral
  y += 4;
  hLine(doc, y);
  y += 16;
  doc.rect(48, y - 4, W - 96, 36).fill(C.bg3);
  doc.circle(66, y + 14, 7).fill(trafficColor(result.overallScore));
  doc.fontSize(10).fillColor(C.textDim).font('Helvetica')
     .text('Score Consolidado', 84, y + 8, { lineBreak: false });
  doc.fontSize(18).fillColor(scoreColor(result.overallScore)).font('Helvetica-Bold')
     .text(result.overallScore != null ? result.overallScore.toFixed(1) : '—', W - 180, y + 4, { lineBreak: false });
  doc.fontSize(9).fillColor(C.textDim).font('Helvetica')
     .text('/5', W - 156, y + 10, { lineBreak: false });
  y += 52;

  // Nota de leitura
  y += 8;
  doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
     .text('Escala 0–5 por domínio. Score consolidado = média ponderada dos domínios. Cada domínio agrega coletores que consultam a Microsoft Graph API do tenant avaliado.', 48, y, { width: W - 96 });
}

// ── Página 4: Checklist Copilot Readiness ────────────────────────────────────
function buildIAReadiness(doc, result) {
  const ia = result.domains?.iaReadiness;
  if (!ia) return;

  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  y = pageKicker(doc, 'Copilot Readiness', y);
  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('Checklist de Pré-Requisitos do Copilot', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  // Score + nível
  const score = ia.domainScore;
  const color = scoreColor(score);
  doc.fontSize(34).fillColor(color).font('Helvetica-Bold')
     .text(score != null ? score.toFixed(1) : '—', 48, y, { lineBreak: false });
  doc.fontSize(10).fillColor(C.textDim).font('Helvetica')
     .text('/5', 92, y + 16, { lineBreak: false });
  if (ia.readinessLevel) {
    doc.fontSize(14).fillColor(color).font('Helvetica-Bold')
       .text(ia.readinessLevel, 112, y + 12, { lineBreak: false });
  }
  // Passed count
  const passed = ia.summary?.passedCount ?? 0;
  const total  = ia.checks?.length ?? 0;
  doc.fontSize(9).fillColor(C.textDim).font('Helvetica')
     .text(`${passed} de ${total} pré-requisitos atendidos`, 112, y + 32, { lineBreak: false });
  y += 56;

  // Banner de status geral
  const critBlk    = ia.summary?.criticalBlockers ?? 0;
  const bannerColor = critBlk > 0 ? C.red : ia.copilotReady ? C.green : C.amber;
  const bannerMsg   = critBlk > 0
    ? `${critBlk} bloqueador${critBlk > 1 ? 'es' : ''} crítico${critBlk > 1 ? 's' : ''} — deployment do Copilot não recomendado`
    : ia.copilotReady
      ? 'Nenhum bloqueador crítico — ambiente pronto para Copilot'
      : 'Sem bloqueadores críticos, mas existem riscos altos a endereçar';

  doc.rect(48, y, W - 96, 30).fill(bannerColor + '18');
  doc.rect(48, y, 4, 30).fill(bannerColor);
  doc.fontSize(9).fillColor(bannerColor).font('Helvetica-Bold')
     .text(bannerMsg, 62, y + 10, { lineBreak: false });
  y += 44;

  // Checklist
  const checks = ia.checks || [];
  if (!checks.length) return;

  // Separar críticos/altos dos médios
  const critical = checks.filter(c => c.impact === 'critical' || c.impact === 'high');
  const medium   = checks.filter(c => c.impact === 'medium');

  const groups = [
    { title: 'Pré-Requisitos Críticos e Altos', items: critical },
    { title: 'Práticas Recomendadas', items: medium },
  ];

  for (const group of groups) {
    if (!group.items.length) continue;

    if (y > doc.page.height - 100) {
      doc.addPage(); fullBg(doc); y = 48;
    }

    y = sectionHeader(doc, group.title, y);

    for (const check of group.items) {
      if (y > doc.page.height - 70) {
        doc.addPage(); fullBg(doc); y = 48;
      }

      const iColor = check.passed ? C.green : (check.impact === 'critical' ? C.red : C.amber);

      // Checkbox desenhado via vector
      doc.roundedRect(48, y, 18, 18, 3)
         .fill(check.passed ? C.green + '20' : iColor + '20');
      if (check.passed) {
        drawCheck(doc, 48, y, 18, iColor);
      } else {
        drawCross(doc, 48, y, 18, iColor);
      }

      // Label
      doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
         .text(san(check.label || check.id), 76, y + 4, { width: W - 180, lineBreak: false });

      // Peso + impacto no canto direito
      const impactTxt = check.impact === 'critical' ? 'CRÍTICO'
        : check.impact === 'high' ? 'ALTO' : 'MÉDIO';
      doc.fontSize(7).fillColor(iColor).font('Helvetica-Bold')
         .text(impactTxt, W - 96, y + 5, { lineBreak: false });
      doc.fontSize(6.5).fillColor(C.textDim).font('Helvetica')
         .text(`peso ${check.weight}`, W - 96, y + 16, { lineBreak: false });

      y += 22;

      // Detail line
      if (check.detail) {
        doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
           .text(check.detail, 76, y, { width: W - 144, lineBreak: true });
        y += doc.heightOfString(check.detail, { width: W - 144 }) + 6;
      } else {
        y += 4;
      }

      hLine(doc, y, { x: 76, width: W - 124, color: C.bg3 });
      y += 10;
    }

    y += 8;
  }
}

// ── Página 5: Roadmap de Remediação ──────────────────────────────────────────
function buildRoadmap(doc, recommendations) {
  const items = recommendations?.items || [];
  if (!items.length) return;

  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  y = pageKicker(doc, 'Plano de Remediação', y);
  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('Roadmap em 3 Fases', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  const phases = [
    {
      num: '1',
      title: 'Ação Imediata',
      timeline: '0 – 30 dias',
      color: C.red,
      description: 'Bloqueadores que impedem o rollout seguro do Copilot. Devem ser resolvidos antes de qualquer piloto de IA.',
      items: items.filter(r => r.severity === 'critical'),
    },
    {
      num: '2',
      title: 'Curto Prazo',
      timeline: '30 – 90 dias',
      color: C.amber,
      description: 'Riscos altos que reduzem a qualidade e a segurança do Copilot. Resolver antes de expandir para toda a organização.',
      items: items.filter(r => r.severity === 'high'),
    },
    {
      num: '3',
      title: 'Médio Prazo',
      timeline: '90 – 180 dias',
      color: C.blue,
      description: 'Melhorias de maturidade que potencializam o valor do Copilot e reforçam a postura de segurança no longo prazo.',
      items: items.filter(r => r.severity === 'medium' || r.severity === 'low'),
    },
  ];

  const effortPt = { low: 'Esforço baixo', medium: 'Esforço médio', high: 'Esforço alto' };

  for (const phase of phases) {
    if (y > doc.page.height - 130) {
      doc.addPage(); fullBg(doc); y = 48;
    }

    // Cabeçalho da fase
    const headerH = 42;
    doc.rect(48, y, W - 96, headerH).fill(phase.color + '1A');
    doc.rect(48, y, 4, headerH).fill(phase.color);

    doc.fontSize(8).fillColor(phase.color).font('Helvetica-Bold')
       .text(`FASE ${phase.num}  ·  ${phase.timeline}`, 60, y + 7, { lineBreak: false, characterSpacing: 0.5 });
    doc.fontSize(13).fillColor(C.textH).font('Helvetica-Bold')
       .text(phase.title, 60, y + 20, { lineBreak: false });

    // Contador de ações
    const countTxt = `${phase.items.length} ${phase.items.length !== 1 ? 'acoes' : 'acao'}`;
    const cw = doc.widthOfString(countTxt) + 20;
    doc.roundedRect(W - 48 - cw, y + 13, cw, 18, 9).fill(phase.color + '35');
    doc.fontSize(8).fillColor(phase.color).font('Helvetica-Bold')
       .text(countTxt, W - 48 - cw + 10, y + 17, { lineBreak: false });

    y += headerH + 12;

    // Descrição da fase
    doc.fontSize(8.5).fillColor(C.textDim).font('Helvetica')
       .text(phase.description, 56, y, { width: W - 104 });
    y += doc.heightOfString(phase.description, { width: W - 104 }) + 10;

    if (!phase.items.length) {
      doc.fontSize(8).fillColor(C.textDim).font('Helvetica')
         .text('Nenhuma ação nesta fase.', 56, y, { lineBreak: false });
      y += 16;
    }

    // Itens da fase (até 6)
    const shown = phase.items.slice(0, 6);
    for (const item of shown) {
      if (y > doc.page.height - 60) break;

      doc.circle(58, y + 5, 3).fill(phase.color);

      doc.fontSize(8.5).fillColor(C.textH).font('Helvetica-Bold')
         .text(san(item.finding || item.id), 68, y, { width: W - 188, lineBreak: true });

      const itemH = doc.heightOfString(san(item.finding || item.id), { width: W - 188 });

      if (item.effort) {
        const eTxt = effortPt[item.effort] || item.effort;
        doc.fontSize(7).fillColor(C.textDim).font('Helvetica')
           .text(eTxt, W - 120, y + 2, { lineBreak: false });
      }

      doc.fontSize(7).fillColor(phase.color).font('Helvetica-Bold')
         .text(item.category || '', W - 60, y + 2, { lineBreak: false });

      y += Math.max(itemH, 14) + 6;
    }

    if (phase.items.length > 6) {
      doc.fontSize(7.5).fillColor(C.textDim).font('Helvetica')
         .text(`… e mais ${phase.items.length - 6} ações nesta fase — ver seção Recomendações Detalhadas.`, 68, y, { lineBreak: false });
      y += 14;
    }

    y += 20;
  }
}

// ── Página 6: Risco se não agir ───────────────────────────────────────────────
function buildRiskSection(doc, result) {
  const recs = result.recommendations?.items || [];
  const riskyItems = recs.filter(r => r.severity === 'critical' || r.severity === 'high').slice(0, 6);
  if (!riskyItems.length) return;

  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  // Cenários de risco por ID de recomendação
  const RISK_SCENARIOS = {
    SHARING_ANONYMOUS_LINKS:    'Um colaborador pergunta ao Copilot pela estratégia de produto e recebe trechos de um documento compartilhado publicamente que nunca foi pensado para aquele público.',
    SHARING_EXTERNAL_HIGH:      'Links de compartilhamento externo permanecem ativos indefinidamente. O Copilot indexa esse conteúdo e pode entregá-lo a qualquer usuário do tenant que fizer a pergunta certa.',
    OVERSHARING_EVERYONE:       'Documentos de RH, financeiro ou projetos estratégicos com permissão "para todos" tornam-se fontes do Copilot — qualquer colaborador passa a acessar esse conteúdo via IA, sem que ninguém tenha autorizado explicitamente.',
    MFA_LOW_COVERAGE:           'Uma conta sem MFA comprometida por phishing dá ao invasor acesso ao Copilot com as permissões do usuário. Ele pode resumir contratos, mapear a estrutura da empresa e extrair dados sem disparar alertas tradicionais de segurança.',
    CA_NO_POLICIES:             'O Copilot pode ser acessado de dispositivos pessoais, redes públicas ou países de alto risco, sem nenhum controle sobre o contexto de acesso — um colaborador em viagem usa um computador público para consultar dados confidenciais via IA.',
    CA_NO_MFA_POLICY:           'Políticas de acesso existem mas não exigem segundo fator. Uma senha roubada é suficiente para acessar o Copilot com acesso a todos os dados do tenant.',
    GOV_NO_SENSITIVITY_LABELS:  'Sem classificação de dados, o Copilot não distingue um documento público de um contrato NDA. A IA pode incluir cláusulas confidenciais num resumo compartilhado em reunião.',
    DLP_NO_COPILOT_POLICY:      'Um usuário pede ao Copilot para resumir documentos com CPF, dados de cartão ou prontuários médicos — a IA entrega esses dados na resposta sem nenhum bloqueio ou aviso de conformidade.',
    PRIVILEGED_NO_PIM:          'Um Global Administrator comprometido tem acesso irrestrito ao Copilot 24/7 com o maior nível de privilégio possível — podendo consultar, resumir e exfiltrar qualquer dado do tenant de forma conversacional.',
    INACTIVE_ENABLED_USERS:     'Contas de ex-funcionários ainda ativas com acesso ao Copilot são alvos primários de ataques de credential stuffing. Se comprometidas, o invasor herda anos de permissões acumuladas e acesso irrestrito à IA.',
    RETENTION_NO_EXCHANGE:      'E-mails relevantes são deletados antes de investigações internas ou auditorias regulatórias. Quando o regulador ou o jurídico solicitar comprovação, as evidências não existirão mais.',
    APPS_LOW_DESKTOP_DEPLOYMENT: 'A organização investe em licenças do Copilot mas parcela significativa dos usuários não consegue usá-lo — o botão do Copilot não aparece em versões desatualizadas do Office, gerando frustração e questionamentos sobre ROI.',
    PRIVILEGED_EXCESS_GA:       'Com muitos Global Administrators permanentes, a superfície de ataque é proporcionalmente maior. Cada conta é um vetor potencial de acesso irrestrito ao Copilot e a todos os dados do tenant.',
    PRIVILEGED_GUEST_ADMIN:     'Contas externas com papel administrativo têm acesso privilegiado ao Copilot. Um convidado comprometido ou mal-intencionado tem poder máximo sobre os dados da organização via IA.',
  };

  y = pageKicker(doc, 'Análise de Risco', y);
  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('O que acontece se não agir', 48, y);
  y += 32;
  hLine(doc, y);
  y += 20;

  const intro = 'Cada lacuna de governança identificada neste assessment tem um cenário de risco concreto quando o Copilot for Microsoft 365 estiver ativo. A seguir, os principais riscos e seu impacto potencial para o negócio — descritos sem jargão técnico.';
  doc.fontSize(10).fillColor(C.text).font('Helvetica')
     .text(intro, 48, y, { width: W - 96, align: 'justify' });
  y += doc.heightOfString(intro, { width: W - 96 }) + 22;

  for (const rec of riskyItems) {
    if (y > doc.page.height - 100) {
      doc.addPage(); fullBg(doc); y = 48;
    }

    const sevColor = rec.severity === 'critical' ? C.red : C.amber;
    const scenario = RISK_SCENARIOS[rec.id] ?? `${rec.recommendation}`;
    const startY   = y;

    doc.rect(48, startY, 3, 0).fill(sevColor);

    // Achado técnico (finding)
    const findingTxt = san(rec.finding || rec.id);
    doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
       .text(findingTxt, 60, y, { width: W - 120, lineBreak: true });
    y += doc.heightOfString(findingTxt, { width: W - 120 }) + 4;

    // Cenário de risco em negócio
    doc.fontSize(8.5).fillColor(C.text).font('Helvetica')
       .text('Cenario: ', 60, y, { continued: true, lineBreak: false });
    doc.fillColor(C.textDim).text(san(scenario), { width: W - 120, lineBreak: true });
    y += doc.heightOfString(san(scenario), { width: W - 120 }) + 6;

    // Severidade via vector dot + texto
    const sevLabel = rec.severity === 'critical' ? 'CRITICO' : 'RISCO ALTO';
    doc.circle(63, y + 4, 3).fill(sevColor);
    doc.fontSize(7).fillColor(sevColor).font('Helvetica-Bold')
       .text(sevLabel, 70, y, { lineBreak: false });
    if (rec.category) {
      doc.fontSize(7).fillColor(C.textDim).font('Helvetica')
         .text(`  -  ${rec.category}`, 70 + doc.widthOfString(sevLabel) + 2, y, { lineBreak: false });
    }
    y += 14;

    doc.rect(48, startY, 3, y - startY).fill(sevColor);
    hLine(doc, y, { color: C.bg3 });
    y += 14;
  }
}

// ── Páginas de recomendações detalhadas ───────────────────────────────────────
function buildRecommendations(doc, recommendations) {
  if (!recommendations?.items?.length) return;

  doc.addPage();
  fullBg(doc);

  const W = doc.page.width;
  let y = 48;

  y = pageKicker(doc, 'Recomendações Detalhadas', y);
  doc.fontSize(16).fillColor(C.textH).font('Helvetica-Bold')
     .text('Todas as Recomendações', 48, y);

  // Contadores por severidade
  const bs = recommendations.bySeverity || {};
  let bx = 48 + doc.widthOfString('Todas as Recomendações') + 16;
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
    y = sectionHeader(doc, meta.label, y);

    for (const rec of group) {
      if (y > doc.page.height - 140) {
        doc.addPage(); fullBg(doc); y = 48;
      }

      const startY = y;
      const textX  = 60;
      const textW  = W - 108;

      doc.rect(48, y, 3, 0).fill(meta.color);

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

      doc.fontSize(9).fillColor(C.textH).font('Helvetica-Bold')
         .text(san(rec.finding || ''), textX, y, { width: textW, lineBreak: true });
      y += doc.heightOfString(san(rec.finding || ''), { width: textW }) + 4;

      doc.fontSize(8.5).fillColor(C.text).font('Helvetica')
         .text(san(rec.recommendation || ''), textX, y, { width: textW, lineBreak: true });
      y += doc.heightOfString(san(rec.recommendation || ''), { width: textW }) + 8;

      doc.rect(48, startY, 3, y - startY).fill(meta.color);
      hLine(doc, y, { color: C.bg3 });
      y += 12;
    }

    y += 8;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
function generatePDF(result, outputStream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title:   `M365 Assessment — ${result.tenantName || result.tenantId}`,
      Author:  'BB Assessment Platform',
      Subject: 'Microsoft 365 Security & Governance Assessment',
    },
  });

  doc.pipe(outputStream);

  buildCover(doc, result);           // Página 1 — Capa com veredicto
  buildVerdict(doc, result);         // Página 2 — Veredicto executivo
  buildScorePage(doc, result);       // Página 3 — Scores com semáforo
  buildIAReadiness(doc, result);     // Página 4 — Checklist Copilot
  buildRoadmap(doc, result.recommendations);   // Página 5 — Roadmap 3 fases
  buildRiskSection(doc, result);     // Página 6 — Risco se não agir
  buildRecommendations(doc, result.recommendations); // Páginas 7+ — Detalhes

  doc.end();
}

module.exports = { generatePDF };
