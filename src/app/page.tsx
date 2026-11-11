
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/src/services/api";

interface Convenio {
  id_Convenio: number;
  con_Fantasia: string;
}

interface ResumoMensal {
  mes: number;
  quantidade: number;
  valor: number;
}

interface DashboardResponse {
  success: boolean;
  ano: number;
  totalCompras: number;
  valorTotal: number;
  meses: ResumoMensal[];
}

interface ResumoLiquidoMensal {
  mes: number;
  valorBruto: number;
  valorTaxa: number;
  valorLiquido: number;
}

interface DashboardLiquidoResponse {
  success: boolean;
  ano: number;
  totalBruto: number;
  totalTaxa: number;
  totalLiquido: number;
  meses: ResumoLiquidoMensal[];
}

const nomesMeses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function Home() {
  const [ano, setAno] = useState<number | null>(null);
  const [anoAtual, setAnoAtual] = useState<number | null>(null);

  // Filtro de convênio
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [convenio, setConvenio] = useState("");

  // Dashboard original
  const [dados, setDados] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Dashboard de valores líquidos
  const [dadosLiquidos, setDadosLiquidos] =
    useState<DashboardLiquidoResponse | null>(null);

  const [loadingLiquido, setLoadingLiquido] = useState(true);
  const [erroLiquido, setErroLiquido] = useState("");

  // Carrega a lista de convênios
  useEffect(() => {
    async function carregarConvenios() {
      try {
        const response = await api.get("/convenios");

        if (response.data.success) {
          setConvenios(response.data.convenios || []);
        }
      } catch (error) {
        console.error("Erro ao carregar convênios:", error);
      }
    }

    carregarConvenios();
  }, []);

  // Carrega o ano atual
  useEffect(() => {
    const anoCorrente = new Date().getFullYear();

    setAnoAtual(anoCorrente);
    setAno(anoCorrente);
  }, []);

  // Carrega os dois dashboards conforme ano e convênio
  async function carregarDashboard() {
    if (ano === null) return;

    const parametros = {
      ano,
      convenio: convenio || undefined,
    };

    // Dashboard original
    try {
      setLoading(true);
      setErro("");

      const response = await api.get<DashboardResponse>(
        "/relatorioCompras/dashboard",
        { params: parametros }
      );

      if (!response.data.success) {
        throw new Error("Não foi possível carregar o dashboard.");
      }

      setDados(response.data);
    } catch (error: any) {
      console.error("Erro no dashboard de compras:", error);

      setErro(
        error.response?.data?.message ||
          error.message ||
          "Erro ao carregar os dados."
      );

      setDados(null);
    } finally {
      setLoading(false);
    }

    // Dashboard de valores bruto, taxa e líquido
    try {
      setLoadingLiquido(true);
      setErroLiquido("");

      const response = await api.get<DashboardLiquidoResponse>(
        "/relatorioCompras/dashboard-liquido",
        { params: parametros }
      );

      if (!response.data.success) {
        throw new Error(
          "Não foi possível carregar os valores líquidos."
        );
      }

      setDadosLiquidos(response.data);
    } catch (error: any) {
      console.error("Erro no dashboard líquido:", error);

      setErroLiquido(
        error.response?.data?.message ||
          error.message ||
          "Erro ao carregar os valores líquidos."
      );

      setDadosLiquidos(null);
    } finally {
      setLoadingLiquido(false);
    }
  }

  // Atualiza os dashboards quando mudar o ano ou o convênio
  useEffect(() => {
    if (ano !== null) {
      carregarDashboard();
    }
  }, [ano, convenio]);

  const meses = dados?.meses || [];
  const mesesLiquidos = dadosLiquidos?.meses || [];

  // Escalas dos gráficos originais
  const maiorQuantidade = Math.max(
    1,
    ...meses.map((m) => Number(m.quantidade))
  );

  const maiorValor = Math.max(
    1,
    ...meses.map((m) => Number(m.valor))
  );

  // Indicadores originais
  const mediaMensal = Number(dados?.totalCompras || 0) / 12;

  const mesMaiorValor = [...meses].sort(
    (a, b) => Number(b.valor) - Number(a.valor)
  )[0];

  // Escala do gráfico financeiro
  const maiorValorLiquido = Math.max(
    1,
    ...mesesLiquidos.flatMap((m) => [
      Number(m.valorBruto),
      Number(m.valorTaxa),
      Number(m.valorLiquido),
    ])
  );

  // Mês com maior valor líquido
  const mesMaiorLiquido = [...mesesLiquidos].sort(
    (a, b) => Number(b.valorLiquido) - Number(a.valorLiquido)
  )[0];

  function moeda(valor: number) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function numero(valor: number) {
    return Number(valor || 0).toLocaleString("pt-BR");
  }

  function valorCompacto(valor: number) {
    if (valor >= 1000000) {
      return `${(valor / 1000000).toFixed(1)}M`;
    }

    if (valor >= 1000) {
      return `${(valor / 1000).toFixed(1)}k`;
    }

    return valor.toFixed(0);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* CABEÇALHO */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Painel de Compras
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Acompanhamento e controle das compras realizadas.
            </p>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap items-center gap-3">

            {/* FILTRO DE ANO */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">
                Ano:
              </label>

              <select
                value={ano ?? ""}
                onChange={(e) => setAno(Number(e.target.value))}
                disabled={ano === null}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"
              >
                {anoAtual !== null &&
                  Array.from(
                    { length: anoAtual - 2013 + 1 },
                    (_, i) => anoAtual - i
                  ).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </select>
            </div>

            {/* FILTRO DE CONVÊNIO */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">
                Convênio:
              </label>

              <select
                value={convenio}
                onChange={(e) => setConvenio(e.target.value)}
                className="min-w-[190px] rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="">
                  Todos os convênios
                </option>

                {convenios.map((item) => (
                  <option
                    key={item.id_Convenio}
                    value={item.id_Convenio}
                  >
                    {item.con_Fantasia}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ERRO DO DASHBOARD ORIGINAL */}
        {erro && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-12 text-center text-slate-500 shadow-sm">
            Carregando informações...
          </div>
        ) : (
          <>
            {/* INDICADORES ORIGINAIS */}
            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Total de compras
                </p>

                <p className="mt-3 text-3xl font-bold text-blue-700">
                  {numero(dados?.totalCompras || 0)}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Compras no ano de {ano}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Valor total comprado
                </p>

                <p className="mt-3 text-2xl font-bold text-emerald-700">
                  {moeda(dados?.valorTotal || 0)}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Valor acumulado no ano
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Média mensal de compras
                </p>

                <p className="mt-3 text-3xl font-bold text-indigo-700">
                  {numero(Math.round(mediaMensal))}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Quantidade média por mês
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Mês com maior valor
                </p>

                <p className="mt-3 text-2xl font-bold text-amber-600">
                  {mesMaiorValor &&
                  Number(mesMaiorValor.valor) > 0
                    ? nomesMeses[mesMaiorValor.mes - 1]
                    : "-"}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {moeda(Number(mesMaiorValor?.valor || 0))}
                </p>
              </div>
            </div>

            {/* GRÁFICOS ORIGINAIS */}
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* QUANTIDADE */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">
                  Quantidade de compras por mês
                </h2>

                <p className="mb-8 text-sm text-slate-500">
                  Comparativo mensal de {ano}
                </p>

                <div className="flex h-64 items-end gap-2 border-b border-l border-slate-200 px-2">
                  {nomesMeses.map((nome, index) => {
                    const item = meses.find(
                      (m) => Number(m.mes) === index + 1
                    );

                    const quantidade = Number(item?.quantidade || 0);
                    const altura =
                      (quantidade / maiorQuantidade) * 100;

                    return (
                      <div
                        key={nome}
                        className="flex h-full flex-1 flex-col items-center justify-end"
                      >
                        <span className="mb-2 text-[10px] font-semibold text-slate-600 md:text-xs">
                          {quantidade || ""}
                        </span>

                        <div
                          title={`${nome}: ${quantidade} compras`}
                          className="w-full max-w-10 rounded-t-md bg-blue-600 transition-all hover:bg-blue-800"
                          style={{
                            height: `${altura}%`,
                            minHeight: quantidade > 0 ? "4px" : "0px",
                          }}
                        />

                        <span className="mt-2 text-[10px] text-slate-500 md:text-xs">
                          {nome.substring(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VALORES */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">
                  Valor das compras por mês
                </h2>

                <p className="mb-8 text-sm text-slate-500">
                  Valores mensais em reais
                </p>

                <div className="flex h-64 items-end gap-2 border-b border-l border-slate-200 px-2">
                  {nomesMeses.map((nome, index) => {
                    const item = meses.find(
                      (m) => Number(m.mes) === index + 1
                    );

                    const valor = Number(item?.valor || 0);
                    const altura = (valor / maiorValor) * 100;

                    return (
                      <div
                        key={nome}
                        className="flex h-full flex-1 flex-col items-center justify-end"
                      >
                        <span className="mb-2 text-[9px] font-semibold text-slate-600 md:text-[10px]">
                          {valor > 0
                            ? `${(valor / 1000).toFixed(1)}k`
                            : ""}
                        </span>

                        <div
                          title={`${nome}: ${moeda(valor)}`}
                          className="w-full max-w-10 rounded-t-md bg-emerald-600 transition-all hover:bg-emerald-800"
                          style={{
                            height: `${altura}%`,
                            minHeight: valor > 0 ? "4px" : "0px",
                          }}
                        />

                        <span className="mt-2 text-[10px] text-slate-500 md:text-xs">
                          {nome.substring(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* DASHBOARD DE VALORES LÍQUIDOS */}
        <div className="mb-6 mt-10">
          <h2 className="text-2xl font-bold text-slate-800">
            Análise financeira das parcelas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Valores calculados com base nas parcelas com status A,
            agrupadas pelo mês de vencimento.
          </p>
        </div>

        {erroLiquido && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erroLiquido}
          </div>
        )}

        {loadingLiquido ? (
          <div className="mb-8 rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
            Carregando análise financeira...
          </div>
        ) : dadosLiquidos ? (
          <>
            {/* INDICADORES FINANCEIROS */}
            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">

              {/* BRUTO */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    Valor bruto
                  </p>

                  <span className="rounded-lg bg-blue-100 px-3 py-2 text-xl">
                    💰
                  </span>
                </div>

                <p className="mt-4 text-2xl font-bold text-blue-700">
                  {moeda(dadosLiquidos.totalBruto)}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Total das parcelas com status A
                </p>
              </div>

              {/* TAXA */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    Taxa administrativa
                  </p>

                  <span className="rounded-lg bg-amber-100 px-3 py-2 text-xl">
                    📉
                  </span>
                </div>

                <p className="mt-4 text-2xl font-bold text-amber-600">
                  {moeda(dadosLiquidos.totalTaxa)}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Total dos descontos administrativos
                </p>
              </div>

              {/* LÍQUIDO */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    Valor líquido
                  </p>

                  <span className="rounded-lg bg-emerald-100 px-3 py-2 text-xl">
                    📈
                  </span>
                </div>

                <p className="mt-4 text-2xl font-bold text-emerald-700">
                  {moeda(dadosLiquidos.totalLiquido)}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Bruto menos taxa administrativa
                </p>
              </div>
            </div>

            {/* GRÁFICO FINANCEIRO */}
            <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">
                  Evolução mensal: bruto, taxa e líquido
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Comparativo dos valores das parcelas por mês de vencimento em {ano}.
                </p>
              </div>

              {/* LEGENDA */}
              <div className="mb-6 flex flex-wrap gap-5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-blue-600" />
                  <span className="text-slate-600">
                    Valor bruto
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-amber-500" />
                  <span className="text-slate-600">
                    Taxa administrativa
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-emerald-600" />
                  <span className="text-slate-600">
                    Valor líquido
                  </span>
                </div>
              </div>

              {/* BARRAS */}
              <div className="overflow-x-auto">
                <div className="flex h-80 min-w-[650px] items-end gap-2 border-b border-l border-slate-200 px-2">

                  {nomesMeses.map((nome, index) => {
                    const item = mesesLiquidos.find(
                      (m) => Number(m.mes) === index + 1
                    );

                    const bruto = Number(item?.valorBruto || 0);
                    const taxa = Number(item?.valorTaxa || 0);
                    const liquido = Number(item?.valorLiquido || 0);

                    const alturaBruto =
                      (bruto / maiorValorLiquido) * 100;

                    const alturaTaxa =
                      (taxa / maiorValorLiquido) * 100;

                    const alturaLiquido =
                      (liquido / maiorValorLiquido) * 100;

                    return (
                      <div
                        key={nome}
                        className="flex h-full flex-1 flex-col items-center justify-end"
                      >
                        <div className="mb-2 text-center text-[9px] font-semibold text-slate-500">
                          {bruto > 0
                            ? valorCompacto(bruto)
                            : ""}
                        </div>

                        <div className="flex h-full w-full items-end justify-center gap-1">

                          {/* BRUTO */}
                          <div
                            title={`${nome} - Valor bruto: ${moeda(bruto)}`}
                            className="w-1/4 max-w-8 rounded-t-sm bg-blue-600 transition-all hover:bg-blue-800"
                            style={{
                              height: `${alturaBruto}%`,
                              minHeight: bruto > 0 ? "3px" : "0px",
                            }}
                          />

                          {/* TAXA */}
                          <div
                            title={`${nome} - Taxa administrativa: ${moeda(taxa)}`}
                            className="w-1/4 max-w-8 rounded-t-sm bg-amber-500 transition-all hover:bg-amber-700"
                            style={{
                              height: `${alturaTaxa}%`,
                              minHeight: taxa > 0 ? "3px" : "0px",
                            }}
                          />

                          {/* LÍQUIDO */}
                          <div
                            title={`${nome} - Valor líquido: ${moeda(liquido)}`}
                            className="w-1/4 max-w-8 rounded-t-sm bg-emerald-600 transition-all hover:bg-emerald-800"
                            style={{
                              height: `${alturaLiquido}%`,
                              minHeight: liquido > 0 ? "3px" : "0px",
                            }}
                          />
                        </div>

                        <span className="mt-2 text-[10px] text-slate-500 md:text-xs">
                          {nome.substring(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RESUMO MENSAL */}
              <div className="mt-8">
                <h3 className="mb-4 text-lg font-bold text-slate-800">
                  Detalhamento mensal
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-slate-600">
                        <th className="px-4 py-3">Mês</th>
                        <th className="px-4 py-3 text-right">
                          Valor bruto
                        </th>
                        <th className="px-4 py-3 text-right">
                          Taxa administrativa
                        </th>
                        <th className="px-4 py-3 text-right">
                          Valor líquido
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {mesesLiquidos.map((item) => (
                        <tr
                          key={item.mes}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {nomesMeses[item.mes - 1]}
                          </td>

                          <td className="px-4 py-3 text-right font-medium text-blue-700">
                            {moeda(item.valorBruto)}
                          </td>

                          <td className="px-4 py-3 text-right font-medium text-amber-600">
                            {moeda(item.valorTaxa)}
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-emerald-700">
                            {moeda(item.valorLiquido)}
                          </td>
                        </tr>
                      ))}

                      {/* TOTAL */}
                      <tr className="bg-slate-100 font-bold">
                        <td className="px-4 py-3 text-slate-800">
                          TOTAL
                        </td>

                        <td className="px-4 py-3 text-right text-blue-700">
                          {moeda(dadosLiquidos.totalBruto)}
                        </td>

                        <td className="px-4 py-3 text-right text-amber-600">
                          {moeda(dadosLiquidos.totalTaxa)}
                        </td>

                        <td className="px-4 py-3 text-right text-emerald-700">
                          {moeda(dadosLiquidos.totalLiquido)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* DESTAQUE DO MELHOR MÊS */}
            <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm font-medium text-emerald-800">
                Mês com maior valor líquido
              </p>

              <div className="mt-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <p className="text-2xl font-bold text-emerald-700">
                  {mesMaiorLiquido &&
                  Number(mesMaiorLiquido.valorLiquido) > 0
                    ? nomesMeses[mesMaiorLiquido.mes - 1]
                    : "Sem movimentação"}
                </p>

                <p className="text-xl font-bold text-emerald-700">
                  {moeda(
                    Number(mesMaiorLiquido?.valorLiquido || 0)
                  )}
                </p>
              </div>
            </div>
          </>
        ) : !loadingLiquido ? (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Não existem dados financeiros disponíveis para o ano selecionado.
          </div>
        ) : null}

        {/* ACESSOS */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">
            Acesso aos relatórios
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Selecione o módulo que deseja acessar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">

          <Link
            href="/relatorio-compras"
            className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-400 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-2xl">
              📊
            </div>

            <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-700">
              Consulta analítica
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Consulte os registros de compras, detalhes,
              parcelas, filtros e paginação.
            </p>

            <p className="mt-5 text-sm font-semibold text-blue-700">
              Acessar consulta →
            </p>
          </Link>

          <Link
            href="/relatorio-compras"
            className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-2xl">
              📄
            </div>

            <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-700">
              Relatórios em PDF
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Acesse a consulta existente e utilize os
              recursos de geração dos relatórios PDF.
            </p>

            <p className="mt-5 text-sm font-semibold text-emerald-700">
              Acessar relatórios →
            </p>
          </Link>

          <Link
            href="/compras-divergentes"
            className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-amber-400 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-2xl">
              ⚠️
            </div>

            <h3 className="text-lg font-bold text-slate-800 group-hover:text-amber-700">
              Compras divergentes
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Consulte separadamente as compras que
              apresentam divergências nos registros.
            </p>

            <p className="mt-5 text-sm font-semibold text-amber-700">
              Acessar divergências →
            </p>
          </Link>

        </div>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
          Sistema de Controle de Compras
        </footer>

      </div>
    </main>
  );
}
