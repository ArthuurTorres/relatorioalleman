# Cruzamento campanhas Meta × leads do Bitrix

## Primeiro: o campo que está faltando

Analisei as duas bases. **O Campaign ID não existe hoje nos leads do Bitrix.**

- Dos 14.038 negócios importados: **0** têm Campaign ID, Campaign Name, Ad ID, Adset ID, UTM de campanha ou fbclid. O único campo preenchido é a **Fonte** do CRM (ex.: "Alleman Insta", "Alleman Google", "WhatsApp - Atendimento").
- Verifiquei também os campos personalizados dos negócios direto no Bitrix (todos os `UF_CRM_*`) e a entidade de Leads: nenhum guarda campanha, conjunto ou anúncio.
- Do lado do Meta está tudo disponível: 160 campanhas, 215 conjuntos, 818 anúncios, com `campaign_id` como texto.

**O que precisa ser criado no Bitrix (por você ou pelo time do CRM):** um campo de texto no negócio para o **Campaign ID** (e, se possível, Adset ID, Ad ID e Campaign Name apenas para exibição), preenchido pela integração do formulário de Lead do Meta / Adveronix. Enquanto isso não existir, todo lead cai em **"Campanha não identificada"**.

Por isso a proposta abaixo entrega a estrutura completa já funcionando, pronta para preencher sozinha no momento em que o campo passar a chegar — e com o De/Para manual para atender os registros antigos.

## O que será adicionado (sem mexer no layout existente)

1. **Guardar a campanha no lead**: novas colunas de texto no cadastro de leads (`campaign_id`, `adset_id_meta`, `ad_id_meta`, `campaign_name_meta`), lidas da integração do Bitrix quando existirem. Campaign ID sempre como texto.
2. **Etapas do funil configuráveis**: tabela de/para das etapas do Bitrix → etapa do funil (Identificado, Qualificado, Tentativa de contato, Contatado, Negociação/Cotação, Venda, Perdido, Sem etapa). Já vou popular com a leitura dos funis reais do CRM: "1 a 5 vidas"/"+5 vidas" = qualificado; "Tentativa 1º/2º/3º dia" = tentativa; "Aguardando Informações"/"Aguardando Envio Estudo" = contatado; "Cotação Enviada"/"Aguardando Doc./Projeção" = negociação; "Enviado para Emissão" e as etapas de emissão/implantação = venda; "Declinado"/"Declínio"/perdas = perdido.
3. **De/Para manual de campanha**: tela pequena para ligar um rótulo de origem (ou nome exato de campanha) a uma campanha do Meta. Relacionamento automático só por Campaign ID; por nome apenas quando o nome for **exatamente igual**; nada de nomes parecidos.
4. **Colunas novas na tabela de campanhas que já existe**: leads gerados (Meta), leads encontrados no Bitrix, qualificados, tentativa, contatados, negociação, vendas, perdidos, sem etapa, taxa de identificação e taxa de aproveitamento (qualificados ÷ identificados).
5. **Clique na campanha**: painel lateral com o funil da campanha (reutilizando o componente de funil já existente) mostrando em cada etapa quantidade, % sobre o total da campanha, conversão sobre a etapa anterior e conversão acumulada — mais a lista nominal dos leads (nome, Deal ID, data de entrada, Campaign ID, Campaign Name, etapa atual, qualificação, status da venda, motivo de perda) com exportação.
6. **Linha "Campanha não identificada"** com os leads sem correspondência, para você resolver no De/Para.
7. Tudo respeita os filtros atuais (período, campanha, conjunto, anúncio, domínio/produto). Investimento continua no nível da campanha (não é multiplicado por lead) e a contagem de leads é distinta por Deal ID.

## Detalhes técnicos

- Migração: colunas de campanha em `utm_conversions`; tabela `bitrix_stage_map (stage_id, funnel_step, label)`; tabela `campaign_lead_map (label, campaign_id)` para o De/Para (ou extensão de `meta_lead_form_map`); GRANTs + RLS nos padrões atuais.
- `sync-bitrix-deals.ts`: passa a ler os campos de campanha do negócio quando configurados (lista de IDs de campo em um único lugar), mantendo o comportamento atual quando vierem vazios.
- Novas RPCs: `get_campaign_funnel(p_from, p_to, filtros)` (agregado por campanha, `count(distinct bitrix_deal_id)`) e `get_campaign_leads(p_campaign_id, p_from, p_to)` (lista nominal). Resolução: Campaign ID → De/Para manual → nome exato → "não identificada".
- Front: colunas extras em `CampaignsPerformance.tsx`, drawer novo reutilizando `CommercialFunnel.tsx`, e uma aba pequena para o De/Para. Sem alteração de layout, tema ou indicadores já existentes.
