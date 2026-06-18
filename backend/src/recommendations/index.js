// Rules engine: maps assessment findings to actionable recommendations.
// Each rule: id, severity, category, check(result)→bool, finding, recommendation, effort, reference.

const RULES = [
  // ── Identidade ────────────────────────────────────────────────────────────
  {
    id: 'ENTRA_NO_PREMIUM_P1',
    check: (r) => {
      const tier = r.baseline?.entraIdTier;
      const hasPremium = tier === 'P1' || tier === 'P2';
      if (hasPremium) return false;
      return r.entraId?.collectors?.mfa?.unavailable || r.entraId?.collectors?.conditionalAccess?.unavailable;
    },
    severity: 'critical',
    category: 'Identidade',
    finding: 'Tenant sem Entra ID Premium — MFA reporting e Conditional Access indisponíveis.',
    recommendation: 'Adquirir licenças Entra ID P1 para toda a base de usuários. Habilita MFA enforcement por Conditional Access e Identity Protection.',
    effort: 'high',
    reference: 'https://learn.microsoft.com/en-us/entra/fundamentals/whatis',
  },
  {
    id: 'ENTRA_P1_PERM_MISSING',
    check: (r) => {
      const tier = r.baseline?.entraIdTier;
      const hasPremium = tier === 'P1' || tier === 'P2';
      if (!hasPremium) return false;
      return r.entraId?.collectors?.mfa?.unavailable || r.entraId?.collectors?.conditionalAccess?.unavailable;
    },
    severity: 'high',
    category: 'Identidade',
    finding: 'MFA reporting ou Conditional Access indisponíveis — permissões ausentes na App Registration, mesmo com Entra ID P1 licenciado.',
    recommendation: 'Verificar se a App Registration possui as permissões UserAuthenticationMethod.Read.All (para MFA) e Policy.Read.All (para Conditional Access) com admin consent concedido no tenant.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/graph/permissions-reference',
  },
  {
    id: 'MFA_LOW_COVERAGE',
    check: (r) => {
      const s = r.entraId?.collectors?.mfa?.summary;
      return s && !r.entraId?.collectors?.mfa?.unavailable && s.coveragePercent < 80;
    },
    severity: 'critical',
    category: 'Identidade',
    finding: (r) => `Cobertura de MFA abaixo de 80% — ${r.entraId.collectors.mfa.summary.coveragePercent}% dos usuários registrados.`,
    recommendation: 'Criar política de Conditional Access obrigando MFA para todos os usuários. Comunicar e treinar usuários sem registro.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-all-users-mfa',
  },
  {
    id: 'CA_NO_POLICIES',
    check: (r) => {
      const ca = r.entraId?.collectors?.conditionalAccess;
      return ca && !ca.unavailable && ca.summary?.enabled === 0;
    },
    severity: 'high',
    category: 'Identidade',
    finding: 'Nenhuma política de Conditional Access habilitada.',
    recommendation: 'Criar ao menos 3 políticas base: (1) MFA para todos, (2) bloquear autenticação legada, (3) bloquear países de alto risco.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/plan-conditional-access',
  },
  {
    id: 'CA_NO_MFA_POLICY',
    check: (r) => {
      const ca = r.entraId?.collectors?.conditionalAccess;
      return ca && !ca.unavailable && ca.summary?.enabled > 0 && !ca.summary?.mfaEnforced;
    },
    severity: 'high',
    category: 'Identidade',
    finding: 'Conditional Access ativo mas sem política que enforce MFA.',
    recommendation: 'Criar política de CA com grant control "Require multifactor authentication" aplicada a todos os usuários.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-all-users-mfa',
  },
  {
    id: 'CA_LEGACY_AUTH',
    check: (r) => {
      const ca = r.entraId?.collectors?.conditionalAccess;
      return ca && !ca.unavailable && !ca.summary?.blockLegacyAuth;
    },
    severity: 'high',
    category: 'Identidade',
    finding: 'Autenticação legada (Basic Auth, SMTP AUTH) não está bloqueada.',
    recommendation: 'Criar política de CA bloqueando todos os clientes de autenticação legada. Esses protocolos não suportam MFA.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/block-legacy-authentication',
  },
  {
    id: 'PRIVILEGED_EXCESS_GA',
    check: (r) => r.entraId?.collectors?.privileged?.summary?.globalAdminCount > 2,
    severity: 'high',
    category: 'Identidade',
    finding: (r) => `${r.entraId.collectors.privileged.summary.globalAdminCount} Global Administrators — excede o mínimo recomendado (2).`,
    recommendation: 'Reduzir Global Admins para no máximo 2-4 contas de emergência. Usar roles específicas (Exchange Admin, SharePoint Admin) para tarefas do dia a dia.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/best-practices',
  },
  {
    id: 'PRIVILEGED_GUEST_ADMIN',
    check: (r) => r.entraId?.collectors?.privileged?.summary?.guestPrivilegedCount > 0,
    severity: 'critical',
    category: 'Identidade',
    finding: (r) => `${r.entraId.collectors.privileged.summary.guestPrivilegedCount} conta(s) guest com roles administrativas.`,
    recommendation: 'Remover imediatamente roles privilegiadas de contas guest. Convidados externos não devem ter acesso administrativo.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/best-practices',
  },
  {
    id: 'GUESTS_INACTIVE',
    check: (r) => r.entraId?.collectors?.guests?.summary?.inactive > 0,
    severity: 'medium',
    category: 'Identidade',
    finding: (r) => `${r.entraId.collectors.guests.summary.inactive} convidado(s) externo(s) inativo(s) há mais de 90 dias.`,
    recommendation: 'Implementar revisão periódica de acesso (Access Reviews) para guests. Remover contas sem atividade nos últimos 90 dias.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/entra/id-governance/access-reviews-overview',
  },

  // ── SharePoint / Permissões ───────────────────────────────────────────────
  {
    id: 'SHARING_ANONYMOUS_LINKS',
    check: (r) => r.sharePoint?.collectors?.permissions?.summary?.anonymousLinksAllowed === true,
    severity: 'critical',
    category: 'Dados',
    finding: 'Links anônimos habilitados no tenant — qualquer usuário pode compartilhar arquivos sem autenticação.',
    recommendation: 'Restringir sharing para "New and existing guests" (autenticado) ou "Only people in your organization". Se links anônimos forem necessários, configurar expiração máxima de 7 dias.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off',
  },
  {
    id: 'SHARING_NO_EXPIRATION',
    check: (r) => {
      const s = r.sharePoint?.collectors?.permissions?.summary;
      return s?.anonymousLinksAllowed && s?.anonymousLinkExpirationDays === 'none';
    },
    severity: 'critical',
    category: 'Dados',
    finding: 'Links anônimos sem expiração — links criados permanecem válidos indefinidamente.',
    recommendation: 'Configurar expiração obrigatória de links anônimos (máximo 7 dias) no SharePoint Admin Center.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off',
  },
  {
    id: 'SHARING_EXTERNAL_HIGH',
    check: (r) => r.sharePoint?.collectors?.permissions?.summary?.sharingCapability === 'externalUserAndGuestSharing',
    severity: 'high',
    category: 'Dados',
    finding: 'Sharing externo no nível mais permissivo (Anyone) — risco alto de vazamento via Copilot.',
    recommendation: 'Reduzir para "New and existing guests" no mínimo. Copilot indexa conteúdo acessível por links — dados superexpostos aparecem nas respostas.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-privacy',
  },

  {
    id: 'OVERSHARING_EVERYONE',
    check: (r) => {
      const s = r.sharePoint?.collectors?.oversharing;
      return s && !s.unavailable && s.summary?.sitesWithEveryoneCount > 0;
    },
    severity: 'critical',
    category: 'Dados',
    finding: (r) => {
      const count = r.sharePoint.collectors.oversharing.summary.sitesWithEveryoneCount;
      const sampled = r.sharePoint.collectors.oversharing.summary.sitesSampled;
      return `${count} site(s) (de ${sampled} amostrados) com permissão atribuída ao grupo "Everyone" ou "Everyone except external users" — todos os usuários do tenant têm acesso automático a esse conteúdo.`;
    },
    recommendation: 'Remover permissões dos grupos Everyone dos sites afetados e substituir por grupos de segurança específicos. O Copilot amplifica o oversharing interno: documentos antes "perdidos" passam a ser descobertos e entregues pela IA a qualquer colaborador que perguntar.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/manage-site-collection-administrators',
  },

  // ── SharePoint / OneDrive ─────────────────────────────────────────────────
  {
    id: 'ONEDRIVE_MORE_PERMISSIVE',
    check: (r) => r.sharePoint?.collectors?.permissions?.summary?.oneDriveMorePermissive === true,
    severity: 'high',
    category: 'Dados',
    finding: (r) => {
      const { sharingCapability, oneDriveSharingCapability } = r.sharePoint.collectors.permissions.summary;
      return `OneDrive (${oneDriveSharingCapability}) configurado mais permissivo que SharePoint (${sharingCapability}) — arquivos pessoais de trabalho expostos mesmo com SharePoint restrito.`;
    },
    recommendation: 'Alinhar as configurações de sharing do OneDrive for Business ao nível do SharePoint no SharePoint Admin Center > Policies > Sharing. Arquivos do OneDrive são fonte de contexto prioritária do Copilot.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off',
  },

  // ── SharePoint / Ownership ────────────────────────────────────────────────
  {
    id: 'OWNERSHIP_DISABLED_OWNER',
    check: (r) => r.sharePoint?.collectors?.ownership?.summary?.disabledOwnerCount > 0,
    severity: 'high',
    category: 'Dados',
    finding: (r) => `${r.sharePoint.collectors.ownership.summary.disabledOwnerCount} site(s) cujo(s) único(s) owner(s) são contas desativadas (usuários desligados).`,
    recommendation: 'Atribuir novos responsáveis a esses sites imediatamente. Sites de ex-funcionários sem dono válido acumulam dados fora de qualquer governança.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/manage-site-collection-owners',
  },
  {
    id: 'OWNERSHIP_OWNERLESS_SITES',
    check: (r) => r.sharePoint?.collectors?.ownership?.summary?.ownerlessCount > 0,
    severity: 'medium',
    category: 'Dados',
    finding: (r) => `${r.sharePoint.collectors.ownership.summary.ownerlessCount} site(s) sem nenhum owner configurado.`,
    recommendation: 'Definir responsável para todos os sites. Sites sem owner não têm ponto de contato para revisão de acesso ou incidentes de segurança.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/manage-site-collection-owners',
  },

  // ── SharePoint / Conteúdo Obsoleto ────────────────────────────────────────
  {
    id: 'STALE_SITES_HIGH',
    check: (r) => {
      const s = r.sharePoint?.collectors?.staleContent?.summary;
      return s && s.staleRatioPercent > 30;
    },
    severity: 'high',
    category: 'Dados',
    finding: (r) => `${r.sharePoint.collectors.staleContent.summary.staleRatioPercent}% dos sites sem atividade há mais de ${r.sharePoint.collectors.staleContent.summary.stalePeriodDays} dias.`,
    recommendation: 'Implementar processo de revisão e higienização: arquivar, deletar ou reassociar ownership de sites inativos. Sites abandonados são vetores de risco para Copilot.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/governance/it-governance-in-sharepoint',
  },
  {
    id: 'STALE_SITES_MEDIUM',
    check: (r) => {
      const s = r.sharePoint?.collectors?.staleContent?.summary;
      return s && s.staleRatioPercent > 10 && s.staleRatioPercent <= 30;
    },
    severity: 'medium',
    category: 'Dados',
    finding: (r) => `${r.sharePoint.collectors.staleContent.summary.staleSiteCount} site(s) sem atividade há mais de ${r.sharePoint.collectors.staleContent.summary.stalePeriodDays} dias.`,
    recommendation: 'Revisar sites inativos: atribuir novo responsável, arquivar ou deletar. Estabelecer política de ciclo de vida para sites SharePoint.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/governance/it-governance-in-sharepoint',
  },

  // ── SharePoint / Arquivos ─────────────────────────────────────────────────
  {
    id: 'FILES_LARGE_VOLUME',
    check: (r) => {
      const s = r.sharePoint?.collectors?.files?.summary;
      return s && !r.sharePoint?.collectors?.files?.unavailable && s.largeFilesCount > 20;
    },
    severity: 'medium',
    category: 'Dados',
    finding: (r) => `${r.sharePoint.collectors.files.summary.largeFilesCount} arquivos acima de 100MB detectados nos sites de maior volume.`,
    recommendation: 'Revisar arquivos grandes: verificar se são backups, vídeos ou mídia pessoal inapropriada para SharePoint. Migrar para armazenamento adequado (Azure Blob, Stream).',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/manage-site-collection-storage',
  },
  {
    id: 'FILES_LARGE_DETECTED',
    check: (r) => {
      const s = r.sharePoint?.collectors?.files?.summary;
      return s && !r.sharePoint?.collectors?.files?.unavailable && s.largeFilesCount > 0 && s.largeFilesCount <= 20;
    },
    severity: 'low',
    category: 'Dados',
    finding: (r) => `${r.sharePoint.collectors.files.summary.largeFilesCount} arquivo(s) acima de 100MB detectado(s).`,
    recommendation: 'Verificar finalidade dos arquivos grandes e se é o armazenamento correto para esse tipo de conteúdo.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/manage-site-collection-storage',
  },
  {
    id: 'FILES_DUPLICATES',
    check: (r) => {
      const s = r.sharePoint?.collectors?.files?.summary;
      return s && !r.sharePoint?.collectors?.files?.unavailable && s.duplicateGroupsCount > 0 && s.estimatedWastedBytes > 50 * 1024 * 1024;
    },
    severity: 'low',
    category: 'Dados',
    finding: (r) => {
      const wasted = Math.round(r.sharePoint.collectors.files.summary.estimatedWastedBytes / (1024 * 1024));
      return `${r.sharePoint.collectors.files.summary.duplicateGroupsCount} grupo(s) de arquivos duplicados detectados — ~${wasted} MB desperdiçados (amostra).`;
    },
    recommendation: 'Implementar processo de deduplicação e orientar usuários a usar links em vez de cópias. Duplicatas dificultam gestão de versões e aumentam o custo de storage.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/manage-site-collection-storage',
  },
  {
    id: 'FILES_STALE_HIGH',
    check: (r) => {
      const s = r.sharePoint?.collectors?.files?.summary;
      return s && !r.sharePoint?.collectors?.files?.unavailable && s.staleFilesRatioPercent > 40;
    },
    severity: 'medium',
    category: 'Dados',
    finding: (r) => `${r.sharePoint.collectors.files.summary.staleFilesRatioPercent}% dos arquivos amostrados sem modificação há mais de ${r.sharePoint.collectors.files.summary.stalePeriodMonths} meses.`,
    recommendation: 'Implementar política de retenção e higienização de conteúdo obsoleto. Conteúdo estagnado indexado pelo Copilot gera respostas desatualizadas e ruído nas buscas.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/microsoft-365/compliance/retention',
  },

  // ── Governança / DLP ─────────────────────────────────────────────────────
  {
    id: 'DLP_COPILOT_MANUAL_REVIEW',
    check: (r) => r.governance?.collectors?.dlp?.unavailable === true,
    severity: 'high',
    category: 'Governança',
    finding: 'Cobertura DLP para Copilot não pode ser verificada automaticamente — Microsoft Graph não expõe políticas DLP do Purview via Application permission.',
    recommendation: 'Verificar manualmente no Microsoft Purview se existe política DLP com workload "Copilot for Microsoft 365". Se não houver, criar uma definindo quais tipos de informação sensível (CPF, cartão, PII) o Copilot não pode processar ou exibir. Acesso programático apenas via Security & Compliance PowerShell (Get-DlpCompliancePolicy).',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/purview/dlp-microsoft365-copilot',
  },

  // ── Governança / Retenção ────────────────────────────────────────────────
  {
    id: 'RETENTION_NO_EXCHANGE',
    check: (r) => {
      const ret = r.governance?.collectors?.retentionPolicies;
      return ret && !ret.unavailable && ret.summary?.exchangeRetentionConfigured === false;
    },
    severity: 'high',
    category: 'Governança',
    finding: 'Nenhuma política de retenção cobre o Exchange (e-mail) — mensagens não têm garantia de preservação para compliance e o Copilot pode usar contexto de e-mails que deveriam ter sido excluídos.',
    recommendation: 'Criar política de retenção no Purview para Exchange com período mínimo definido conforme política de compliance da organização (ex: 1 ano para e-mails corporativos).',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/purview/create-retention-policies',
  },
  {
    id: 'RETENTION_NO_TEAMS',
    check: (r) => {
      const ret = r.governance?.collectors?.retentionPolicies;
      return ret && !ret.unavailable && ret.summary?.teamsRetentionConfigured === false;
    },
    severity: 'medium',
    category: 'Governança',
    finding: 'Nenhuma política de retenção cobre mensagens do Teams — conversas e canais sem ciclo de vida definido.',
    recommendation: 'Criar política de retenção no Purview para Teams (channel messages e chats). Teams é fonte primária de contexto do Copilot — sem retenção, dados históricos relevantes podem ser perdidos.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/purview/create-retention-policies',
  },

  // ── Identidade / Contas Inativas ─────────────────────────────────────────
  {
    id: 'INACTIVE_ENABLED_USERS',
    check: (r) => {
      const count = r.baseline?.collectors?.users?.summary?.inactiveEnabledUsersCount;
      return count != null && count > 0;
    },
    severity: 'medium',
    category: 'Identidade',
    finding: (r) => {
      const count = r.baseline.collectors.users.summary.inactiveEnabledUsersCount;
      const days = r.baseline.collectors.users.summary.inactivePeriodDays;
      return `${count} usuário(s) interno(s) habilitado(s) sem login há mais de ${days} dias — contas de ex-funcionários ou contas de serviço abandonadas.`;
    },
    recommendation: 'Implementar revisão periódica de contas inativas: desabilitar ou excluir contas sem atividade em 90 dias. Contas ativas comprometidas com acesso ao Copilot são vetor de exfiltração com permissões acumuladas.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/entra/id-governance/access-reviews-overview',
  },

  // ── Identidade / PIM ─────────────────────────────────────────────────────
  {
    id: 'PRIVILEGED_NO_PIM',
    check: (r) => {
      const s = r.entraId?.collectors?.privileged?.summary;
      return s && s.pimAvailable === true && s.eligibleAdminCount === 0;
    },
    severity: 'high',
    category: 'Identidade',
    finding: 'Roles privilegiadas permanentes sem Privileged Identity Management (PIM) — Global Admins com acesso 24/7 são vetor de risco crítico para o Copilot.',
    recommendation: 'Converter roles permanentes em elegíveis via PIM (Entra ID P2). Global Admin deve ser just-in-time: o administrador solicita elevação, usa a permissão com prazo limitado e ela expira automaticamente.',
    effort: 'high',
    reference: 'https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure',
  },
  {
    id: 'PRIVILEGED_PIM_UNAVAILABLE',
    check: (r) => r.entraId?.collectors?.privileged?.summary?.pimAvailable === false,
    severity: 'medium',
    category: 'Identidade',
    finding: 'Privileged Identity Management (PIM) indisponível — Entra ID P2 não licenciado. Roles privilegiadas não têm controle just-in-time.',
    recommendation: 'Avaliar licenciamento Entra ID P2 para habilitar PIM, Identity Protection e Access Reviews. Essencial para tenants que pretendem implantar o Copilot com governança avançada.',
    effort: 'high',
    reference: 'https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure',
  },

  // ── Adoção / M365 Apps ───────────────────────────────────────────────────
  {
    id: 'APPS_LOW_DESKTOP_DEPLOYMENT',
    check: (r) => {
      const apps = r.baseline?.collectors?.appsChannel;
      return apps && !apps.unavailable && (apps.summary?.desktopPercent ?? 100) < 60;
    },
    severity: 'high',
    category: 'Adoção',
    finding: (r) => {
      const { desktopPercent, totalUsers, eligibleLicenseUsers, desktopUsersCount, windowsUsersCount, macUsersCount } = r.baseline.collectors.appsChannel.summary;
      const denominator = eligibleLicenseUsers || totalUsers;
      const installed = desktopUsersCount ?? ((windowsUsersCount ?? 0) + (macUsersCount ?? 0));
      return `Apenas ${desktopPercent}% (${installed} de ${denominator}) dos usuários com licença que dá direito à instalação utilizam M365 Apps em desktop — Copilot requer cliente desktop (não disponível via web apenas).`;
    },
    recommendation: 'Garantir que usuários que precisarão do Copilot tenham M365 Apps instalado no desktop. Verificar também no Intune se as instalações estão no Current Channel ou Monthly Enterprise Channel — Semi-Annual Channel não suporta Copilot.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/microsoft-365/admin/misc/microsoft-365-copilot-requirements',
  },

  // ── Extensibilidade / Copilot Plugins ────────────────────────────────────
  {
    id: 'COPILOT_MANY_CONNECTORS',
    check: (r) => {
      const ext = r.governance?.collectors?.copilotExtensions;
      return ext && !ext.unavailable && (ext.summary?.activeConnectionsCount ?? 0) > 5;
    },
    severity: 'medium',
    category: 'Governança',
    finding: (r) => {
      const count = r.governance.collectors.copilotExtensions.summary.activeConnectionsCount;
      return `${count} Graph Connectors ativos — o Copilot pode combinar dados de sistemas externos sem controles de privacidade específicos para IA.`;
    },
    recommendation: 'Revisar e documentar cada Graph Connector ativo. Verificar no Microsoft 365 Admin Center > Settings > Integrated apps se plugins de terceiros estão controlados. Definir política de aprovação para novos conectores.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/microsoftsearch/connectors-overview',
  },

  // ── Governança de Dados / Sensitivity Labels ──────────────────────────────
  {
    id: 'GOV_NO_SENSITIVITY_LABELS',
    check: (r) => {
      const c = r.governance?.collectors?.sensitivityLabels;
      return c && !c.unavailable && c.summary?.totalLabels === 0;
    },
    severity: 'critical',
    category: 'Governança',
    finding: 'Nenhum Sensitivity Label configurado no tenant — dados não classificados.',
    recommendation: 'Criar taxonomia de classificação no Microsoft Purview: mínimo 3 labels (Público, Interno, Confidencial). Sem labels, Copilot não tem contexto de sensibilidade para filtrar respostas.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/purview/sensitivity-labels',
  },
  {
    id: 'GOV_FEW_SENSITIVITY_LABELS',
    check: (r) => {
      const c = r.governance?.collectors?.sensitivityLabels;
      return c && !c.unavailable && c.summary?.totalLabels > 0 && c.summary?.sublabelCount === 0;
    },
    severity: 'high',
    category: 'Governança',
    finding: (r) => `${r.governance.collectors.sensitivityLabels.summary.totalLabels} label(s) sem estrutura hierárquica — taxonomia incompleta para classificação corporativa.`,
    recommendation: 'Evoluir para estrutura pai/sublabel (ex: Confidencial > Confidencial/RH, Confidencial/Financeiro). Habilitar auto-labeling para documentos que contêm dados sensíveis (CPF, cartão).',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/purview/sensitivity-labels#sublabels-grouping-labels',
  },
  {
    id: 'GOV_NO_AUDIT',
    check: (r) => {
      const c = r.governance?.collectors?.audit;
      return c && !c.unavailable && c.summary?.recentEventsFound === 0;
    },
    severity: 'high',
    category: 'Governança',
    finding: 'Nenhum evento de auditoria encontrado nos últimos 30 dias — Unified Audit Log pode estar inativo.',
    recommendation: 'Verificar se o Unified Audit Log está habilitado no Microsoft Purview > Audit. Sem auditoria, investigações de incidentes e compliance são impossíveis.',
    effort: 'low',
    reference: 'https://learn.microsoft.com/en-us/purview/audit-solutions-overview',
  },

  // ── IA Readiness / Copilot ───────────────────────────────────────────────
  {
    id: 'IA_CRITICAL_BLOCKERS',
    check: (r) => r.iaReadiness?.summary?.criticalBlockers > 0,
    severity: 'critical',
    category: 'IA Readiness',
    finding: (r) => {
      const names = r.iaReadiness.blockers
        .filter((b) => b.impact === 'critical')
        .map((b) => b.label)
        .join('; ');
      return `Copilot bloqueado por ${r.iaReadiness.summary.criticalBlockers} risco(s) crítico(s): ${names}.`;
    },
    recommendation: 'Resolver os bloqueadores críticos antes de avançar com implantação do Copilot. Links anônimos e baixa cobertura MFA são os vetores mais explorados para exfiltração de dados via IA.',
    effort: 'high',
    reference: 'https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-requirements',
  },
  {
    id: 'IA_NOT_READY',
    check: (r) => r.iaReadiness && !r.iaReadiness.copilotReady,
    severity: 'high',
    category: 'IA Readiness',
    finding: (r) => `Prontidão para Copilot: "${r.iaReadiness.readinessLevel}" — ${r.iaReadiness.summary.passedCount}/${r.iaReadiness.summary.totalChecks} pré-requisitos atendidos.`,
    recommendation: 'Implementar os pré-requisitos não atendidos para garantir que o Copilot opere sobre dados bem governados, com identidades protegidas e exposição controlada.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-requirements',
  },
  {
    id: 'IA_DATA_EXPOSURE_RISK',
    check: (r) => {
      const anonLinks = r.sharePoint?.collectors?.permissions?.summary?.anonymousLinksAllowed;
      const noLabels = r.governance?.collectors?.sensitivityLabels?.unavailable ||
        r.governance?.collectors?.sensitivityLabels?.summary?.totalLabels === 0;
      return anonLinks && noLabels;
    },
    severity: 'critical',
    category: 'IA Readiness',
    finding: 'Combinação de risco máximo: links anônimos habilitados + ausência de Sensitivity Labels — Copilot pode expor dados sensíveis sem nenhum controle de classificação.',
    recommendation: 'Desabilitar links anônimos imediatamente e iniciar taxonomia de Sensitivity Labels no Purview. Essa combinação é o pior cenário para implantação de IA generativa.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/purview/sensitivity-labels-teams-groups-sites',
  },
  {
    id: 'IA_IDENTITY_BASELINE_MISSING',
    check: (r) => {
      const mfaLow = r.entraId?.collectors?.mfa && !r.entraId.collectors.mfa.unavailable &&
        r.entraId.collectors.mfa.summary?.coveragePercent < 80;
      const noCA = r.entraId?.collectors?.conditionalAccess && !r.entraId.collectors.conditionalAccess.unavailable &&
        r.entraId.collectors.conditionalAccess.summary?.enabled === 0;
      return mfaLow && noCA;
    },
    severity: 'critical',
    category: 'IA Readiness',
    finding: 'Baseline de identidade ausente: MFA < 80% e nenhuma política de Conditional Access — identidades não protegidas antes de habilitar Copilot.',
    recommendation: 'Priorizar MFA obrigatório via Conditional Access antes de qualquer implantação de Copilot. Contas comprometidas com acesso ao Copilot são vetor direto de exfiltração.',
    effort: 'high',
    reference: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-all-users-mfa',
  },

  // ── SharePoint / Storage ──────────────────────────────────────────────────
  {
    id: 'STORAGE_CONCENTRATED',
    check: (r) => {
      const s = r.sharePoint?.collectors?.storage?.summary;
      return s && !r.sharePoint?.collectors?.storage?.unavailable && s.top20PercentStoragePercent > 85;
    },
    severity: 'medium',
    category: 'Dados',
    finding: (r) => `Top 20% dos sites concentram ${r.sharePoint.collectors.storage.summary.top20PercentStoragePercent}% do armazenamento total — crescimento descontrolado.`,
    recommendation: 'Implementar cotas por site e revisão de crescimento. Concentração excessiva indica falta de governança de dados e dificulta o controle de acesso granular.',
    effort: 'medium',
    reference: 'https://learn.microsoft.com/en-us/sharepoint/manage-site-collection-storage',
  },

  // ── Adoção (MAU) ─────────────────────────────────────────────────────────
  {
    id: 'ADOPTION_LOW_OVERALL',
    check: (r) => {
      const u = r.baseline?.collectors?.usage;
      return u && !u.unavailable && u.summary?.adoptionPercent < 50;
    },
    severity: 'high',
    category: 'Adoção',
    finding: (r) => {
      const { adoptionPercent, m365Active, m365Total } = r.baseline.collectors.usage.summary;
      return `Apenas ${adoptionPercent}% dos usuários M365 ativos (${m365Active.toLocaleString('pt-BR')} de ${m365Total.toLocaleString('pt-BR')}) nos últimos 30 dias — adoção crítica.`;
    },
    recommendation: 'Iniciar programa de adoção: identificar barreiras por equipe, capacitar campeões e criar plano de migração por serviço. Licenças pagas sem uso representam custo direto e bloqueiam ROI do Copilot.',
    effort: 'high',
  },
  {
    id: 'ADOPTION_TEAMS_LOW',
    check: (r) => {
      const svc = r.baseline?.collectors?.usage?.summary?.services?.teams;
      return svc && svc.adoptionPercent !== null && svc.adoptionPercent < 50;
    },
    severity: 'medium',
    category: 'Adoção',
    finding: (r) => `Teams com ${r.baseline.collectors.usage.summary.services.teams.adoptionPercent}% de adoção — colaboração não migrou completamente para M365.`,
    recommendation: 'Teams é o hub central do Copilot. Baixa adoção indica uso de alternativas (Zoom, Slack). Definir Teams como padrão corporativo e migrar reuniões e canais.',
    effort: 'medium',
  },

  // ── Risky Users ───────────────────────────────────────────────────────────
  {
    id: 'RISKY_USERS_HIGH',
    check: (r) => {
      const u = r.entraId?.collectors?.riskyUsers;
      return u && !u.unavailable && (u.summary.highRisk > 0 || u.summary.confirmedCompromised > 0);
    },
    severity: 'critical',
    category: 'Identidade',
    finding: (r) => {
      const s = r.entraId.collectors.riskyUsers.summary;
      return `${s.highRisk + s.confirmedCompromised} usuário(s) de risco alto ou comprometidos detectados pelo Identity Protection.`;
    },
    recommendation: 'Investigar imediatamente as contas sinalizadas. Forçar redefinição de senha, revogar sessões e revisar atividade recente. Habilitar política de risco de login no Conditional Access.',
    effort: 'high',
  },
  {
    id: 'RISKY_USERS_P2_MISSING',
    check: (r) => r.entraId?.collectors?.riskyUsers?.unavailable === true,
    severity: 'medium',
    category: 'Identidade',
    finding: () => 'Entra ID P2 não licenciado — Identity Protection indisponível. Usuários comprometidos não são detectados automaticamente.',
    recommendation: 'Avaliar licenciamento Entra ID P2 para habilitar Identity Protection, risk-based Conditional Access e SSPR com writeback.',
    effort: 'medium',
  },

  // ── Email Security ────────────────────────────────────────────────────────
  {
    id: 'EMAIL_SPF_MISSING',
    check: (r) => r.emailSecurity?.collectors?.spf?.summary?.present === false,
    severity: 'high',
    category: 'Email Security',
    finding: (r) => `Domínio ${r.emailSecurity.checkedDomain} sem registro SPF. Permite spoofing de e-mail em nome da organização.`,
    recommendation: 'Publicar registro SPF no DNS: "v=spf1 include:spf.protection.outlook.com -all". Bloqueia servidores não autorizados de enviar e-mail pelo domínio.',
    effort: 'low',
  },
  {
    id: 'EMAIL_SPF_PASSALL',
    check: (r) => r.emailSecurity?.collectors?.spf?.summary?.qualifier === '+all',
    severity: 'high',
    category: 'Email Security',
    finding: (r) => `SPF de ${r.emailSecurity.checkedDomain} configurado com +all — qualquer servidor pode enviar e-mail como a organização.`,
    recommendation: 'Alterar qualifier para -all (rejeitar) ou ~all (soft fail). Nunca usar +all.',
    effort: 'low',
  },
  {
    id: 'EMAIL_DMARC_MISSING',
    check: (r) => r.emailSecurity?.collectors?.dmarc?.summary?.present === false,
    severity: 'high',
    category: 'Email Security',
    finding: (r) => `Domínio ${r.emailSecurity.checkedDomain} sem registro DMARC. Sem política de tratamento para e-mails que falham SPF/DKIM.`,
    recommendation: 'Publicar registro DMARC com p=none para monitoramento, evoluindo para p=quarantine e p=reject. Incluir rua= para relatórios de falha.',
    effort: 'low',
  },
  {
    id: 'EMAIL_DMARC_NONE_POLICY',
    check: (r) => r.emailSecurity?.collectors?.dmarc?.summary?.policy === 'none',
    severity: 'medium',
    category: 'Email Security',
    finding: (r) => `DMARC de ${r.emailSecurity.checkedDomain} com p=none — modo monitoramento apenas, sem proteção efetiva contra spoofing.`,
    recommendation: 'Evoluir política DMARC para p=quarantine após validar relatórios, depois p=reject. Define postura ativa de proteção.',
    effort: 'low',
  },
  {
    id: 'EMAIL_DKIM_NOT_CONFIGURED',
    check: (r) => {
      const d = r.emailSecurity?.collectors?.dkim?.summary;
      return d && !d.configured;
    },
    severity: 'medium',
    category: 'Email Security',
    finding: (r) => `DKIM do Exchange Online não detectado para ${r.emailSecurity.checkedDomain} (seletores selector1/selector2 ausentes no DNS).`,
    recommendation: 'Habilitar DKIM no Exchange Admin Center > Email authentication e publicar os registros CNAME no DNS do domínio.',
    effort: 'low',
  },
];

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function generateRecommendations(assessmentResult) {
  const triggered = [];

  for (const rule of RULES) {
    try {
      if (!rule.check(assessmentResult)) continue;

      const finding = typeof rule.finding === 'function'
        ? rule.finding(assessmentResult)
        : rule.finding;

      triggered.push({
        id: rule.id,
        severity: rule.severity,
        category: rule.category,
        finding,
        recommendation: rule.recommendation,
        effort: rule.effort,
        reference: rule.reference,
      });
    } catch {
      // rule check threw (missing data) — skip silently
    }
  }

  triggered.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const bySeverity = triggered.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});

  return { total: triggered.length, bySeverity, items: triggered };
}

module.exports = { generateRecommendations };
