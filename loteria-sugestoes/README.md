# Sugestão de Apostas — Lotofácil & Mega-Sena

Site estático (HTML/CSS/JS puro, sem build) que sugere jogos para a **Mega-Sena**
e a **Lotofácil** (loterias da Caixa Econômica Federal), com base em estatísticas
de frequência histórica das dezenas sorteadas.

> ⚠️ **Aviso**: loteria é jogo de azar. Os sorteios são independentes e
> aleatórios — nenhuma estatística de frequência aumenta de fato a chance de
> acertar o próximo concurso. Este projeto tem fins educacionais.

## Funcionalidades

- Consulta o resultado mais recente de cada loteria em tempo real.
- Baixa o histórico completo de concursos e calcula a frequência de cada
  dezena (cacheado em `localStorage` por 6 horas para não pesar na API).
- Mostra as dezenas "quentes" (mais sorteadas) e "frias" (menos sorteadas).
- Gera jogos sugeridos com 4 estratégias:
  - **Equilibrado**: leve peso às dezenas mais frequentes, com checagem de
    proporção par/ímpar.
  - **Priorizar dezenas quentes**: sorteio ponderado pelas mais frequentes.
  - **Priorizar dezenas frias**: sorteio ponderado pelas menos frequentes.
  - **Totalmente aleatório**: sorteio uniforme, sem viés estatístico.

## Como rodar localmente

Não há dependências nem processo de build. Basta servir a pasta como
arquivos estáticos, por exemplo:

```bash
cd loteria-sugestoes
python3 -m http.server 8080
# depois abra http://localhost:8080
```

Ou simplesmente abra `index.html` diretamente no navegador.

## Deploy

Por ser 100% estático, pode ser publicado gratuitamente em:

- **GitHub Pages** (aponte para a pasta `loteria-sugestoes`)
- **Vercel** / **Netlify** (framework preset "Other"/estático)

## Fonte de dados

Os resultados são obtidos da API pública e gratuita
[`loteriascaixa-api`](https://github.com/guto-alves/loterias-api)
(`https://loteriascaixa-api.herokuapp.com/api`), que espelha os dados
divulgados oficialmente pela Caixa Econômica Federal. Essa API já responde
com cabeçalhos CORS abertos, então o site consome os dados diretamente do
navegador, sem precisar de um backend próprio.

Se preferir consumir a API oficial da Caixa diretamente (sem intermediários,
mas exigindo backend por causa de CORS/rate limit), os endpoints são:

```
https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/{concurso}
https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/{concurso}
```

## Repositórios de referência pesquisados no GitHub

Durante a pesquisa para este projeto, foram avaliados os seguintes
repositórios open source relacionados a loterias da Caixa — pode valer a
pena olhá-los para funcionalidades adicionais (ex.: apps mobile, CLI,
backends dedicados):

| Repositório | O que oferece |
| --- | --- |
| [guto-alves/loterias-api](https://github.com/guto-alves/loterias-api) e [isaccanedo/loterias-api](https://github.com/isaccanedo/loterias-api) | API REST gratuita (Spring Boot) com histórico de todas as loterias da Caixa — é a fonte de dados usada aqui. |
| [marcosoleniuk/loterias-api-golang](https://github.com/marcosoleniuk/loterias-api-golang) | Alternativa de API em Go, mesmo conceito. |
| [maickon/free-apiloterias](https://github.com/maickon/free-apiloterias) | Base de dados em arquivos JSON estáticos no GitHub, atualizada por concurso. |
| [GeraldoNeto/loterias-analise](https://github.com/GeraldoNeto/loterias-analise) | App React/Vite muito próximo do que foi pedido aqui: estatísticas + gerador ponderado por frequência. Boa referência de UX. |
| [schaedler6/Sidloto](https://github.com/schaedler6/sidloto) | Gerador de jogos da Lotofácil com backend Flask e filtros avançados (soma, pares, dezenas quentes/frias obrigatórias). |
| [4lessandrodev/loto-cli](https://github.com/4lessandrodev/loto-cli) | Ferramenta CLI em Python focada em cobertura combinatória (útil para gerar muitos jogos com diversificação). |
| [pliniou/loto-generator](https://github.com/pliniou/loto-generator) | App Android (Kotlin/Compose) offline-first, com conferência automática de resultados. |
| [LucasMoraesMarques/AppLoteria](https://github.com/LucasMoraesMarques/AppLoteria) | App de console em Python (pandas/numpy) para cadastro e geração de jogos. |

## Próximos passos sugeridos

- Adicionar mais loterias (Quina, Dupla Sena, Lotomania) reaproveitando a
  mesma `LOTTERY_CONFIG` em `assets/app.js`.
- Persistir jogos gerados e conferir automaticamente contra resultados
  futuros (como faz o `pliniou/loto-generator`).
- Adicionar filtros manuais (soma mínima/máxima, dezenas fixas/excluídas),
  como no `schaedler6/Sidloto`.
- Publicar via GitHub Pages/Vercel e configurar um domínio próprio.
