import { useState } from "react";
import PropTypes from "prop-types";
import { useFarmacias } from "../hooks/useFarmacias";
import PharmacyPicker from "./PharmacyPicker";

/** Teto do período no relatório de variações (VariacaoPreco::DIAS_MAXIMO). */
const DIAS_MAXIMO = 366;

/**
 * Data local em AAAA-MM-DD. `toISOString` devolveria o dia em UTC — a partir
 * das 21h no nosso fuso, o dia seguinte.
 */
const diaLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const ultimosDias = (n) => {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - (n - 1));
  return [diaLocal(inicio), diaLocal(new Date())];
};

/** Dias do período contando as duas pontas. Date.UTC para o horário de verão não roubar uma hora. */
const diasEntre = (inicio, fim) => {
  const utc = (s) => {
    const [a, m, d] = s.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((utc(fim) - utc(inicio)) / 86_400_000) + 1;
};

const ReportFilter = ({ onGenerateReport, carregando }) => {
  const [priceType, setPriceType] = useState("current");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPharmacies, setSelectedPharmacies] = useState([]);
  const [tipo, setTipo] = useState("todos");
  const [variacaoMinima, setVariacaoMinima] = useState("");
  const [erro, setErro] = useState("");
  const { farmacias } = useFarmacias();

  const historico = priceType === "historical";
  const variacao = priceType === "variation";

  const trocarTipo = (valor) => {
    setPriceType(valor);
    // Variação sempre tem período. Começa com o mesmo padrão do servidor (30
    // dias) já escrito nos campos, em vez de campos vazios que ninguém sabe o
    // que significam.
    if (valor === "variation" && !startDate && !endDate) {
      const [inicio, fim] = ultimosDias(30);
      setStartDate(inicio);
      setEndDate(fim);
    }
  };

  const enviar = (e) => {
    e.preventDefault();
    const comPeriodo = historico || variacao;

    if (comPeriodo && startDate && endDate && startDate > endDate) {
      setErro("A data inicial é posterior à data final.");
      return;
    }
    if (
      variacao &&
      startDate &&
      diasEntre(startDate, endDate || diaLocal(new Date())) > DIAS_MAXIMO
    ) {
      setErro(`O período pode ter no máximo ${DIAS_MAXIMO} dias.`);
      return;
    }

    setErro("");
    onGenerateReport({
      priceType,
      startDate,
      endDate,
      selectedPharmacies,
      ...(variacao ? { tipo, variacaoMinima } : {}),
    });
  };

  const campo =
    "rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition-smooth focus:border-dashboard-primary focus:ring-2 focus:ring-dashboard-primary/30";
  const rotulo = "mb-1.5 block text-xs font-medium text-muted-foreground";

  return (
    <form
      onSubmit={enviar}
      className="mb-6 rounded-card border border-border bg-card p-4 shadow-card"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div>
          <span className={rotulo}>Farmácias</span>
          <PharmacyPicker
            farmacias={farmacias}
            selecionadas={selectedPharmacies}
            onChange={setSelectedPharmacies}
          />
        </div>

        <div>
          <label htmlFor="tipo-preco" className={rotulo}>
            Tipo
          </label>
          <select
            id="tipo-preco"
            value={priceType}
            onChange={(e) => trocarTipo(e.target.value)}
            className={campo}
          >
            <option value="current">Preço atual</option>
            <option value="historical">Histórico de preços</option>
            <option value="variation">Aumentos e reduções</option>
          </select>
        </div>

        {(historico || variacao) && (
          <>
            <div>
              <label htmlFor="relatorio-inicio" className={rotulo}>
                De
              </label>
              <input
                id="relatorio-inicio"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="relatorio-fim" className={rotulo}>
                Até
              </label>
              <input
                id="relatorio-fim"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={campo}
              />
            </div>
          </>
        )}

        {variacao && (
          <>
            <div>
              <label htmlFor="relatorio-movimento" className={rotulo}>
                Movimento
              </label>
              <select
                id="relatorio-movimento"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className={campo}
              >
                <option value="todos">Aumentos e reduções</option>
                <option value="aumento">Só aumentos</option>
                <option value="reducao">Só reduções</option>
              </select>
            </div>
            <div>
              <label htmlFor="relatorio-minima" className={rotulo}>
                Variação mínima (%)
              </label>
              <input
                id="relatorio-minima"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder="0"
                value={variacaoMinima}
                onChange={(e) => setVariacaoMinima(e.target.value)}
                className={`${campo} w-full lg:w-36`}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="rounded-lg bg-dashboard-primary px-6 py-2.5 text-sm font-medium text-white transition-smooth hover:brightness-110 disabled:opacity-60"
        >
          {carregando ? "Gerando..." : "Gerar relatório"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </form>
  );
};

ReportFilter.propTypes = {
  onGenerateReport: PropTypes.func.isRequired,
  carregando: PropTypes.bool,
};

export default ReportFilter;
