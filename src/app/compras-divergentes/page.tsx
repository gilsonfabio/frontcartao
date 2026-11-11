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

interface RelatorioResponse {
  success: boolean;
  ano: number;
  mes: number | null;
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  compras: Compra[];
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

function formatarData(data: string | null | undefined): string {
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

  const [pagina, setPagina] = useState(1);
  const [limite] = useState(50);

  const [dados, setDados] = useState<RelatorioResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [erro, setErro] = useState("");

  const [compraExpandida, setCompraExpandida] = useState<number | null>(
    null
  );

  useEffect(() => {
    setAno(new Date().getFullYear());
  }, []);

  function alternarParcelas(idCompra: number) {
    setCompraExpandida((atual) =>
      atual === idCompra ? null : idCompra
    );
  }

  // Parâmetros comuns aos filtros.
  function obterParametros() {
    return {
      ano,
      ...(mes !== "" ? { mes } : {}),
    };
  }

  // Consulta o relatório paginado.
  async function consultar(numeroPagina = 1) {
    try {
      setLoading(true);
      setErro("");
      setCompraExpandida(null);

      const response = await api.get<RelatorioResponse>(
        "/relComprasDivergentes",
        {
          params: {
            ...obterParametros(),
            pagina: numeroPagina,
            limite,
          },
        }
      );

      setDados(response.data);
      setPagina(numeroPagina);
    } catch (error: any) {
      console.error("Erro ao consultar relatório:", error);

      setDados(null);

      setErro(
        error.response?.data?.message ||
          "Não foi possível consultar o relatório de compras divergentes."
      );
    } finally {
      setLoading(false);
    }
  }

  // Gera PDF com todas as compras do ano ou mês selecionado.
  async function gerarPDF() {
    try {
      setGerandoPDF(true);
      setErro("");

      const limitePDF = 100;

      // Busca a primeira página.
      const primeiraResposta = await api.get<RelatorioResponse>(
        "/relComprasDivergentes",
        {
          params: {
            ...obterParametros(),
            pagina: 1,
            limite: limitePDF,
          },
        }
      );

      const primeiraPagina = primeiraResposta.data;

      if (!primeiraPagina.success || primeiraPagina.total === 0) {
        setErro("Não existem compras divergentes para gerar o PDF.");
        return;
      }

      let todasCompras: Compra[] = [
        ...primeiraPagina.compras,
      ];

      // Busca todas as demais páginas respeitando o mesmo filtro.
      for (
        let numeroPagina = 2;
        numeroPagina <= primeiraPagina.totalPaginas;
        numeroPagina++
      ) {
        const resposta = await api.get<RelatorioResponse>(
          "/relComprasDivergentes",
          {
            params: {
              ...obterParametros(),
              pagina: numeroPagina,
              limite: limitePDF,
            },
          }
        );

        todasCompras = [
          ...todasCompras,
          ...resposta.data.compras,
        ];
      }

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
          { text: "Compra", bold: true },
          { text: "Emissão", bold: true },
          { text: "Associado / Convênio", bold: true },
          { text: "Valor compra", bold: true },
          { text: "Parcela", bold: true },
          { text: "Servidor na parcela", bold: true },
          { text: "Vencimento", bold: true },
          { text: "Valor parcela", bold: true },
          { text: "Status", bold: true },
        ],
      ];

      // Percorre todas as compras e parcelas.
      todasCompras.forEach((compra) => {

        // Associado e convênio na mesma coluna.
        const associadoConvenio = {
          stack: [
            {
              text: compra.nome_user?.trim() || "-",
              bold: true,
              fontSize: 7,
            },
            {
              text: `Convênio: ${compra.con_Fantasia?.trim() || "Não informado"}`,
              fontSize: 6,
              color: "#666666",
            },
          ],
        };

        if (compra.parcelas && compra.parcelas.length > 0) {
          compra.parcelas.forEach((parcela, index) => {
            corpoTabela.push([
              index === 0
                ? String(compra.id_compra)
                : "",

              index === 0
                ? formatarData(compra.emissao_compra)
                : "",

              index === 0
                ? associadoConvenio
                : "",

              index === 0
                ? formatarMoeda(compra.valor_compra)
                : "",

              String(parcela.id_parcela),

              parcela.par_nomServidor?.trim() || "-",

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

      const nomeMes = mes !== ""
        ? meses.find((item) => item.valor === mes)?.nome
        : "Todos os meses";

      const identificacaoFiltro = mes !== ""
        ? `${ano}_${String(mes).padStart(2, "0")}`
        : String(ano);

      // Documento PDF.
      const documento = {
        pageOrientation: "landscape",
        pageSize: "A4",
        pageMargins: [20, 30, 20, 30],

        content: [
          {
            text: "RELATÓRIO DE COMPRAS DIVERGENTES",
            fontSize: 16,
            bold: true,
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          {
            text: `Ano: ${ano} | Período: ${nomeMes} | Total de compras: ${primeiraPagina.total}`,
            fontSize: 10,
            margin: [0, 0, 0, 10],
          },
          {
            text: `Compras carregadas: ${todasCompras.length}`,
            fontSize: 9,
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: [
                42,
                52,
                "*",
                62,
                32,
                100,
                55,
                62,
                40,
              ],
              body: corpoTabela,
            },
            layout: "lightHorizontalLines",
          },
        ],

        defaultStyle: {
          fontSize: 7,
        },
      };

      pdfMake
        .createPdf(documento)
        .download(`Relatorio_Compras_Divergentes_${identificacaoFiltro}.pdf`);

    } catch (error: any) {
      console.error("Erro ao gerar PDF de compras divergentes:", error);

      setErro(
        error.response?.data?.message ||
          "Não foi possível gerar o PDF de compras divergentes."
      );
    } finally {
      setGerandoPDF(false);
    }
  }
   
  return (
    <div className="p-6">
      {/* Título */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Relatório de Compras Divergentes
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Consulte compras em que o nome do associado é diferente do servidor informado nas parcelas.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ano
            </label>

            <input
              type="number"
              value={ano}
              onChange={(e) => {
                setAno(Number(e.target.value));
                setDados(null);
                setPagina(1);
                setCompraExpandida(null);
              }}
              min={2000}
              max={2100}
              className="border border-gray-300 rounded-md px-3 py-2 w-32"
            />
          </div>

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
                setDados(null);
                setPagina(1);
                setCompraExpandida(null);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 w-48 bg-white"
            >
              <option value="">Todos os meses</option>

              {meses.map((item) => (
                <option key={item.valor} value={item.valor}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => consultar(1)}
            disabled={loading || gerandoPDF || !ano}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md disabled:opacity-50"
          >
            {loading ? "Consultando..." : "Consultar"}
          </button>

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

      {/* Erros */}
      {erro && (
        <div className="bg-red-100 border border-red-300 text-red-700 rounded-md p-3 mb-4">
          {erro}
        </div>
      )}

      {/* Resumo */}
      {dados && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Ano consultado
            </p>

            <p className="text-xl font-bold text-gray-800">
              {dados.ano}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Mês consultado
            </p>

            <p className="text-xl font-bold text-gray-800">
              {dados.mes
                ? meses.find((item) => item.valor === dados.mes)?.nome
                : "Todos"}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Total de compras
            </p>

            <p className="text-xl font-bold text-gray-800">
              {dados.total.toLocaleString("pt-BR")}
            </p>
          </div>

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

      {/* Tabela de compras */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3">Compra</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Associado</th>
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

                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">
                            {compra.nome_user?.trim() || "-"}
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            Convênio: {compra.con_Fantasia?.trim() || "Não informado"}
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
                      : "Selecione o ano e o mês e clique em Consultar."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {dados && dados.totalPaginas > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
          <p className="text-sm text-gray-600">
            Página {dados.pagina} de {dados.totalPaginas}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => consultar(pagina - 1)}
              disabled={pagina <= 1 || loading || gerandoPDF}
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
