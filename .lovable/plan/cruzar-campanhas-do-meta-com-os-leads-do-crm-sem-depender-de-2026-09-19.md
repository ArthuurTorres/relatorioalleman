# Cruzar campanhas do Meta com os leads do CRM — sem depender de campo novo no Bitrix

## Sim, tem caminho — e ele funciona

Testei agora com dados reais e o cruzamento é possível **hoje**, sem pedir nada ao time do CRM.

O Meta guarda, para cada lead de formulário, o **ID e o nome da campanha, do conjunto e do anúncio** junto com **nome, telefone e e-mail** da pessoa. O Bitrix guarda o mesmo telefone e e-mail no contato ligado ao negócio.

Conferência real que fiz (lead de 19/09):

- Meta: Angelita Lopes · +5512989133169 · angelita.aslc@hotmail.com · campanha "[VALE DO PARAÍBA][CADASTRO][AMIL] V2 - 15/09/2026"
- Bitrix: negócio 35757 · contato Angelita Lopes · +5512989133169 · mesmo e-mail

Ou seja: o **telefone** é a chave que faltava. Na página Alleman Corretora há 25+ formulários de lead com milhares de leads, todos com campanha identificada.

## Como vai funcionar

1. **Trazer os leads do Meta**: importo os leads de todos os formulários da página Alleman Corretora, com ID/nome de campanha, conjunto, anúncio, data e os dados de contato (telefone, e-mail, nome), além das respostas do formulário (cidade, vidas, hospital de preferência, faixa de investimento).
2. **Trazer o contato do negócio do Bitrix**: telefone e e-mail do contato ligado a cada negócio já importado.
3. **Cruzar automaticamente**, nesta ordem, sempre marcando como o casamento foi feito:
   - telefone normalizado (só dígitos, últimos 10–11 números, ignorando +55 e o nono dígito)
   - e-mail em minúsculas
   - nome idêntico + entrada no CRM até 7 dias depois do lead do Meta
   - sem correspondência → fica em "Campanha não identificada"
4. **Alimentar o que já existe**: a tabela de campanhas e o painel de funil por campanha que já estão no relatório passam a usar esse cruzamento em vez de depender do campo inexistente do Bitrix. Nada de layout novo.
5. **De/Para manual** continua disponível para os casos que sobrarem.

Contagem sempre distinta por negócio; investimento continua no nível da campanha.

## O que você vai ver mudar

- A tabela "Desempenho das campanhas" deixa de mostrar zeros nas colunas comerciais.
- Clicar numa campanha mostra os leads nominalmente com telefone, cidade, etapa atual no Bitrix, qualificação, venda e motivo de perda.
- Um indicador novo de qualidade do cruzamento: quantos leads casaram por telefone, por e-mail, por nome e quantos ficaram sem casar.

## Detalhes técnicos

- Migração: `meta_leads` (lead_id PK, form_id, campaign_id/name, adset_id/name, ad_id/name, created_time, nome, telefone_raw, telefone_norm, email, cidade, respostas jsonb, synced_at) com índices em telefone_norm/email/campaign_id; `meta_leads_forms` (id, name, page_id); colunas `contato_telefone`, `contato_telefone_norm`, `contato_email`, `contato_nome` em `utm_conversions`; tabela `lead_match` (bitrix_deal_id PK, meta_lead_id, campaign_id, match_source) materializando o cruzamento. GRANTs + RLS nos padrões atuais.
- Função SQL `norm_phone(text)` (immutable) para a normalização.
- Novo endpoint `src/routes/api/public/sync-meta-leads.ts`: page access token via `/me/accounts` filtrando a página Alleman, paginação de `/{page}/leadgen_forms` e `/{form}/leads` com cursor e `?days=N`, upsert idempotente.
- `sync-bitrix-deals.ts`: passa a buscar os contatos em lote (`crm.contact.list` por `ID` em blocos) e gravar telefone/e-mail normalizados no lead.
- RPC `rebuild_lead_match()` executada no fim de cada sync; `resolved_campaign_leads` passa a ler `lead_match` antes do De/Para e do nome exato — assim `get_campaign_crm_funnel` e `get_campaign_crm_leads` já existentes funcionam sem mudança de assinatura.
- Front: apenas acréscimo das colunas de contato/cidade na lista nominal do drawer e do bloco de qualidade do cruzamento; nenhum componente novo de página.
