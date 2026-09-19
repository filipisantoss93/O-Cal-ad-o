# Google Places (New) — configuração do O Calçadão

## Finalidade e limites

- O Google Places pode identificar um estabelecimento por **Place ID** e atender consultas pontuais autorizadas. Place IDs podem ser mantidos no cadastro.
- **Não** usar as coordenadas obtidas no Google para preencher definitivamente `public.businesses.latitude` e `longitude`. Os termos atuais do Google Maps Platform limitam, em regra, a retenção das coordenadas obtidas no Places a 30 dias. O worker `geocode-businesses` não usa o Google como fonte de coordenadas permanentes.
- Os recursos de distância e busca por proximidade continuarão a depender de coordenadas próprias, verificadas ou obtidas de provedores cuja licença permita armazenamento permanente.
- A variável `GOOGLE_RATINGS_ENABLED` permanece `false` até haver controle adicional de custo e acesso público. Rating e userRatingCount acionam Place Details Enterprise.

## Ação do responsável pela conta Google Cloud

1. Acessar https://console.cloud.google.com/ e criar ou selecionar um projeto dedicado a O Calçadão.
2. Associar uma conta de faturamento a esse projeto e ativar **Places API (New)** (`places.googleapis.com`).
3. Em **APIs e serviços > Credenciais**, criar uma chave exclusiva para **uso no servidor**. Restringir a chave à Places API (New). Não utilizar restrições de site/referer para essa chave, pois a chamada sai do servidor; avaliar saída por IP fixo/proxy para permitir restrição de IP (Vercel pode ter IP dinâmico).
4. Em Google Maps Platform > Cotas, definir limites pequenos para o piloto; em Faturamento, configurar alertas. Alertas de orçamento **não** impedem cobranças, por isso também limitar a cota da API.
5. Em Vercel > projeto `o-cal-ad-o` > Settings > Environment Variables, cadastrar a chave como `GOOGLE_PLACES_API_KEY`, ambiente **Production**, marcada como secreta/sensível quando disponível. **Nunca** utilizar prefixo `NEXT_PUBLIC_`, colocar a chave em código, GitHub, prints ou mensagens de chat.
6. Manter `GOOGLE_RATINGS_ENABLED=false`; implantar uma **nova versão** de produção para que as variáveis tenham efeito.
7. Validar um único resultado de Places em um fluxo **sob autenticação** antes de ampliar o uso. Nenhum agendamento ou importação em massa do Google é autorizado por esta configuração.

## Implementação presente no código

- `src/app/api/internal/geocode-business/route.ts` chama `places:searchText` via servidor, usa nome e endereço para filtrar os candidatos, confere cidade, UF, rua e número e retorna dados de um resultado pontual. A rota exige o token interno `X-Geocoding-Token`.
- `src/app/api/google-ratings/route.ts` consulta Place Details para ratings somente quando habilitada separadamente; manter desabilitada durante o piloto.
- `supabase/functions/geocode-businesses/index.ts` processa a fila de geocodificação permanente usando fontes não Google; não transforma resultados Google em coordenadas persistidas.

Referências oficiais: https://developers.google.com/maps/documentation/places/web-service/get-api-key ; https://cloud.google.com/maps-platform/terms/maps-service-terms ; https://developers.google.com/maps/documentation/places/web-service/data-fields ; https://developers.google.com/maps/documentation/places/web-service/place-id .
