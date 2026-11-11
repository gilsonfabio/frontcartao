"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"
).replace(/\/+$/, "");

type TipoPessoa = "F" | "J";
type Status = "ATIVO" | "INATIVO";

interface Transportadora {
  id: string;
  empresa_id: string;
  tipo_pessoa: TipoPessoa;
  nome_razao_social: string;
  nome_fantasia: string | null;
  cpf_cnpj: string;
  inscricao_estadual: string | null;
  rntrc: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  codigo_municipio_ibge: string | null;
  uf: string | null;
  status: Status;
}

interface DadosSessao {
  success: boolean;
  empresa: {
    nome_fantasia?: string | null;
    razao_social: string;
  };
  usuario: {
    nome: string;
    email: string;
  };
  perfil: string;
}

interface FormularioTransportadora {
  tipo_pessoa: TipoPessoa;
  nome_razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  inscricao_estadual: string;
  rntrc: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  codigo_municipio_ibge: string;
  uf: string;
}

const formularioInicial: FormularioTransportadora = {
  tipo_pessoa: "J",
  nome_razao_social: "",
  nome_fantasia: "",
  cpf_cnpj: "",
  inscricao_estadual: "",
  rntrc: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  codigo_municipio_ibge: "",
  uf: "",
};

function mensagemErro(dados: unknown, alternativa: string) {
  if (
    dados &&
    typeof dados === "object" &&
    "message" in dados &&
    typeof dados.message === "string"
  ) {
    return dados.message;
  }

  return alternativa;
}

function formatarDocumento(valor: string, tipo: TipoPessoa) {
  const numeros = valor
    .replace(/\D/g, "")
    .slice(0, tipo === "F" ? 11 : 14);

  if (tipo === "F") {
    return numeros
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return numeros
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 11);

  if (numeros.length <= 10) {
    return numeros
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numeros
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatarCep(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 8);
  return numeros.replace(/^(\d{5})(\d)/, "$1-$2");
}

function exibirDocumento(transportadora: Transportadora) {
  return formatarDocumento(
    transportadora.cpf_cnpj || "",
    transportadora.tipo_pessoa
  );
}

function Campo({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>
      {children}
    </label>
  );
}

const classeInput =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export default function TransportadorasPage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [usuarioNome, setUsuarioNome] = useState("");

  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("ATIVO");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [transportadoraEditando, setTransportadoraEditando] =
    useState<string | null>(null);

  const [formulario, setFormulario] =
    useState<FormularioTransportadora>(formularioInicial);

  const sair = useCallback(() => {
    sessionStorage.removeItem("newnfe_token");
    sessionStorage.removeItem("newnfe_usuario");
    sessionStorage.removeItem("newnfe_empresa");
    sessionStorage.removeItem("newnfe_perfil");
    router.replace("/login");
  }, [router]);

  const requisicao = useCallback(
    async (url: string, opcoes: RequestInit = {}) => {
      const resposta = await fetch(`${API_URL}${url}`, {
        ...opcoes,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
          ...opcoes.headers,
        },
        cache: "no-store",
      });

      if (resposta.status === 401 || resposta.status === 403) {
        sair();
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          mensagemErro(dados, "Não foi possível concluir a operação.")
        );
      }

      return dados;
    },
    [token, sair]
  );

  const carregarTransportadoras = useCallback(async () => {
    if (!token) return;

    setCarregando(true);
    setErro("");

    try {
      const parametros = new URLSearchParams();

      if (busca.trim()) {
        parametros.set("busca", busca.trim());
      }

      if (statusFiltro) {
        parametros.set("status", statusFiltro);
      }

      const dados = await requisicao(
        `/transportadoras${parametros.toString() ? `?${parametros}` : ""}`
      );

      setTransportadoras(
        Array.isArray(dados.transportadoras) ? dados.transportadoras : []
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar transportadoras."
      );
    } finally {
      setCarregando(false);
    }
  }, [token, busca, statusFiltro, requisicao]);

  // Recupera o token da sessão.
  useEffect(() => {
    const tokenSalvo = sessionStorage.getItem("newnfe_token");

    if (!tokenSalvo) {
      router.replace("/login");
      return;
    }

    setToken(tokenSalvo);
  }, [router]);

  // Identifica a empresa e o usuário autenticado.
  useEffect(() => {
    if (!token) return;

    let cancelado = false;

    async function carregarSessao() {
      try {
        const resposta = await fetch(`${API_URL}/empresa/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (resposta.status === 401 || resposta.status === 403) {
          sair();
          return;
        }

        if (!resposta.ok) {
          throw new Error("Não foi possível validar a sessão.");
        }

        const dados: DadosSessao = await resposta.json();

        if (!dados.success || !dados.empresa) {
          throw new Error("Resposta inválida da API.");
        }

        if (!cancelado) {
          setEmpresaNome(
            dados.empresa.nome_fantasia || dados.empresa.razao_social
          );

          setUsuarioNome(dados.usuario?.nome || "Usuário");
        }
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof Error
              ? error.message
              : "Erro ao validar a sessão."
          );
        }
      }
    }

    void carregarSessao();

    return () => {
      cancelado = true;
    };
  }, [token, sair]);

  // Carrega a listagem quando os filtros são alterados.
  useEffect(() => {
    if (token) {
      void carregarTransportadoras();
    }
  }, [token, carregarTransportadoras]);

  function abrirNovaTransportadora() {
    setTransportadoraEditando(null);
    setFormulario({ ...formularioInicial });
    setErro("");
    setSucesso("");
    setModalAberto(true);
  }

  function abrirEdicao(transportadora: Transportadora) {
    setTransportadoraEditando(transportadora.id);

    setFormulario({
      tipo_pessoa: transportadora.tipo_pessoa,
      nome_razao_social: transportadora.nome_razao_social || "",
      nome_fantasia: transportadora.nome_fantasia || "",
      cpf_cnpj: formatarDocumento(
        transportadora.cpf_cnpj || "",
        transportadora.tipo_pessoa
      ),
      inscricao_estadual: transportadora.inscricao_estadual || "",
      rntrc: transportadora.rntrc || "",
      email: transportadora.email || "",
      telefone: formatarTelefone(transportadora.telefone || ""),
      cep: formatarCep(transportadora.cep || ""),
      logradouro: transportadora.logradouro || "",
      numero: transportadora.numero || "",
      complemento: transportadora.complemento || "",
      bairro: transportadora.bairro || "",
      municipio: transportadora.municipio || "",
      codigo_municipio_ibge: transportadora.codigo_municipio_ibge || "",
      uf: transportadora.uf || "",
    });

    setErro("");
    setSucesso("");
    setModalAberto(true);
  }

  function atualizarCampo(
    campo: keyof FormularioTransportadora,
    valor: string
  ) {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function alterarTipoPessoa(tipo: TipoPessoa) {
    setFormulario((atual) => ({
      ...atual,
      tipo_pessoa: tipo,
      cpf_cnpj: formatarDocumento(atual.cpf_cnpj, tipo),
    }));
  }

  async function salvarTransportadora(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setErro("");
    setSucesso("");

    if (!formulario.nome_razao_social.trim()) {
      setErro("Informe o nome ou a razão social da transportadora.");
      return;
    }

    const documento = formulario.cpf_cnpj.replace(/\D/g, "");

    const tamanhoEsperado =
      formulario.tipo_pessoa === "F" ? 11 : 14;

    if (documento.length !== tamanhoEsperado) {
      setErro(
        formulario.tipo_pessoa === "F"
          ? "Informe um CPF com 11 dígitos."
          : "Informe um CNPJ com 14 dígitos."
      );
      return;
    }

    const cep = formulario.cep.replace(/\D/g, "");

    if (cep && cep.length !== 8) {
      setErro("O CEP deve possuir 8 dígitos.");
      return;
    }

    const codigoIBGE = formulario.codigo_municipio_ibge.replace(
      /\D/g,
      ""
    );

    if (codigoIBGE && codigoIBGE.length !== 7) {
      setErro("O código do município IBGE deve possuir 7 dígitos.");
      return;
    }

    const uf = formulario.uf.trim().toUpperCase();

    if (uf && uf.length !== 2) {
      setErro("Informe uma UF válida com 2 caracteres.");
      return;
    }

    const dados = {
      ...formulario,
      nome_razao_social: formulario.nome_razao_social.trim(),
      nome_fantasia: formulario.nome_fantasia.trim(),
      cpf_cnpj: documento,
      inscricao_estadual: formulario.inscricao_estadual.trim(),
      rntrc: formulario.rntrc.trim(),
      email: formulario.email.trim(),
      telefone: formulario.telefone.replace(/\D/g, ""),
      cep,
      codigo_municipio_ibge: codigoIBGE,
      uf,
    };

    setSalvando(true);

    try {
      const url = transportadoraEditando
        ? `/transportadoras/${transportadoraEditando}`
        : "/transportadoras";

      await requisicao(url, {
        method: transportadoraEditando ? "PUT" : "POST",
        body: JSON.stringify(dados),
      });

      setModalAberto(false);

      setSucesso(
        transportadoraEditando
          ? "Transportadora atualizada com sucesso."
          : "Transportadora cadastrada com sucesso."
      );

      await carregarTransportadoras();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao salvar transportadora."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function inativarTransportadora(transportadora: Transportadora) {
    const confirmado = window.confirm(
      `Deseja realmente inativar a transportadora "${transportadora.nome_razao_social}"?`
    );

    if (!confirmado) return;

    setErro("");
    setSucesso("");

    try {
      const dados = await requisicao(
        `/transportadoras/${transportadora.id}/inativar`,
        {
          method: "PATCH",
        }
      );

      setSucesso(
        mensagemErro(dados, "Transportadora inativada com sucesso.")
      );

      await carregarTransportadoras();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao inativar transportadora."
      );
    }
  }

  const nomeEmpresa = empresaNome || "Empresa";

  const iniciais = usuarioNome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  const totalAtivos = transportadoras.filter(
    (item) => item.status === "ATIVO"
  ).length;

  const totalInativos = transportadoras.filter(
    (item) => item.status === "INATIVO"
  ).length;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-600">
          Validando sua sessão...
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* MENU LATERAL */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-white md:flex">
        <div className="border-b border-slate-700 px-6 py-6">
          <h1 className="text-2xl font-bold tracking-wide">
            NewNFe
          </h1>

          <p className="mt-1 text-xs text-slate-400">
            Gestão fiscal e empresarial
          </p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          <button
            onClick={() => router.push("/painel")}
            className="w-full rounded-lg px-4 py-3 text-left font-medium text-slate-300 hover:bg-slate-800"
          >
            Visão geral
          </button>

          <p className="px-4 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Cadastros
          </p>

          <button
            onClick={() => router.push("/clientes")}
            className="w-full rounded-lg px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800"
          >
            Clientes
          </button>

          <button
            onClick={() => router.push("/fornecedores")}
            className="w-full rounded-lg px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800"
          >
            Fornecedores
          </button>

          <div className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium">
            Transportadoras
          </div>

          {["Produtos", "Grupos e linhas", "Empresas"].map(
            (item) => (
              <div
                key={item}
                className="rounded-lg px-4 py-2.5 text-sm text-slate-400"
              >
                {item}
                <span className="float-right text-xs">
                  Em breve
                </span>
              </div>
            )
          )}

          <p className="px-4 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Fiscal
          </p>

          {["Notas fiscais", "Relatórios", "Configurações"].map(
            (item) => (
              <div
                key={item}
                className="rounded-lg px-4 py-2.5 text-sm text-slate-400"
              >
                {item}
                <span className="float-right text-xs">
                  Em breve
                </span>
              </div>
            )
          )}
        </nav>

        <div className="border-t border-slate-700 p-5">
          <p className="truncate text-sm font-medium">
            {usuarioNome}
          </p>

          <p className="mt-1 truncate text-xs text-slate-400">
            {nomeEmpresa}
          </p>

          <button
            onClick={sair}
            className="mt-4 w-full rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Sair do sistema
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm text-gray-500">
              Cadastros
            </p>

            <h2 className="text-lg font-semibold text-gray-900">
              Transportadoras
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              {nomeEmpresa}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/painel")}
              className="hidden rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 sm:block"
            >
              Voltar ao painel
            </button>

            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800 sm:flex">
              {iniciais || "U"}
            </div>

            <button
              onClick={sair}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Sair
            </button>
          </div>
        </header>

        <div className="space-y-6 p-5 sm:p-8">
          {/* TÍTULO E BOTÃO NOVO */}
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Cadastro de transportadoras
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Gerencie as transportadoras vinculadas à empresa ativa.
              </p>
            </div>

            <button
              onClick={abrirNovaTransportadora}
              className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              + Nova transportadora
            </button>
          </section>

          {/* MENSAGENS */}
          {erro && !modalAberto && (
            <div
              role="alert"
              className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <span>{erro}</span>

              <button
                onClick={() => setErro("")}
                className="font-bold"
                aria-label="Fechar mensagem"
              >
                ×
              </button>
            </div>
          )}

          {sucesso && (
            <div
              role="status"
              className="flex items-start justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
            >
              <span>{sucesso}</span>

              <button
                onClick={() => setSucesso("")}
                className="font-bold"
                aria-label="Fechar mensagem"
              >
                ×
              </button>
            </div>
          )}

          {/* INDICADORES */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">
                Transportadoras exibidas
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {transportadoras.length}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">
                Ativas na listagem
              </p>

              <p className="mt-2 text-3xl font-bold text-green-700">
                {totalAtivos}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">
                Inativas na listagem
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-500">
                {totalInativos}
              </p>
            </div>
          </section>

          {/* PESQUISA E FILTROS */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <form
              onSubmit={(evento) => {
                evento.preventDefault();
                void carregarTransportadoras();
              }}
              className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_190px_auto]"
            >
              <Campo label="Pesquisar transportadora">
                <input
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Razão social, CPF/CNPJ ou RNTRC"
                  className={classeInput}
                />
              </Campo>

              <Campo label="Situação">
                <select
                  value={statusFiltro}
                  onChange={(evento) =>
                    setStatusFiltro(evento.target.value)
                  }
                  className={classeInput}
                >
                  <option value="ATIVO">Ativas</option>
                  <option value="INATIVO">Inativas</option>
                  <option value="">Todas</option>
                </select>
              </Campo>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold hover:bg-gray-50 md:w-auto"
                >
                  Pesquisar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setStatusFiltro("ATIVO");
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Limpar
                </button>
              </div>
            </form>
          </section>

          {/* TABELA */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="font-semibold text-gray-900">
                Transportadoras cadastradas
              </h2>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {transportadoras.length} registro(s)
              </span>
            </div>

            {carregando ? (
              <div className="p-10 text-center text-sm text-gray-500">
                Carregando transportadoras...
              </div>
            ) : transportadoras.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-medium text-gray-700">
                  Nenhuma transportadora encontrada
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Altere a pesquisa ou cadastre uma nova transportadora.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">
                        Transportadora
                      </th>

                      <th className="px-5 py-3 font-semibold">
                        CPF/CNPJ
                      </th>

                      <th className="px-5 py-3 font-semibold">
                        RNTRC
                      </th>

                      <th className="px-5 py-3 font-semibold">
                        Contato
                      </th>

                      <th className="px-5 py-3 font-semibold">
                        Cidade/UF
                      </th>

                      <th className="px-5 py-3 font-semibold">
                        Situação
                      </th>

                      <th className="px-5 py-3 text-right font-semibold">
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {transportadoras.map((transportadora) => (
                      <tr
                        key={transportadora.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900">
                            {transportadora.nome_razao_social}
                          </p>

                          {transportadora.nome_fantasia && (
                            <p className="mt-1 text-xs text-gray-500">
                              {transportadora.nome_fantasia}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-gray-400">
                            {transportadora.tipo_pessoa === "F"
                              ? "Pessoa física"
                              : "Pessoa jurídica"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {exibirDocumento(transportadora)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {transportadora.rntrc || "—"}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          <p>{transportadora.email || "—"}</p>

                          <p className="mt-1 text-xs text-gray-500">
                            {transportadora.telefone || ""}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {[
                            transportadora.municipio,
                            transportadora.uf,
                          ]
                            .filter(Boolean)
                            .join("/")
                            || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              transportadora.status === "ATIVO"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {transportadora.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() =>
                                abrirEdicao(transportadora)
                              }
                              disabled={
                                transportadora.status === "INATIVO"
                              }
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Editar
                            </button>

                            {transportadora.status === "ATIVO" && (
                              <button
                                onClick={() =>
                                  void inativarTransportadora(transportadora)
                                }
                                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Inativar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* MODAL DE CADASTRO E EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 py-6 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario"
            className="my-auto w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
          >
            {/* CABEÇALHO DO MODAL */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-7">
              <div>
                <h2
                  id="titulo-formulario"
                  className="text-xl font-bold text-gray-900"
                >
                  {transportadoraEditando
                    ? "Editar transportadora"
                    : "Nova transportadora"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Preencha os dados cadastrais e fiscais da transportadora.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-lg px-3 py-2 text-xl text-gray-500 hover:bg-gray-100"
                aria-label="Fechar formulário"
              >
                ×
              </button>
            </div>

            <form onSubmit={salvarTransportadora}>
              <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
                {erro && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {erro}
                  </div>
                )}

                {/* DADOS GERAIS */}
                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                    Dados gerais
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="Tipo de pessoa *">
                      <select
                        value={formulario.tipo_pessoa}
                        onChange={(evento) =>
                          alterarTipoPessoa(
                            evento.target.value as TipoPessoa
                          )
                        }
                        className={classeInput}
                      >
                        <option value="F">
                          Pessoa física
                        </option>

                        <option value="J">
                          Pessoa jurídica
                        </option>
                      </select>
                    </Campo>

                    <Campo
                      label={
                        formulario.tipo_pessoa === "F"
                          ? "Nome completo *"
                          : "Razão social *"
                      }
                    >
                      <input
                        required
                        maxLength={180}
                        value={formulario.nome_razao_social}
                        onChange={(evento) =>
                          atualizarCampo(
                            "nome_razao_social",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                        placeholder="Nome ou razão social"
                      />
                    </Campo>

                    {formulario.tipo_pessoa === "J" && (
                      <Campo label="Nome fantasia">
                        <input
                          maxLength={180}
                          value={formulario.nome_fantasia}
                          onChange={(evento) =>
                            atualizarCampo(
                              "nome_fantasia",
                              evento.target.value
                            )
                          }
                          className={classeInput}
                          placeholder="Nome fantasia"
                        />
                      </Campo>
                    )}

                    <Campo
                      label={
                        formulario.tipo_pessoa === "F"
                          ? "CPF *"
                          : "CNPJ *"
                      }
                    >
                      <input
                        required
                        inputMode="numeric"
                        value={formulario.cpf_cnpj}
                        onChange={(evento) =>
                          atualizarCampo(
                            "cpf_cnpj",
                            formatarDocumento(
                              evento.target.value,
                              formulario.tipo_pessoa
                            )
                          )
                        }
                        className={classeInput}
                        placeholder={
                          formulario.tipo_pessoa === "F"
                            ? "000.000.000-00"
                            : "00.000.000/0000-00"
                        }
                      />
                    </Campo>

                    <Campo label="E-mail">
                      <input
                        type="email"
                        maxLength={150}
                        value={formulario.email}
                        onChange={(evento) =>
                          atualizarCampo(
                            "email",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                        placeholder="transportadora@exemplo.com"
                      />
                    </Campo>

                    <Campo label="Telefone">
                      <input
                        inputMode="tel"
                        value={formulario.telefone}
                        onChange={(evento) =>
                          atualizarCampo(
                            "telefone",
                            formatarTelefone(evento.target.value)
                          )
                        }
                        className={classeInput}
                        placeholder="(00) 00000-0000"
                      />
                    </Campo>
                  </div>
                </section>

                {/* DADOS FISCAIS E DE TRANSPORTE */}
                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                    Dados fiscais e de transporte
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="Inscrição estadual">
                      <input
                        maxLength={20}
                        value={formulario.inscricao_estadual}
                        onChange={(evento) =>
                          atualizarCampo(
                            "inscricao_estadual",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                        placeholder="Inscrição estadual"
                      />
                    </Campo>

                    <Campo label="RNTRC">
                      <input
                        maxLength={20}
                        value={formulario.rntrc}
                        onChange={(evento) =>
                          atualizarCampo(
                            "rntrc",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                        placeholder="Registro ANTT"
                      />
                    </Campo>
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    RNTRC: Registro Nacional de Transportadores Rodoviários
                    de Cargas. Preencha quando aplicável.
                  </p>
                </section>

                {/* ENDEREÇO */}
                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                    Endereço
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                    <Campo
                      label="CEP"
                      className="sm:col-span-2"
                    >
                      <input
                        inputMode="numeric"
                        value={formulario.cep}
                        onChange={(evento) =>
                          atualizarCampo(
                            "cep",
                            formatarCep(evento.target.value)
                          )
                        }
                        className={classeInput}
                        placeholder="00000-000"
                      />
                    </Campo>

                    <Campo
                      label="UF"
                      className="sm:col-span-1"
                    >
                      <input
                        maxLength={2}
                        value={formulario.uf}
                        onChange={(evento) =>
                          atualizarCampo(
                            "uf",
                            evento.target.value
                              .toUpperCase()
                              .slice(0, 2)
                          )
                        }
                        className={classeInput}
                        placeholder="GO"
                      />
                    </Campo>

                    <Campo
                      label="Município"
                      className="sm:col-span-3"
                    >
                      <input
                        maxLength={100}
                        value={formulario.municipio}
                        onChange={(evento) =>
                          atualizarCampo(
                            "municipio",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                        placeholder="Município"
                      />
                    </Campo>

                    <Campo
                      label="Código IBGE"
                      className="sm:col-span-2"
                    >
                      <input
                        inputMode="numeric"
                        maxLength={7}
                        value={formulario.codigo_municipio_ibge}
                        onChange={(evento) =>
                          atualizarCampo(
                            "codigo_municipio_ibge",
                            evento.target.value
                              .replace(/\D/g, "")
                              .slice(0, 7)
                          )
                        }
                        className={classeInput}
                        placeholder="7 dígitos"
                      />
                    </Campo>

                    <Campo
                      label="Logradouro"
                      className="sm:col-span-4"
                    >
                      <input
                        maxLength={150}
                        value={formulario.logradouro}
                        onChange={(evento) =>
                          atualizarCampo(
                            "logradouro",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                        placeholder="Rua, avenida..."
                      />
                    </Campo>

                    <Campo
                      label="Número"
                      className="sm:col-span-2"
                    >
                      <input
                        maxLength={20}
                        value={formulario.numero}
                        onChange={(evento) =>
                          atualizarCampo(
                            "numero",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                      />
                    </Campo>

                    <Campo
                      label="Complemento"
                      className="sm:col-span-3"
                    >
                      <input
                        maxLength={100}
                        value={formulario.complemento}
                        onChange={(evento) =>
                          atualizarCampo(
                            "complemento",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                      />
                    </Campo>

                    <Campo
                      label="Bairro"
                      className="sm:col-span-3"
                    >
                      <input
                        maxLength={100}
                        value={formulario.bairro}
                        onChange={(evento) =>
                          atualizarCampo(
                            "bairro",
                            evento.target.value
                          )
                        }
                        className={classeInput}
                      />
                    </Campo>
                  </div>
                </section>
              </div>

              {/* RODAPÉ DO MODAL */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando
                    ? "Salvando..."
                    : transportadoraEditando
                      ? "Salvar alterações"
                      : "Cadastrar transportadora"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
