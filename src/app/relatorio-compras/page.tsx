
"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/src/services/api";

interface Parcela {
  id_parcela: number;
  venc_parcela: string;
  valor_parcela: string | number;
  status_parcela: string;
  vct_original: string;
  par_datAntecipacao: string | null;
  par_servidor: number | null;
  par_nomServidor: string | null;
  par_secretaria: string | null;
  par_secOrgao: number | null;
  par_convenio: number | null;
}

interface Compra {
  id_compra: number;
  emissao_compra: string;
  valor_compra: string | number;
  qtdparc_compra: number;
  status_compra: string;
  convenio_compra: number | null;
  con_Fantasia: string | null;
  nome_user: string | null;
  parcelas: Parcela[];
}

interface Convenio {
  id_Convenio: number;
  con_Fantasia: string;
}

interface RelatorioResponse {
  success: boolean;
  ano: number;
  mes: number | null;
  convenio: number | null;
  total: number;
  totalVendas: number;
  valorTotalVendido: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  compras: Compra[];
}

interface Totalizadores {
  quantidadeVendas: number;
  valorTotalVendido: number;
}

const meses = [
  { valor: 1, nome: "Janeiro" },
  { valor: 2, nome: "Fevereiro" },
  { valor: 3, nome: "Março" },
  { valor: 4, nome: "Abril" },
  { valor: 5, nome: "Maio" },
  { valor: 6, nome: "Junho" },
  { valor: 7, nome: "Julho" },
  { valor: 8, nome: "Agosto" },
  { valor: 9, nome: "Setembro" },
  { valor: 10, nome: "Outubro" },
  { valor: 11, nome: "Novembro" },
  { valor: 12, nome: "Dezembro" },
];

function formatarData(
  data: string | null | undefined
): string {
  if (!data) return "-";

  const somenteData = String(data).substring(0, 10);
  const partes = somenteData.split("-");

  if (partes.length !== 3) return somenteData;

  const [ano, mes, dia] = partes;

  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(
  valor: string | number | null | undefined
): string {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function RelatorioCompras() {
  const [ano, setAno] = useState<number>(2000);
  const [mes, setMes] = useState<number | "">("");

  // NOVO FILTRO DE CONVÊNIO
  const [convenio, setConvenio] = useState<number | "">("");
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loadingConvenios, setLoadingConvenios] = useState(false);

  const [pagina, setPagina] = useState(1);
  const [limite] = useState(50);

  const [dados, setDados] = useState<RelatorioResponse | null>(null);

  const [totalizadores, setTotalizadores] = useState<Totalizadores>({
    quantidadeVendas: 0,
    valorTotalVendido: 0,
  });

  const [loading, setLoading] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [erro, setErro] = useState("");

  const [compraExpandida, setCompraExpandida] = useState<number | null>(
    null
  );

  // Inicializa o ano atual.
  useEffect(() => {
    setAno(new Date().getFullYear());
  }, []);

  // CARREGA OS CONVÊNIOS
  useEffect(() => {
    async function carregarConvenios() {
      try {
        setLoadingConvenios(true);

        const response = await api.get("/convenios");

        const lista = Array.isArray(response.data)
          ? response.data
          : response.data.convenios || [];

        setConvenios(lista);

      } catch (error: any) {
        console.error("Erro ao carregar convênios:", error);

        setErro(
          error.response?.data?.message ||
          "Não foi possível carregar a lista de convênios."
        );

      } finally {
        setLoadingConvenios(false);
      }
    }

    carregarConvenios();
  }, []);

  function alternarParcelas(idCompra: number) {
    setCompraExpandida((atual) =>
      atual === idCompra ? null : idCompra
    );
  }

  // PARÂMETROS COMUNS A TODOS OS FILTROS
  function obterParametros() {
    return {
      ano,
      ...(mes !== "" ? { mes } : {}),
      ...(convenio !== "" ? { convenio } : {}),
    };
  }

  // LIMPA OS RESULTADOS QUANDO ALTERAR OS FILTROS
  function limparConsulta() {
    setDados(null);
    setPagina(1);
    setCompraExpandida(null);
    setErro("");

    setTotalizadores({
      quantidadeVendas: 0,
      valorTotalVendido: 0,
    });
  }

  // CONSULTA O RELATÓRIO PAGINADO
  async function consultar(numeroPagina = 1) {
    try {
      setLoading(true);
      setErro("");
      setCompraExpandida(null);

      const response = await api.get<RelatorioResponse>(
        "/relatorioCompras",
        {
          params: {
            ...obterParametros(),
            pagina: numeroPagina,
            limite,
          },
        }
      );

      const resultado = response.data;

      if (!resultado.success) {
        throw new Error("Não foi possível consultar o relatório.");
      }

      // Dados retornados pela API.
      setDados(resultado);

      // Totalizadores gerais do período e convênio selecionados.
      setTotalizadores({
        quantidadeVendas: Number(
          resultado.totalVendas ?? resultado.total ?? 0
        ),
        valorTotalVendido: Number(
          resultado.valorTotalVendido ?? 0
        ),
      });

      setPagina(numeroPagina);

    } catch (error: any) {
      console.error("Erro ao consultar relatório:", error);

      setDados(null);

      setTotalizadores({
        quantidadeVendas: 0,
        valorTotalVendido: 0,
      });

      setErro(
        error.response?.data?.message ||
        error.message ||
        "Não foi possível consultar o relatório de compras."
      );

    } finally {
      setLoading(false);
    }
  }

  // GERA PDF COM TODAS AS COMPRAS DO PERÍODO E CONVÊNIO SELECIONADOS.
  async function gerarPDF() {
    try {
      setGerandoPDF(true);
      setErro("");

      const limitePDF = 100;

      // Busca a primeira página e os totalizadores.
      const primeiraResposta = await api.get<RelatorioResponse>(
        "/relatorioCompras",
        {
          params: {
            ...obterParametros(),
            pagina: 1,
            limite: limitePDF,
          },
        }
      );

      const primeiraPagina = primeiraResposta.data;

      if (
        !primeiraPagina.success ||
        primeiraPagina.total === 0
      ) {
        setErro("Não existem compras para gerar o PDF.");
        return;
      }

      let todasCompras: Compra[] = [
        ...primeiraPagina.compras,
      ];

      // Calcula as páginas restantes.
      const paginasRestantes: number[] = [];

      for (
        let numeroPagina = 2;
        numeroPagina <= primeiraPagina.totalPaginas;
        numeroPagina++
      ) {
        paginasRestantes.push(numeroPagina);
      }

      // Busca as páginas em lotes de cinco requisições.
      const tamanhoLote = 5;

      for (
        let inicio = 0;
        inicio < paginasRestantes.length;
        inicio += tamanhoLote
      ) {
        const lote = paginasRestantes.slice(
          inicio,
          inicio + tamanhoLote
        );

        const respostas = await Promise.all(
          lote.map((numeroPagina) =>
            api.get<RelatorioResponse>(
              "/relatorioCompras",
              {
                params: {
                  ...obterParametros(),
                  pagina: numeroPagina,
                  limite: limitePDF,
                },
              }
            )
          )
        );

        respostas.forEach((resposta) => {
          todasCompras.push(...resposta.data.compras);
        });
      }

      // Totalizadores fornecidos pelo backend.
      const totaisPDF: Totalizadores = {
        quantidadeVendas: Number(
          primeiraPagina.totalVendas ?? primeiraPagina.total
        ),
        valorTotalVendido: Number(
          primeiraPagina.valorTotalVendido ?? 0
        ),
      };

      // Importa o pdfmake.
      const pdfMakeModule = await import(
        "pdfmake/build/pdfmake"
      );

      const pdfFontsModule = await import(
        "pdfmake/build/vfs_fonts"
      );

      const pdfMake: any =
        (pdfMakeModule as any).default || pdfMakeModule;

      const pdfFonts: any =
        (pdfFontsModule as any).default || pdfFontsModule;

      pdfMake.vfs =
        pdfFonts.pdfMake?.vfs ||
        pdfFonts.vfs ||
        pdfFonts;

      // Cabeçalho da tabela.
      const corpoTabela: any[] = [
        [
          { text: "Compra", bold: true, fontSize: 6 },
          { text: "Emissão", bold: true, fontSize: 6 },
          { text: "Associado / Convênio", bold: true, fontSize: 6 },
          { text: "Valor compra", bold: true, fontSize: 6 },
          { text: "Parc.", bold: true, fontSize: 6 },
          { text: "Servidor", bold: true, fontSize: 6 },
          { text: "Vencimento", bold: true, fontSize: 6 },
          { text: "Valor parc.", bold: true, fontSize: 6 },
          { text: "Status", bold: true, fontSize: 6 },
        ],
      ];

      // Percorre todas as compras e parcelas.
      todasCompras.forEach((compra) => {
        const associadoConvenio = {
          text: [
            {
              text: compra.nome_user || "-",
              bold: true,
              fontSize: 6,
            },
            {
              text: `\nConvênio: ${
                compra.con_Fantasia || "Não informado"
              }`,
              fontSize: 5,
              color: "#666666",
            },
          ],
        };

        if (
          compra.parcelas &&
          compra.parcelas.length > 0
        ) {
          compra.parcelas.forEach((parcela, index) => {
            corpoTabela.push([
              index === 0 ? String(compra.id_compra) : "",
              index === 0
                ? formatarData(compra.emissao_compra)
                : "",
              index === 0 ? associadoConvenio : "",
              index === 0
                ? formatarMoeda(compra.valor_compra)
                : "",
              String(parcela.id_parcela),
              parcela.par_nomServidor || "-",
              formatarData(parcela.venc_parcela),
              formatarMoeda(parcela.valor_parcela),
              parcela.status_parcela || "-",
            ]);
          });
        } else {
          corpoTabela.push([
            String(compra.id_compra),
            formatarData(compra.emissao_compra),
            associadoConvenio,
            formatarMoeda(compra.valor_compra),
            "-",
            "-",
            "-",
            "-",
            "-",
          ]);
        }
      });

      const nomeMes =
        mes !== ""
          ? meses.find((item) => item.valor === mes)?.nome
          : "Todos os meses";

      // Identifica o convênio selecionado.
      const nomeConvenio =
        convenio !== ""
          ? convenios.find(
              (item) => item.id_Convenio === convenio
            )?.con_Fantasia || "Convênio selecionado"
          : "Todos os convênios";

      const identificacaoFiltro =
        mes !== ""
          ? `${ano}_${String(mes).padStart(2, "0")}`
          : String(ano);

      const identificacaoConvenio =
        convenio !== "" ? convenio : "Todos";

      // DOCUMENTO PDF - A4 VERTICAL.
      const documento = {
        pageOrientation: "portrait",
        pageSize: "A4",
        pageMargins: [15, 25, 15, 25],

        content: [
          {
            text: "RELATÓRIO DE COMPRAS",
            fontSize: 14,
            bold: true,
            alignment: "center",
            margin: [0, 0, 0, 6],
          },
          {
            text: `Ano: ${ano} | Período: ${nomeMes}`,
            fontSize: 8,
            alignment: "center",
            margin: [0, 0, 0, 3],
          },
          {
            text: `Convênio: ${nomeConvenio} | Total de compras: ${primeiraPagina.total}`,
            fontSize: 8,
            alignment: "center",
            margin: [0, 0, 0, 5],
          },
          {
            text: `TOTAL DE VENDAS: ${totaisPDF.quantidadeVendas.toLocaleString("pt-BR")}`,
            fontSize: 9,
            bold: true,
            alignment: "center",
            margin: [0, 4, 0, 2],
          },
          {
            text: `VALOR TOTAL VENDIDO: ${formatarMoeda(
              totaisPDF.valorTotalVendido
            )}`,
            fontSize: 11,
            bold: true,
            color: "#15803d",
            alignment: "center",
            margin: [0, 2, 0, 8],
          },
          {
            text: `Compras carregadas: ${todasCompras.length}`,
            fontSize: 7,
            margin: [0, 0, 0, 6],
          },
          {
            table: {
              headerRows: 1,
              widths: [
                32,
                45,
                "*",
                48,
                28,
                "*",
                45,
                48,
                35,
              ],
              body: corpoTabela,
            },

            layout: {
              hLineWidth: function () {
                return 0.5;
              },
              vLineWidth: function () {
                return 0.3;
              },
              paddingLeft: function () {
                return 2;
              },
              paddingRight: function () {
                return 2;
              },
              paddingTop: function () {
                return 2;
              },
              paddingBottom: function () {
                return 2;
              },
            },
          },
        ],

        defaultStyle: {
          fontSize: 6,
        },
      };

      pdfMake
        .createPdf(documento)
        .download(
          `Relatorio_Compras_${identificacaoFiltro}_Convenio_${identificacaoConvenio}.pdf`
        );

    } catch (error: any) {
      console.error("Erro ao gerar PDF completo:", error);

      setErro(
        error.response?.data?.message ||
        "Não foi possível gerar o PDF completo."
      );

    } finally {
      setGerandoPDF(false);
    }
  }

  // NOME DO CONVÊNIO PARA EXIBIÇÃO.
  const nomeConvenioSelecionado =
    convenio !== ""
      ? convenios.find(
          (item) => item.id_Convenio === convenio
        )?.con_Fantasia || "Convênio selecionado"
      : "Todos os convênios";

  return (
    <div className="p-6">

      {/* TÍTULO */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Relatório de Compras
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Consulte as compras realizadas e suas respectivas parcelas.
        </p>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">

          {/* ANO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ano
            </label>

            <input
              type="number"
              value={ano}
              onChange={(e) => {
                setAno(Number(e.target.value));
                limparConsulta();
              }}
              min={2000}
              max={2100}
              className="border border-gray-300 rounded-md px-3 py-2 w-32"
            />
          </div>

          {/* MÊS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mês
            </label>

            <select
              value={mes}
              onChange={(e) => {
                setMes(
                  e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                );

                limparConsulta();
              }}
              className="border border-gray-300 rounded-md px-3 py-2 w-48 bg-white"
            >
              <option value="">Todos os meses</option>

              {meses.map((item) => (
                <option
                  key={item.valor}
                  value={item.valor}
                >
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          {/* NOVO FILTRO DE CONVÊNIO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Convênio
            </label>

            <select
              value={convenio}
              onChange={(e) => {
                setConvenio(
                  e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                );

                limparConsulta();
              }}
              disabled={loadingConvenios}
              className="border border-gray-300 rounded-md px-3 py-2 w-64 bg-white disabled:bg-gray-100"
            >
              <option value="">
                {loadingConvenios
                  ? "Carregando convênios..."
                  : "Todos os convênios"}
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

          {/* CONSULTAR */}
          <button
            type="button"
            onClick={() => consultar(1)}
            disabled={
              loading ||
              gerandoPDF ||
              !ano ||
              loadingConvenios
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md disabled:opacity-50"
          >
            {loading ? "Consultando..." : "Consultar"}
          </button>

          {/* GERAR PDF */}
          <button
            type="button"
            onClick={gerarPDF}
            disabled={
              gerandoPDF ||
              loading ||
              !dados ||
              dados.total === 0
            }
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md disabled:opacity-50"
          >
            {gerandoPDF
              ? "Gerando relatório completo..."
              : "Gerar PDF completo"}
          </button>

        </div>
      </div>

      {/* ERROS */}
      {erro && (
        <div className="bg-red-100 border border-red-300 text-red-700 rounded-md p-3 mb-4">
          {erro}
        </div>
      )}

      {/* RESUMO E TOTALIZADORES */}
      {dados && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4 mb-6">

          {/* ANO */}
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Ano consultado
            </p>

            <p className="text-xl font-bold text-gray-800">
              {dados.ano}
            </p>
          </div>

          {/* MÊS */}
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Mês consultado
            </p>

            <p className="text-lg font-bold text-gray-800">
              {dados.mes
                ? meses.find(
                    (item) => item.valor === dados.mes
                  )?.nome
                : "Todos"}
            </p>
          </div>

          {/* CONVÊNIO */}
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Convênio consultado
            </p>

            <p
              className="text-sm font-bold text-gray-800 mt-1"
              title={nomeConvenioSelecionado}
            >
              {nomeConvenioSelecionado}
            </p>
          </div>

          {/* TOTAL DE COMPRAS */}
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Total de compras
            </p>

            <p className="text-xl font-bold text-gray-800">
              {dados.total.toLocaleString("pt-BR")}
            </p>
          </div>

          {/* TOTAL DE VENDAS */}
          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500">
              Total de vendas
            </p>

            <p className="text-xl font-bold text-blue-700">
              {totalizadores.quantidadeVendas.toLocaleString("pt-BR")}
            </p>
          </div>

          {/* VALOR TOTAL VENDIDO */}
          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">
              Valor total vendido
            </p>

            <p className="text-lg font-bold text-green-700">
              {formatarMoeda(totalizadores.valorTotalVendido)}
            </p>
          </div>

          {/* PÁGINA ATUAL */}
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Página atual
            </p>

            <p className="text-xl font-bold text-gray-800">
              {dados.pagina} de {dados.totalPaginas}
            </p>
          </div>

        </div>
      )}

      {/* TABELA DE COMPRAS */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">

          <table className="w-full text-sm text-left">

            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3">Compra</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Associado / Convênio</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Parcelas</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-gray-500"
                  >
                    Carregando compras...
                  </td>
                </tr>
              ) : dados && dados.compras.length > 0 ? (

                dados.compras.map((compra) => (
                  <Fragment key={compra.id_compra}>

                    <tr className="border-t hover:bg-gray-50">

                      <td className="px-4 py-3">
                        {compra.id_compra}
                      </td>

                      <td className="px-4 py-3">
                        {formatarData(compra.emissao_compra)}
                      </td>

                      {/* ASSOCIADO E CONVÊNIO */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">
                            {compra.nome_user || "-"}
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            Convênio:{" "}
                            {compra.con_Fantasia || "Não informado"}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatarMoeda(compra.valor_compra)}
                      </td>

                      <td className="px-4 py-3">
                        {compra.parcelas?.length || 0}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            alternarParcelas(compra.id_compra)
                          }
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {compraExpandida === compra.id_compra
                            ? "Ocultar parcelas"
                            : "Ver parcelas"}
                        </button>
                      </td>

                    </tr>

                    {/* PARCELAS EXPANDIDAS */}
                    {compraExpandida === compra.id_compra && (
                      <tr className="bg-gray-50">

                        <td colSpan={6} className="px-6 py-4">

                          {compra.parcelas &&
                          compra.parcelas.length > 0 ? (

                            <div>

                              <h3 className="font-semibold text-gray-700 mb-3">
                                Parcelas da compra #{compra.id_compra}
                              </h3>

                              <div className="overflow-x-auto">

                                <table className="w-full text-sm border border-gray-200">

                                  <thead className="bg-gray-200">
                                    <tr>
                                      <th className="p-2 text-left">
                                        Parcela
                                      </th>

                                      <th className="p-2 text-left">
                                        Servidor na parcela
                                      </th>

                                      <th className="p-2 text-left">
                                        Vencimento
                                      </th>

                                      <th className="p-2 text-left">
                                        Valor
                                      </th>

                                      <th className="p-2 text-left">
                                        Status
                                      </th>

                                      <th className="p-2 text-left">
                                        Vencimento original
                                      </th>

                                      <th className="p-2 text-left">
                                        Antecipação
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>

                                    {compra.parcelas.map((parcela) => (
                                      <tr
                                        key={parcela.id_parcela}
                                        className="border-t border-gray-200"
                                      >

                                        <td className="p-2">
                                          {parcela.id_parcela}
                                        </td>

                                        <td className="p-2">
                                          {parcela.par_nomServidor || "-"}
                                        </td>

                                        <td className="p-2">
                                          {formatarData(parcela.venc_parcela)}
                                        </td>

                                        <td className="p-2 whitespace-nowrap">
                                          {formatarMoeda(parcela.valor_parcela)}
                                        </td>

                                        <td className="p-2">
                                          {parcela.status_parcela}
                                        </td>

                                        <td className="p-2">
                                          {formatarData(parcela.vct_original)}
                                        </td>

                                        <td className="p-2">
                                          {formatarData(parcela.par_datAntecipacao)}
                                        </td>

                                      </tr>
                                    ))}

                                  </tbody>

                                </table>

                              </div>

                            </div>

                          ) : (

                            <p className="text-gray-500">
                              Nenhuma parcela encontrada para esta compra.
                            </p>

                          )}

                        </td>

                      </tr>
                    )}

                  </Fragment>
                ))

              ) : (

                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-gray-500"
                  >
                    {dados
                      ? "Nenhuma compra encontrada para os filtros selecionados."
                      : "Selecione o ano, mês e convênio e clique em Consultar."}
                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </div>
      </div>

      {/* PAGINAÇÃO */}
      {dados && dados.totalPaginas > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5">

          <p className="text-sm text-gray-600">
            Página {dados.pagina} de {dados.totalPaginas}
          </p>

          <div className="flex gap-2">

            <button
              type="button"
              onClick={() => consultar(pagina - 1)}
              disabled={
                pagina <= 1 ||
                loading ||
                gerandoPDF
              }
              className="border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-100 disabled:opacity-40"
            >
              Anterior
            </button>

            <button
              type="button"
              onClick={() => consultar(pagina + 1)}
              disabled={
                pagina >= dados.totalPaginas ||
                loading ||
                gerandoPDF
              }
              className="border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-100 disabled:opacity-40"
            >
              Próxima
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
