Você é o Claude Code trabalhando no repositório “Microsoft 365 Assessment Platform”.
Objetivo: transformar a tela “Baseline” em um “Zero Trust Hub” (visão executiva), sem quebrar a arquitetura existente.

Regras obrigatórias do projeto:
- Não hardcodear tenantId, secrets ou IDs.
- Não executar servidor local (npm start, node server.js etc.).
- Após cada modificação relevante: git add/commit e git push imediatamente.
- Respeitar princípios: zero write no tenant, zero content (sem e-mails/arquivos/chats), least privilege, isolamento multi-tenant. 
(Ver arquivo claude.md)

Contexto técnico (já existente no backend):
- O resultado final do assessment (GET /assessment/results/:tenantId) contém:
  tenantId, tenantName, assessedAt, overallScore, missingPermissions, reconsentNeeded, assessmentErrors,
  domains { baseline, entraId, sharePoint, governance, emailSecurity, iaReadiness },
  recommendations { total, bySeverity, items[] }.
(Ver assessmentRoutes.js e design.md)

Contratos:
- Cada collector retorna: score (0–5), summary, details(opc), unavailable.
(Ver design.md)
- A tela de recomendações consome result.recommendations.items e usa campos:
  id, severity, category, finding, recommendation, effort, reference.
(Ver RecommendationsScreen.jsx e recommendations/index.js)

TAREFA (Item 1):
1) Localize a tela Baseline no frontend (componente/rota). 
   - Use ripgrep para encontrar “Baseline” no src/ do frontend.
2) Redesenhe a tela Baseline para ter 4 blocos (sem alterar o backend):
   A) Header executivo:
      - “Baseline / Zero Trust” + overallScore + assessedAt + tenantName (se existir)
   B) “Pilares Zero Trust” (5 cards):
      - PIM: domains.entraId.collectors.privileged
      - MFA: domains.entraId.collectors.mfa
      - CA: domains.entraId.collectors.conditionalAccess
      - Identity Protection: domains.entraId.collectors.riskyUsers
      - Auditoria: domains.governance.collectors.audit
      Cada card deve mostrar:
      - score do collector (0–5) ou “N/A” se unavailable
      - 1 métrica principal do summary (se existir)
      - badge de pré-requisito quando unavailable (ex.: “Entra P1/P2” quando aplicável)
      - CTA “Ver detalhes” que navega para o domínio/collector correspondente
   C) “Top Ações”:
      - Mostre as 10 primeiras recomendações (ordenadas por severity já vem ordenado),
        com filtros rápidos (Críticas/Altas).
      - Link para abrir a tela Recommendations (reutilizar RecommendationsScreen) com filtro.
   D) “Bloqueios e Erros”:
      - Mostrar missingPermissions (lista)
      - Mostrar reconsentNeeded (true/false)
      - Mostrar assessmentErrors por domínio/collector se existir
      - Uma explicação curta do que significa “falta de permissão” vs “falta de licença”
        usando REQUIRED_PERMISSIONS (backend/authService.js) como referência de mapeamento.

3) Implementação:
   - Crie utilitário puro (ex.: mapZeroTrustPillars(result)) para montar os 5 cards.
   - Não invente dados: se summary não tiver a métrica, omita e mostre apenas score/status.
   - Use os componentes de UI existentes (PageHeader, Card, Pill, etc.) se o projeto tiver.

4) Critérios de aceite:
   - Build ok
   - Baseline não quebra mesmo com domains/collectors ausentes
   - Todos os textos e labels em pt-BR
   - Commit/push após cada etapa (mínimo 2 commits: layout + wiring)

5) Entregue no final:
   - lista de arquivos alterados
   - breve descrição do que foi implementado
   - prints não são necessários (não rodar local), mas descreva a estrutura final da tela.

Comece agora localizando a tela Baseline e seus arquivos relacionados.