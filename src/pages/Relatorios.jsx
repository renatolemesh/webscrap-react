import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import ReportFilter from "../components/Reportfilter";
import ResultsTable from "../components/ResultsTable";
import PriceHistoryResults from "../components/PriceHistoryResults";
import VariacoesResults from "../components/VariacoesResults";
import Pagination from "../components/Pagination";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "../components/ui/feedback";
import { baixarBlob, exportReportData, fetchReportData } from "../services/api";
import { useApiQuery, useRetry } from "../hooks/useApiQuery";

const NOME_ARQUIVO = {
  variation: "relatorio_variacoes",
};

const Relatorios = () => {
  const [filtros, setFiltros] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(null);
  const [erroExport, setErroExport] = useState(null);
  const [nonce, tentarDeNovo] = useRetry();

  const { data, error, carregando, inativa } = useApiQuery(
    fetchReportData,
    filtros ? [filtros, pagina] : null,
    nonce,
  );

  // Ordem e suspeitas são escolhidas em cima do resultado, e não no
  // formulário — por isso sobrevivem a um "Gerar relatório" novo.
  const gerar = (novosFiltros) => {
    setFiltros((anteriores) => ({
      ordem: anteriores?.ordem ?? "variacao",
      incluirSuspeitas: anteriores?.incluirSuspeitas ?? false,
      ...novosFiltros,
    }));
    setPagina(1);
    setErroExport(null);
  };

  const ajustar = (campo) => (valor) => {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
    setPagina(1);
  };

  const exportar = async (formato) => {
    setExportando(formato);
    setErroExport(null);
    try {
      const blob = await exportReportData(filtros, formato);
      const nome = NOME_ARQUIVO[filtros.priceType] ?? "relatorio";
      baixarBlob(blob, `${nome}.${formato === "excel" ? "xlsx" : "csv"}`);
    } catch (err) {
      setErroExport(`Não foi possível exportar: ${err.message}`);
    } finally {
      setExportando(null);
    }
  };

  const linhas = data?.data ?? [];

  const botaoExport =
    "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-smooth hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

  const resultados = () => {
    if (filtros.priceType === "variation") {
      return (
        <VariacoesResults
          results={linhas}
          resumo={data.resumo}
          ordem={filtros.ordem}
          onOrdemChange={ajustar("ordem")}
          incluirSuspeitas={filtros.incluirSuspeitas}
          onIncluirSuspeitasChange={ajustar("incluirSuspeitas")}
        />
      );
    }
    if (filtros.priceType === "current") {
      return <ResultsTable results={linhas} variante="catalogo" />;
    }
    return <PriceHistoryResults results={linhas} />;
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        actions={
          linhas.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => exportar("excel")}
                disabled={Boolean(exportando)}
                className={botaoExport}
              >
                {exportando === "excel" ? (
                  <Download className="h-4 w-4 animate-bounce" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-dashboard-success" />
                )}
                Excel
              </button>
              <button
                type="button"
                onClick={() => exportar("csv")}
                disabled={Boolean(exportando)}
                className={botaoExport}
              >
                {exportando === "csv" ? (
                  <Download className="h-4 w-4 animate-bounce" />
                ) : (
                  <FileText className="h-4 w-4 text-dashboard-warning" />
                )}
                CSV
              </button>
            </>
          )
        }
      />

      <ReportFilter onGenerateReport={gerar} carregando={carregando} />

      {erroExport && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erroExport}
        </p>
      )}

      {inativa && (
        <EmptyState
          icon={FileText}
          title="Configure o relatório"
          description="Escolha as farmácias e o tipo de relatório. Sem farmácia selecionada, o relatório cobre todas. Em “Aumentos e reduções”, cada mudança de preço aparece com a variação sobre o preço anterior."
        />
      )}

      {carregando && <TableSkeleton />}

      {error && <ErrorState message={error} onRetry={tentarDeNovo} />}

      {data && (
        <>
          {resultados()}
          <Pagination
            currentPage={data.current_page ?? pagina}
            totalPages={data.last_page ?? 1}
            total={data.total}
            onPageChange={setPagina}
          />
        </>
      )}
    </>
  );
};

export default Relatorios;
