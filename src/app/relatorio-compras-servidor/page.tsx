
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
  id_servidor: string | number | null;
  id_matricula?: string | number | null;
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

interface Servidor {
  id_user: string | number;
  id_matricula: string | number;
  nome_user: string;
}

interface RelatorioResponse {
  success: boolean;
  ano: number;
  mes: number | null;
  convenio: number | null;
  servidor?: string | null;
  total: number;
  totalVendas: number;
  valorTotalVendido: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  totalServidores?: number;
  compras: Compra[];
}

interface GrupoServidor {
  chave: string;
  nome: string;
  matricula: string;
  compras: Compra[];
  quantidade: number;
  valorTotal: number;
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

function agruparCompras(compras: Compra[]): GrupoServidor[] {
  const grupos = new Map<string, GrupoServidor>();

  compras.forEach((compra) => {
    const chave =
      compra.id_servidor !== null &&
      compra.id_servidor !== undefined
        ? String(compra.id_servidor)
        : "sem-servidor";

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        nome: compra.nome_user || "Servidor não identificado",
        matricula: compra.id_matricula
          ? String(compra.id_matricula)
          : "-",
        compras: [],
        quantidade: 0,
        valorTotal: 0,
      });
    }

    const grupo = grupos.get(chave)!;

    grupo.compras.push(compra);
    grupo.quantidade += 1;
    grupo.valorTotal += Number(compra.valor_compra || 0);
  });

  return Array.from(grupos.values());
}

export default function RelatorioComprasServidor() {
  const [ano, setAno] = useState<number>(2026);

  const [mes, setMes] = useState<number | "">("");

  const [convenio, setConvenio] = useState<number | "">("");
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loadingConvenios, setLoadingConvenios] = useState(false);

  // Agora o filtro é digitado pela matrícula.
  const [matricula, setMatricula] = useState("");
  const [servidorEncontrado, setServidorEncontrado] =
    useState<Servidor | null>(null);

  const [pagina, setPagina] = useState(1);
  const [limite] = useState(50);

  const [dados, setDados] = useState<RelatorioResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [erro, setErro] = useState("");

  const [compraExpandida, setCompraExpandida] =
    useState<number | null>(null);

  const grupos = dados ? agruparCompras(dados.compras) : [];

  useEffect(() => {
    setAno(new Date().getFullYear());
  }, []);

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
            "Não foi possível carregar os convênios."
        );
      } finally {
        setLoadingConvenios(false);
      }
    }

    carregarConvenios();
  }, []);

  function limparConsulta() {
    setDados(null);
    setPagina(1);
    setCompraExpandida(null);
    setErro("");
  }

  function alternarParcelas(idCompra: number) {
    setCompraExpandida((atual) =>
      atual === idCompra ? null : idCompra
    );
  }

  // Busca o servidor pela matrícula.
  // Se o campo estiver vazio, retorna null e o relatório
  // será consultado para todos os servidores.
  async function resolverServidor(): Promise<string | null> {
    const matriculaInformada = matricula.trim();

    if (!matriculaInformada) {
      setServidorEncontrado(null);
      return null;
    }

    if (!/^\d+$/.test(matriculaInformada)) {
      throw new Error("Informe uma matrícula numérica válida.");
    }

    const response = await api.get("/servidores", {
      params: {
        matricula: matriculaInformada,
      },
    });

    const servidor = response.data?.servidor as
      | Servidor
      | undefined;

    if (!servidor?.id_user) {
      throw new Error("Servidor não encontrado.");
    }

    setServidorEncontrado(servidor);

    // Mantém como string para não perder precisão de BIGINT.
    return String(servidor.id_user);
  }

  // Parâmetros utilizados na consulta e no PDF.
  function obterParametros(idServidor: string | null) {
    return {
      ano,
      ordenacao: "servidor",
      ...(mes !== "" ? { mes } : {}),
      ...(convenio !== "" ? { convenio } : {}),
      ...(idServidor !== null
        ? { servidor: idServidor }
        : {}),
    };
  }

  async function consultar(numeroPagina = 1) {
    try {
      setLoading(true);
      setErro("");
      setCompraExpandida(null);

      const idServidor = await resolverServidor();

      const response = await api.get<RelatorioResponse>(
        "/relatorioCompras",
        {
          params: {
            ...obterParametros(idServidor),
            pagina: numeroPagina,
            limite,
          },
        }
      );

      const resultado = response.data;

      if (!resultado.success) {
        throw new Error("Não foi possível consultar o relatório.");
      }

      setDados(resultado);
      setPagina(numeroPagina);
    } catch (error: any) {
      console.error("Erro ao consultar relatório:", error);

      setDados(null);

      setErro(
        error.response?.data?.message ||
          error.message ||
          "Não foi possível consultar o relatório."
      );
    } finally {
      setLoading(false);
    }
  }

  async function gerarPDF() {
    try {
      setGerandoPDF(true);
      setErro("");

      // Resolve a matrícula somente uma vez.
      const idServidor = await resolverServidor();

      const parametros = obterParametros(idServidor);

      // Busca a primeira página.
      const primeiraResposta = await api.get<RelatorioResponse>(
        "/relatorioCompras",
        {
          params: {
            ...parametros,
            pagina: 1,
            limite,
          },
        }
      );

      const primeiraPagina = primeiraResposta.data;

      if (!primeiraPagina.success || primeiraPagina.total === 0) {
        setErro("Não existem compras para gerar o PDF.");
        return;
      }

      let todasCompras: Compra[] = [
        ...primeiraPagina.compras,
      ];

      // A paginação agora é por servidor.
      for (
        let numeroPagina = 2;
        numeroPagina <= primeiraPagina.totalPaginas;
        numeroPagina++
      ) {
        const resposta = await api.get<RelatorioResponse>(
          "/relatorioCompras",
          {
            params: {
              ...parametros,
              pagina: numeroPagina,
              limite,
            },
          }
        );

        todasCompras.push(...resposta.data.compras);
      }

      // Agrupa todas as compras por servidor.
      const gruposPDF = agruparCompras(todasCompras);

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

      const corpoTabela: any[] = [
        [
          { text: "Compra", bold: true, fontSize: 6 },
          { text: "Emissão", bold: true, fontSize: 6 },
          { text: "Associado / Convênio", bold: true, fontSize: 6 },
          { text: "Valor compra", bold: true, fontSize: 6 },
          { text: "Parc.", bold: true, fontSize: 6 },
          { text: "Servidor parcela", bold: true, fontSize: 6 },
          { text: "Vencimento", bold: true, fontSize: 6 },
          { text: "Valor parc.", bold: true, fontSize: 6 },
          { text: "Status", bold: true, fontSize: 6 },
        ],
      ];

      gruposPDF.forEach((grupo) => {
        // Cabeçalho do servidor.
        corpoTabela.push([
          {
            text: `SERVIDOR: ${grupo.nome} | MATRÍCULA: ${grupo.matricula}`,
            colSpan: 9,
            bold: true,
            fontSize: 8,
            fillColor: "#e2e8f0",
            margin: [3, 4, 3, 4],
          },
          {}, {}, {}, {}, {}, {}, {}, {},
        ]);

        grupo.compras.forEach((compra) => {
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

          if (compra.parcelas?.length > 0) {
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

        // Subtotal do servidor.
        corpoTabela.push([
          {
            text: `SUBTOTAL ${grupo.nome} — ${grupo.quantidade} compras`,
            colSpan: 3,
            bold: true,
            fontSize: 7,
            fillColor: "#f1f5f9",
            margin: [3, 3, 3, 3],
          },
          {},
          {},
          {
            text: formatarMoeda(grupo.valorTotal),
            bold: true,
            fontSize: 7,
            fillColor: "#f1f5f9",
          },
          {
            text: "",
            colSpan: 5,
            fillColor: "#f1f5f9",
          },
          {}, {}, {}, {},
        ]);
      });

      const nomeMes =
        mes !== ""
          ? meses.find((item) => item.valor === mes)?.nome
          : "Todos os meses";

      const nomeConvenio =
        convenio !== ""
          ? convenios.find(
              (item) => item.id_Convenio === convenio
            )?.con_Fantasia || "Convênio selecionado"
          : "Todos os convênios";

      const nomeServidor = servidorEncontrado
        ? `${servidorEncontrado.nome_user} - Matrícula: ${servidorEncontrado.id_matricula}`
        : "Todos os servidores";

      const totalCompras = todasCompras.reduce(
        (total, compra) => total + 1,
        0
      );

      const valorTotal = gruposPDF.reduce(
        (total, grupo) => total + grupo.valorTotal,
        0
      );

      const identificacaoFiltro =
        mes !== ""
          ? `${ano}_${String(mes).padStart(2, "0")}`
          : String(ano);

      const identificacaoServidor =
        idServidor !== null ? idServidor : "Todos";

      const documento = {
        pageOrientation: "portrait",
        pageSize: "A4",
        pageMargins: [15, 25, 15, 25],

        content: [
          {
            text: "RELATÓRIO DE COMPRAS POR SERVIDOR",
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
            text: `Convênio: ${nomeConvenio} | Servidor: ${nomeServidor}`,
            fontSize: 8,
            alignment: "center",
            margin: [0, 0, 0, 8],
          },
          {
            text: `TOTAL DE SERVIDORES: ${gruposPDF.length}`,
            fontSize: 9,
            bold: true,
            alignment: "center",
            margin: [0, 2, 0, 2],
          },
          {
            text: `TOTAL DE COMPRAS: ${totalCompras.toLocaleString("pt-BR")}`,
            fontSize: 9,
            bold: true,
            alignment: "center",
            margin: [0, 2, 0, 2],
          },
          {
            text: `VALOR TOTAL VENDIDO: ${formatarMoeda(valorTotal)}`,
            fontSize: 11,
            bold: true,
            color: "#15803d",
            alignment: "center",
            margin: [0, 2, 0, 8],
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
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.3,
              paddingLeft: () => 2,
              paddingRight: () => 2,
              paddingTop: () => 2,
              paddingBottom: () => 2,
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
          `Relatorio_Compras_Por_Servidor_${identificacaoFiltro}_Servidor_${identificacaoServidor}.pdf`
        );
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);

      setErro(
        error.response?.data?.message ||
          error.message ||
          "Não foi possível gerar o PDF."
      );
    } finally {
      setGerandoPDF(false);
    }
  }

  const nomeServidorSelecionado = servidorEncontrado
    ? `${servidorEncontrado.nome_user} - Matrícula: ${servidorEncontrado.id_matricula}`
    : "Todos os servidores";

  const nomeConvenioSelecionado =
    convenio !== ""
      ? convenios.find(
          (item) => item.id_Convenio === convenio
        )?.con_Fantasia || "Convênio selecionado"
      : "Todos os convênios";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Relatório de Compras por Servidor
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Compras agrupadas por servidor, com subtotal individual
          e total geral.
        </p>
      </div>

      {/* FILTROS */}
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
                limparConsulta();
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
                limparConsulta();
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

          {/* MATRÍCULA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Matrícula do servidor
            </label>

            <input
              type="text"
              inputMode="numeric"
              value={matricula}
              onChange={(e) => {
                setMatricula(e.target.value.replace(/\D/g, ""));
                setServidorEncontrado(null);
                limparConsulta();
              }}
              placeholder="Em branco = todos"
              className="border border-gray-300 rounded-md px-3 py-2 w-64"
            />

            {servidorEncontrado && (
              <p className="text-xs text-green-700 mt-1">
                {servidorEncontrado.nome_user}
              </p>
            )}
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
            {gerandoPDF ? "Gerando PDF..." : "Gerar PDF completo"}
          </button>
        </div>
      </div>

      {/* ERRO */}
      {erro && (
        <div className="bg-red-100 border border-red-300 text-red-700 rounded-md p-3 mb-4">
          {erro}
        </div>
      )}

      {/* RESUMO */}
      {dados && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">Ano consultado</p>
            <p className="text-xl font-bold text-gray-800">
              {dados.ano}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">Servidores nesta página</p>
            <p className="text-xl font-bold text-gray-800">
              {grupos.length}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-sm text-gray-500">Total de compras</p>
            <p className="text-xl font-bold text-gray-800">
              {dados.total.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500">Servidor consultado</p>
            <p className="text-sm font-bold text-gray-800 mt-1">
              {nomeServidorSelecionado}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Valor total vendido</p>
            <p className="text-lg font-bold text-green-700">
              {formatarMoeda(dados.valorTotalVendido)}
            </p>
          </div>
        </div>
      )}

      {/* RELATÓRIO AGRUPADO POR SERVIDOR */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Carregando compras...
          </div>
        ) : dados && grupos.length > 0 ? (
          grupos.map((grupo) => (
            <div
              key={grupo.chave}
              className="bg-white rounded-lg shadow overflow-hidden"
            >
              {/* CABEÇALHO DO SERVIDOR */}
              <div className="bg-slate-100 border-b border-slate-200 p-4 flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-bold text-lg text-slate-800">
                    {grupo.nome}
                  </h2>

                  <p className="text-sm text-slate-600">
                    Matrícula: {grupo.matricula}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    Compras do servidor
                  </p>

                  <p className="font-bold text-slate-800">
                    {grupo.quantidade}
                  </p>
                </div>
              </div>

              {/* COMPRAS DO SERVIDOR */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700">
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
                    {grupo.compras.map((compra) => (
                      <Fragment key={compra.id_compra}>
                        <tr className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {compra.id_compra}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatarData(compra.emissao_compra)}
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">
                              {compra.nome_user || "-"}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              Convênio: {compra.con_Fantasia || "Não informado"}
                            </p>
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
                              {compra.parcelas?.length > 0 ? (
                                <div>
                                  <h3 className="font-semibold text-gray-700 mb-3">
                                    Parcelas da compra #{compra.id_compra}
                                  </h3>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-200">
                                      <thead className="bg-gray-200">
                                        <tr>
                                          <th className="p-2 text-left">Parcela</th>
                                          <th className="p-2 text-left">Servidor na parcela</th>
                                          <th className="p-2 text-left">Vencimento</th>
                                          <th className="p-2 text-left">Valor</th>
                                          <th className="p-2 text-left">Status</th>
                                          <th className="p-2 text-left">Vencimento original</th>
                                          <th className="p-2 text-left">Antecipação</th>
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
                                  Nenhuma parcela encontrada.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>

                  {/* SUBTOTAL DO SERVIDOR */}
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td
                        colSpan={3}
                        className="px-4 py-4 font-bold text-blue-900"
                      >
                        SUBTOTAL — {grupo.nome}
                      </td>

                      <td className="px-4 py-4 font-bold text-blue-900 whitespace-nowrap">
                        {formatarMoeda(grupo.valorTotal)}
                      </td>

                      <td
                        colSpan={2}
                        className="px-4 py-4 font-bold text-blue-900"
                      >
                        {grupo.quantidade} compras
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            {dados
              ? "Nenhuma compra encontrada para os filtros selecionados."
              : "Informe os filtros desejados e clique em Consultar."}
          </div>
        )}
      </div>

      {/* TOTAL GERAL */}
      {dados && dados.compras.length > 0 && (
        <div className="bg-slate-800 text-white rounded-lg shadow p-5 mt-6 flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">
              Total geral de compras
            </p>

            <p className="text-2xl font-bold">
              {dados.total.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-300">
              Valor total geral
            </p>

            <p className="text-2xl font-bold text-green-300">
              {formatarMoeda(dados.valorTotalVendido)}
            </p>
          </div>
        </div>
      )}

      {/* PAGINAÇÃO POR SERVIDOR */}
      {dados && dados.totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
          <p className="text-sm text-gray-600">
            Página {dados.pagina} de {dados.totalPaginas}
            {dados.totalServidores !== undefined &&
              ` — ${dados.totalServidores} servidores`}
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
