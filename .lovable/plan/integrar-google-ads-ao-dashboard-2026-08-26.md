# Integrar Google Ads ao dashboard

## Objetivo
Conectar os dados reais da conta Google Ads já vinculada ao painel, sem alterar campanhas, conversões, banco de dados, Meta Ads, Bitrix, autenticação ou regras atuais.

## O que será exibido
- **Visão executiva:** investimento, conversões atribuídas e custo por conversão do Google Ads; o consolidado Geral passará a somar investimento Meta + Google.
- **Investimento e leads:** somar o investimento diário de Meta e Google, mantendo a linha de leads recebidos do Bitrix.
- **Comparativo por canal:** preencher investimento e CPL do Google com dados reais.
- **Desempenho das campanhas:** combinar campanhas Meta e Google na mesma tabela, mantendo busca, ordenação, exportação e paginação.
- **Aba Google Ads:** preservar o detalhamento atual de leads do Bitrix por domínio e acrescentar um resumo real da mídia Google por campanha e período.
- **Saúde das integrações:** mostrar o Google Ads como conectado quando a leitura estiver disponível e informar falhas sem simular funcionamento.

## Regra de leitura dos números
- **Investimento, cliques, impressões e conversões atribuídas:** Google Ads.
- **Leads recebidos, domínio, UTM e metas por operadora:** Bitrix, como hoje.
- Os rótulos deixarão explícito quando um número for uma conversão atribuída pelo Google, evitando apresentá-la como se fosse necessariamente o mesmo total de leads do Bitrix.
- Filtros de período e canal afetarão o Google Ads. Filtros de UTM e domínio continuarão sendo aplicados aos dados do Bitrix, pois não existem com a mesma granularidade no relatório da conta Google.

## Implementação
1. Criar um cliente server-only para consultar a conta Google Ads vinculada, com validação das datas, fuso de Brasília e mensagens de erro preservando o retorno real do provedor.
2. Criar uma função de servidor fina para buscar resumo, série diária e campanhas do Google Ads no intervalo selecionado.
3. Criar um painel de mídia Google reutilizável para a aba Google Ads.
4. Atualizar a Visão geral para combinar Google e Meta nos KPIs, gráfico, comparativo por canal e tabela de campanhas.
5. Atualizar o status das integrações com o resultado da leitura do Google Ads.
6. Manter as metas por operadora baseadas nos leads reais recebidos no Bitrix, sem substituir esses totais por conversões atribuídas da plataforma.

## Validação
- Verificar carregamento e troca de período no dashboard.
- Confirmar estados de loading, vazio e erro sem quebrar Meta ou Bitrix.
- Conferir responsividade e ausência de sobreposição em desktop e mobile.
- Comparar um intervalo recente com os totais retornados pela conta Google Ads.
