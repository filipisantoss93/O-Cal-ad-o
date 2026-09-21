# Eletropostos extraídos do OpenStreetMap — São Paulo (SP)

Este diretório contém registros de **nós** com `amenity=charging_station`. Os registros de **vias/áreas** estão em `../eletropostos-sp-osm-ways/`. Foram obtidos a partir do extrato estadual disponibilizado em 21/09/2026 por [OpenStreetMap France](https://download.openstreetmap.fr/extracts/south-america/brazil/southeast/).

**Fonte:** © contribuidores do [OpenStreetMap](https://www.openstreetmap.org/copyright). **Licença da base e deste conjunto derivado:** [Open Database License 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). Os arquivos JSON resultantes permanecem disponíveis como base de dados aberta sob ODbL; estas condições não se confundem com a licença do código e dos outros cadastros independentes do O Calçadão.

Transformações: seleção dos objetos marcados `amenity=charging_station`, exclusão de acesso explicitamente privado, leitura dos campos de endereço e potência **somente quando presentes**, normalização de nomes de conectores, e arredondamento de coordenadas a sete casas decimais. Os centros dos registros de áreas são calculados a partir dos nós da respectiva geometria. A seleção para publicação ainda usa as fronteiras municipais de SP e remove possíveis duplicidades antes de copiar os campos pertinentes para a categoria Eletropostos.

**Limites:** o dia da extração não é a data da última inspeção física do carregador. Dados sobre funcionamento, acesso e potência podem estar ausentes, incorretos ou desatualizados. Não confundir o horário de funcionamento do estabelecimento com a disponibilidade em tempo real do carregador. Endereços incompletos não são preenchidos por suposição.
