
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { useRouter } from "next/navigation";
import { api } from "@/src/services/api";

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: "ADMINISTRADOR" | "USUARIO";
}

interface AuthContextData {
  usuario: Usuario | null;
  autenticado: boolean;
  carregando: boolean;
  atualizarUsuario: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const router = useRouter();

  const atualizarUsuario = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");

      if (response.data.success && response.data.usuario) {
        setUsuario(response.data.usuario);
        return true;
      }

      setUsuario(null);
      return false;
    } catch {
      setUsuario(null);
      return false;
    }
  }, []);

  useEffect(() => {
    async function verificarSessao() {
      await atualizarUsuario();
      setCarregando(false);
    }

    verificarSessao();
  }, [atualizarUsuario]);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    } finally {
      setUsuario(null);
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        autenticado: !!usuario,
        carregando,
        atualizarUsuario,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth deve ser utilizado dentro de AuthProvider."
    );
  }

  return context;
}
