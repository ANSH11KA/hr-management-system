
import { useEffect, useState } from "react";
import api from "../api";
import { AuthCtx } from "./AuthContext";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(
    () => !!localStorage.getItem("token")
  );

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }

    api.get("/auth/me")
      .then((r) => {
        setUser(r.data.user);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Employee/Admin login
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", {
      email,
      password,
    });

    localStorage.setItem("token", data.token);
    setUser(data.user);

    return data.user;
  };

  // Separate Manager login
  const managerLogin = async (email, password) => {
    const { data } = await api.post("/auth/manager-login", {
      email,
      password,
    });

    localStorage.setItem("token", data.token);
    setUser(data.user);

    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        login,
        managerLogin,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
