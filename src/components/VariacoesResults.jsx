import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate, formatNumberToBRL } from "../utils/format";
import { useIsMobile } from "../hooks/useMediaQuery";
import { EmptyState } from "./ui/feedback";
import EanCopiavel from "./ui/EanCopiavel";

/**
 * Faixa fora da qual a variação é provável erro de coleta. Espelha
 * VariacaoPreco::ALTA_MAXIMA / QUEDA_MAXIMA no servidor — aqui só serve para
 * marcar a linha quando a pessoa pede para ver as suspeitas.
 */
const ALTA_MAXIMA = 500;
const QUEDA_MAXIMA = -80;

const ORDENS = [
  { valor: "variacao", rotulo: "Maior variação" },
  { valor: "data", rotulo: "Mais recentes" },
];

const numero = (valor) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** 12.5 -> "+12,5%" · -3 -> "-3,0%". O sinal é o que se lê primeiro. */
const percentual = (valor) =>
  `${valor > 0 ? "+" : ""}${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

/** 2.5 -> "+R$ 2,50" */
const diferenca = (valor) =>
  `${valor > 0 ? "+" : "−"}${formatCurrency(Math.abs(valor))}`;

const ehSuspeita = (variacao) =>
  variacao > ALTA_MAXIMA || variacao < QUEDA_MAXIMA;

const plural = (n, um, varios) => `${formatNumberToBRL(n)} ${n === 1 ? um : varios}`;

/* Subir preço é ruim para quem compra: vermelho. Mesma convenção do painel. */
const SeloVariacao = ({ variacao }) => {
  const subiu = variacao > 0;
  const Icone = subiu ? TrendingUp : TrendingDown;
  return (
    <span
      className={`tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        subiu
          ? "bg-dashboard-danger/10 text-dashboard-danger"
          : "bg-dashboard-success/10 text-dashboard-success"
      }`}
    >
      <Icone className="h-3.5 w-3.5" />
      {percentual(variacao)}
    </span>
  );
};

SeloVariacao.propTypes = { variacao: PropTypes.number.isRequired };

const SeloSuspeita = () => (
  <span
    title="Variação acima de +500% ou abaixo de −80%: provável erro de coleta"
    className="rounded bg-dashboard-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-dashboard-warning"
  >
    suspeita
  </span>
);

const Resumo = ({
  resumo,
  ordem,
  onOrdemChange,
  incluirSuspeitas,
  onIncluirSuspeitasChange,
}) => (
  <div className="mb-4 space-y-3">
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="tabular text-muted-foreground">
          {formatDate(resumo.inicio)} – {formatDate(resumo.fim)}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-dashboard-danger">
          <TrendingUp className="h-4 w-4" />
          <span className="tabular">
            {plural(resumo.aumentos, "aumento", "aumentos")}
          </span>
        </span>
        <span className="flex items-center gap-1.5 font-medium text-dashboard-success">
          <TrendingDown className="h-4 w-4" />
          <span className="tabular">
            {plural(resumo.reducoes, "redução", "reduções")}
          </span>
        </span>
      </div>

      <div
        role="group"
        aria-label="Ordenar por"
        className="inline-flex self-start rounded-lg border border-border p-0.5 sm:self-auto"
      >
        {ORDENS.map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={ordem === valor}
            onClick={() => onOrdemChange(valor)}
            className={`rounded-md px-3 py-1.5 text-sm transition-smooth ${
              ordem === valor
                ? "bg-dashboard-primary font-medium text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>

    {/* As suspeitas saem da lista, mas nunca em silêncio: a contagem fica à
        vista e voltar com elas é um clique. */}
    {resumo.suspeitas > 0 && (
      <div className="flex flex-col gap-2 rounded-lg border border-dashboard-warning/30 bg-dashboard-warning/5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-dashboard-warning" />
          {incluirSuspeitas
            ? `Incluindo ${plural(resumo.suspeitas, "provável erro", "prováveis erros")} de coleta (acima de +500% ou abaixo de −80%), marcados na lista.`
            : `${plural(resumo.suspeitas, "variação", "variações")} acima de +500% ou abaixo de −80% ${
                resumo.suspeitas === 1 ? "ficou" : "ficaram"
              } de fora — quase sempre é erro de coleta, como troca de apresentação com o mesmo EAN.`}
        </p>
        <button
          type="button"
          onClick={() => onIncluirSuspeitasChange(!incluirSuspeitas)}
          className="shrink-0 self-start font-medium text-dashboard-primary hover:underline sm:self-auto"
        >
          {incluirSuspeitas ? "Ocultar" : "Mostrar mesmo assim"}
        </button>
      </div>
    )}
  </div>
);

Resumo.propTypes = {
  resumo: PropTypes.shape({
    inicio: PropTypes.string,
    fim: PropTypes.string,
    aumentos: PropTypes.number,
    reducoes: PropTypes.number,
    suspeitas: PropTypes.number,
  }).isRequired,
  ordem: PropTypes.string.isRequired,
  onOrdemChange: PropTypes.func.isRequired,
  incluirSuspeitas: PropTypes.bool,
  onIncluirSuspeitasChange: PropTypes.func.isRequired,
};

const LinkProduto = ({ item, className }) => (
  <Link
    to={`/produto/${item.EAN}`}
    title={item.descricao}
    className={`transition-smooth hover:text-dashboard-primary ${className}`}
  >
    {item.descricao}
  </Link>
);

LinkProduto.propTypes = {
  item: PropTypes.object.isRequired,
  className: PropTypes.string,
};

const Tabela = ({ linhas }) => (
  <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="px-4 py-3 text-left">Produto</th>
            <th scope="col" className="px-4 py-3 text-left">Farmácia</th>
            <th scope="col" className="px-4 py-3 text-left">EAN</th>
            <th scope="col" className="px-4 py-3 text-right">Antes</th>
            <th scope="col" className="px-4 py-3 text-right">Depois</th>
            <th scope="col" className="px-4 py-3 text-right">Variação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((item) => (
            <tr
              key={item.preco_id}
              className="border-b border-border/60 transition-smooth last:border-b-0 hover:bg-muted/40"
            >
              <td className="max-w-md px-4 py-3 font-medium">
                <LinkProduto item={item} className="block truncate" />
                {item.laboratorio && (
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {item.laboratorio}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">{item.nome_farmacia}</td>
              <td className="px-4 py-3">
                <EanCopiavel ean={item.EAN} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="tabular text-muted-foreground">
                  {formatCurrency(item.anterior)}
                </div>
                <div className="text-xs text-muted-foreground">
                  desde {formatDate(item.data_anterior)}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="tabular font-semibold">
                  {formatCurrency(item.atual)}
                </div>
                <div className="text-xs text-muted-foreground">
                  em {formatDate(item.data)}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {item.suspeita && <SeloSuspeita />}
                  <SeloVariacao variacao={item.variacao} />
                </div>
                <div className="tabular mt-1 text-xs text-muted-foreground">
                  {diferenca(item.atual - item.anterior)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

Tabela.propTypes = { linhas: PropTypes.arrayOf(PropTypes.object).isRequired };

const Cartoes = ({ linhas }) => (
  <div className="space-y-3">
    {linhas.map((item) => (
      <article
        key={item.preco_id}
        className="rounded-card border border-border bg-card p-4 shadow-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <LinkProduto
              item={item}
              className="line-clamp-2 text-sm font-semibold"
            />
            <span className="mt-1 inline-block rounded-md bg-dashboard-primary/10 px-2 py-0.5 text-xs font-medium text-dashboard-primary">
              {item.nome_farmacia}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <SeloVariacao variacao={item.variacao} />
            {item.suspeita && <SeloSuspeita />}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <EanCopiavel ean={item.EAN} />
            <p className="mt-1">em {formatDate(item.data)}</p>
          </div>
          <div className="text-right">
            <p className="tabular text-xs text-muted-foreground">
              <span className="line-through">{formatCurrency(item.anterior)}</span>
              {" → "}
            </p>
            <p className="tabular text-lg font-bold">
              {formatCurrency(item.atual)}
            </p>
          </div>
        </div>
      </article>
    ))}
  </div>
);

Cartoes.propTypes = { linhas: PropTypes.arrayOf(PropTypes.object).isRequired };

const VariacoesResults = ({ results = [], resumo, ...controles }) => {
  const isMobile = useIsMobile();

  // Preço chega como string decimal da API; converte uma vez aqui para a
  // tabela e os cartões fazerem conta sem repetir o parse.
  const linhas = results
    .map((item) => ({
      ...item,
      anterior: numero(item.preco_anterior),
      atual: numero(item.preco),
      variacao: numero(item.variacao),
    }))
    .filter((item) => item.anterior !== null && item.atual !== null && item.variacao !== null)
    .map((item) => ({ ...item, suspeita: ehSuspeita(item.variacao) }));

  return (
    <>
      {resumo && <Resumo resumo={resumo} {...controles} />}

      {linhas.length === 0 ? (
        <EmptyState
          title="Nenhuma mudança de preço encontrada"
          description="Só entra aqui preço que mudou dentro do período. Amplie as datas, inclua mais farmácias ou reduza a variação mínima."
        />
      ) : isMobile ? (
        <Cartoes linhas={linhas} />
      ) : (
        <Tabela linhas={linhas} />
      )}
    </>
  );
};

VariacoesResults.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object),
  resumo: PropTypes.object,
  ordem: PropTypes.string.isRequired,
  onOrdemChange: PropTypes.func.isRequired,
  incluirSuspeitas: PropTypes.bool,
  onIncluirSuspeitasChange: PropTypes.func.isRequired,
};

export default VariacoesResults;
