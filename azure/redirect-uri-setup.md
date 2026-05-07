# Configurar redirect URI para o subdomínio

A plataforma agora atende em `https://assessment.plantaoti.com.br`. Para o fluxo de admin consent funcionar pelo novo domínio, é preciso atualizar duas coisas no Azure: a **App Registration** (lista branca de URIs aceitas) e o **App Service** (env var enviada na URL de consent).

## 1. App Registration → Authentication → Redirect URIs

Adicionar (sem remover os existentes, para não quebrar URLs antigas em trânsito):

```
https://assessment.plantaoti.com.br/auth/callback
```

**Via Azure Portal:**
Azure Portal → Azure Active Directory → App Registrations → [a App] → Authentication → Web → "Add URI"

**Via Azure CLI:**

```sh
az ad app update --id "$AZURE_CLIENT_ID" \
  --web-redirect-uris \
    "https://assessment.plantaoti.com.br/auth/callback" \
    "<colocar aqui as URIs antigas que ainda quer manter>"
```

## 2. App Service → Configuration → Application settings

Atualizar a env var `AZURE_REDIRECT_URI` para o novo domínio:

```
AZURE_REDIRECT_URI=https://assessment.plantaoti.com.br/auth/callback
```

**Via Azure CLI:**

```sh
az webapp config appsettings set \
  --name <app-service-name> \
  --resource-group <resource-group> \
  --settings AZURE_REDIRECT_URI=https://assessment.plantaoti.com.br/auth/callback
```

## 3. Reiniciar o App Service

```sh
az webapp restart --name <app-service-name> --resource-group <resource-group>
```

## Validação

1. Abrir `https://assessment.plantaoti.com.br/consent`
2. Gerar URL de consent para um tenant qualquer
3. Conferir que a URL gerada contém `redirect_uri=https%3A%2F%2Fassessment.plantaoti.com.br%2Fauth%2Fcallback`
4. Abrir a URL, fazer admin consent, conferir que o callback chega em `assessment.plantaoti.com.br/auth/callback` sem erro `AADSTS50011: Reply URL mismatch`
