# Microsoft 365 Assessment Platform — Enterprise

## Contexto
Este projeto implementa uma plataforma de assessment técnico Microsoft 365 para uso em pré-vendas, diagnóstico e readiness para IA (Copilot).

A solução deve operar com **uma única App Registration multi-tenant**, onde clientes concedem consentimento administrativo para coleta automatizada de dados de configuração e governança.

## Objetivos Estratégicos
- Avaliar maturidade de governança, segurança e dados
- Identificar riscos para adoção de IA
- Criar base objetiva para roadmap e proposta comercial
- Operar com baixo atrito para o cliente

## Princípios Obrigatórios
- Zero write no tenant do cliente
- Zero acesso a conteúdo (emails, arquivos, chats)
- Least privilege absoluto
- Multi-tenant isolation
- Segurança > conveniência

## Arquitetura Esperada
- Backend desacoplado
- Collectors independentes por domínio
- Normalização centralizada
- Motor de scoring desacoplado
- Outputs reutilizáveis (relatório, dashboard, API)

## Expectativas para Claude Code
- Gerar código modular e extensível
- Nunca hardcodear tenant, IDs ou secrets
- Tratar paginação e rate limits do Graph
- Implementar logs estruturados
- Priorizar clareza e segurança

## Anti‑Padrões
- Scripts PowerShell como produto final
- Permissões desnecessárias
- Acesso a dados de usuário
- Dependência de configuração manual por cliente

## Definição de Pronto
- Consentimento funcional em tenant externo
- Coleta completa sem erros críticos
- Relatório compreensível para executivos
- Base pronta para escalar

## Fluxo de Trabalho Obrigatório
- O ambiente de produção está publicado no Azure via CI/CD a partir do GitHub
- **Após toda modificação de arquivo, fazer `git push` imediatamente**
- Não executar o servidor local (npm start, node server.js, etc.)
- Trabalhar apenas nos arquivos do repositório e commitar + push para deployar