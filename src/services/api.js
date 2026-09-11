import { getBlob, getJson, postJson } from "./http";

export { BASE_URL, ApiError, clearApiCache } from "./http";

const MINUTO = 60_000;

/* -------------------------------------------------------------------------
   Farmacias
   ------------------------------------------------------------------------- */

/**
 * Lista de farmacias com id, nome e dominio.
 *
 * Existe para o front parar de manter mapa fixo de id->nome e id->dominio em
 * tres arquivos diferentes (ResultsTable, PriceHistoryFilter, ReportFilter),
 * que era como um dominio trocado na coleta passava meses sem chegar na tela.
 * Cache de 1h no servidor; 30min aqui.
 */
export const fetchFarmacias = (signal) =>
  getJson("farmacias", { signal, ttl: 30 * MINUTO });

/* -------------------------------------------------------------------------
   Precos
   ------------------------------------------------------------------------- */

/**
 * Preco mais recente de cada par (farmacia, produto), do mais barato pro mais
 * caro.
 *
 * Atencao ao contrato: no PrecoController os filtros sao `if/elseif/elseif` —
 * ean, senao descricao, senao farmacia. Mandar descricao E farmacia juntos
 * aplica so a descricao, em silencio e sem erro. Por isso esta funcao aceita um
 * criterio de busca so: nao ha como o chamador pedir um cruzamento que a API
 * fingiria atender. Se o backend passar a combinar filtros, e aqui que muda.
 */
export const fetchPrecos = (
  { query, searchType, perPage = 100 } = {},
  page = 1,
  signal,
) =>
  getJson("precos", {
    params: { page, per_page: perPage, ...(query ? { [searchType]: query } : {}) },
    signal,
    ttl: 5 * MINUTO,
  });

/** Teto por requisição no MercadoController. */
export const LOTE_MERCADO = 1000;

/**
 * Preço de mercado de uma lista de códigos de barras.
 *
 * Sobe só o EAN. A tabela de preço de quem está comparando nunca sai do
 * navegador — é dado comercial, e a comparação é uma conta que o cliente faz
 * sozinho depois de receber o mercado.
 *
 * Sem cache do `getJson`: a chave seria a lista inteira de EANs, que muda a
 * cada arquivo e encheria a memória com respostas que ninguém pede duas vezes.
 */
export const fetchMercado = (eans, signal) =>
  postJson("precos/mercado", { eans }, { signal });

export const fetchPriceHistory = (
  { query, searchType, startDate, endDate, farmacias = [] } = {},
  page = 1,
  signal,
) =>
  getJson("precos/historico", {
    params: {
      page,
      ...(query ? { [searchType]: query } : {}),
      ...(startDate ? { "data-inicio": startDate } : {}),
      ...(endDate ? { "data-fim": endDate } : {}),
      // Aqui `farmacia` combina com a busca — no historico o controller usa
      // `if` separado, nao `elseif`. E o unico endpoint em que combina.
      ...(farmacias.length ? { farmacia: farmacias.join(",") } : {}),
    },
    signal,
    ttl: 5 * MINUTO,
  });

/* -------------------------------------------------------------------------
   Relatorios
   ------------------------------------------------------------------------- */

/**
 * Filtros do relatório de aumentos e reduções, no formato do /precos/variacoes.
 *
 * O mesmo conjunto vai para a tela e para o export: é o que garante que o
 * arquivo baixado traga exatamente as linhas que estavam na tela. Valor padrão
 * não viaja — o servidor já assume "todos", "maior variação" e sem mínimo.
 */
const paramsVariacao = ({
  startDate,
  endDate,
  selectedPharmacies = [],
  tipo,
  variacaoMinima,
  ordem,
  incluirSuspeitas,
}) => ({
  ...(startDate ? { "data-inicio": startDate } : {}),
  ...(endDate ? { "data-fim": endDate } : {}),
  ...(selectedPharmacies.length
    ? { farmacia: selectedPharmacies.join(",") }
    : {}),
  ...(tipo && tipo !== "todos" ? { tipo } : {}),
  ...(Number(variacaoMinima) > 0 ? { variacao_minima: variacaoMinima } : {}),
  ...(ordem && ordem !== "variacao" ? { ordem } : {}),
  // O servidor olha a presença do parâmetro, não o valor.
  ...(incluirSuspeitas ? { incluir_suspeitas: 1 } : {}),
});

/**
 * Aumentos e reduções no período, cada um com a variação sobre o preço
 * anterior. Vem com `resumo` (contagens do período) além da página.
 */
export const fetchVariacoes = (filters, page = 1, signal) =>
  getJson("precos/variacoes", {
    params: { page, ...paramsVariacao(filters) },
    signal,
    ttl: 5 * MINUTO,
  });

export const fetchReportData = (filters, page = 1, signal) => {
  const { priceType, startDate, endDate, selectedPharmacies = [] } = filters;
  if (priceType === "variation") return fetchVariacoes(filters, page, signal);

  const historico = priceType === "historical";

  return getJson(historico ? "precos/historico" : "precos", {
    params: {
      page,
      ...(historico && startDate ? { "data-inicio": startDate } : {}),
      ...(historico && endDate ? { "data-fim": endDate } : {}),
      ...(selectedPharmacies.length
        ? { farmacia: selectedPharmacies.join(",") }
        : {}),
    },
    signal,
    ttl: 5 * MINUTO,
  });
};

/**
 * Exporta CSV/Excel montado pelo servidor.
 *
 * Aceita tambem `query`/`searchType` porque o /report/export ja valida `ean` e
 * `descricao` — so ninguem mandava. E o que permite exportar o resultado de uma
 * busca, e nao apenas o recorte por farmacia e periodo.
 */
export const exportReportData = (filters, formato = "csv", signal) => {
  const {
    priceType,
    startDate,
    endDate,
    selectedPharmacies = [],
    query,
    searchType,
  } = filters;

  if (priceType === "variation") {
    return getBlob(
      "report/export",
      { formato, priceType, ...paramsVariacao(filters) },
      { signal },
    );
  }

  return getBlob(
    "report/export",
    {
      formato,
      priceType: priceType === "historical" ? "historical" : "current",
      ...(query && searchType ? { [searchType]: query } : {}),
      ...(startDate ? { "data-inicio": startDate } : {}),
      ...(endDate ? { "data-fim": endDate } : {}),
      ...(selectedPharmacies.length
        ? { farmacia: selectedPharmacies.join(",") }
        : {}),
    },
    { signal },
  );
};

/** Dispara o download de um blob já pronto. */
export const baixarBlob = (blob, nomeArquivo) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/* -------------------------------------------------------------------------
   Autocomplete
   ------------------------------------------------------------------------- */

/** Minimo de caracteres antes de chamar /descricoes. Ver comentario abaixo. */
export const MIN_AUTOCOMPLETE = 3;

/**
 * Sugestoes de descricao.
 *
 * O filtro e opcional no servidor: `/api/descricoes` sem `?descricao=` devolve
 * as 107 mil descricoes da base — 7,78 MB, medido. Se o autocomplete disparar
 * na montagem do componente ou com a caixa vazia, e isso que o usuario baixa.
 * Por isso o piso de caracteres mora aqui, e nao so no componente: qualquer
 * chamador novo herda a protecao.
 */
export const fetchDescriptions = async (query, signal) => {
  const termo = (query ?? "").trim();
  if (termo.length < MIN_AUTOCOMPLETE) return [];

  const data = await getJson("descricoes", {
    params: { descricao: termo },
    signal,
    // 24h de cache no servidor depois da 1a chamada; espelhar aqui evita
    // repetir a ida ao servidor enquanto o usuario apaga e redigita.
    ttl: 10 * MINUTO,
  });

  return Array.isArray(data) ? data : [];
};

/* -------------------------------------------------------------------------
   Painel
   ------------------------------------------------------------------------- */

/**
 * Painel inteiro em uma chamada.
 *
 * Substitui as quatro chamadas (statistics + trends + top-changes +
 * pharmacy-stats) que a tela disparava na montagem. O /summary junta as quatro
 * do lado do servidor e ainda guarda o resultado em cache por 5 min.
 */
export const fetchDashboardSummary = (signal) =>
  getJson("dashboard/summary", { signal, ttl: 5 * MINUTO });

/* -------------------------------------------------------------------------
   Autenticacao
   ------------------------------------------------------------------------- */

export const login = (credentials) => postJson("login", credentials);
export const register = (payload) => postJson("register", payload);
export const fetchCurrentUser = (token, signal) =>
  getJson("user", {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
