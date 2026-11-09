# Relatório Alleman

Preciso construir o backend de um dashboard de marketing. Faça isso em 3 partes, 

nesta ordem:

PARTE 1 - TABELA

Crie uma tabela chamada "utm_conversions" com estas colunas:

bitrix_deal_id (texto, único/not null), titulo (texto), fase (texto), 

valor (número), origem (texto), utm_source (texto), utm_medium (texto), 

utm_campaign (texto), utm_content (texto), utm_term (texto), dominio (texto), 

url_pagina (texto), id_formulario (texto), nome_formulario (texto), 

adset_id (texto), ad_id (texto), ad_name (texto), adset_name (texto), 

campaign_name (texto), placement (texto), site_source_name (texto), 

fbclid (texto), data_criacao (data/hora), synced_at (data/hora, padrão agora).

PARTE 2 - EDGE FUNCTION

Crie uma Edge Function chamada "sync-bitrix-deals" com o código abaixo. Ela 

usa uma variável de ambiente chamada BITRIX_WEBHOOK_URL, que eu vou configurar 

manualmente depois em Secrets - não precisa se preocupar com isso, só criar 

a função:

[COLE AQUI O CONTEÚDO COMPLETO DO ARQUIVO sync-bitrix-deals.ts]

PARTE 3 - DASHBOARD

Crie um dashboard de performance de marketing conectado à tabela "utm_conversions". 

[... cole aqui o prompt do dashboard que já te passei antes ...]

Depois de criar essas 3 partes, me avise que preciso configurar um secret antes 

de testar a função de sincronização.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://relatorioalleman.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6115f0d2-be3e-41c0-a5ba-832817927e82).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
