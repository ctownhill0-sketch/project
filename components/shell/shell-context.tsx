"use client";

import { createContext, useContext } from "react";

export interface ShellApi {
  openCommand: () => void;
  openShortcuts: () => void;
}

export const ShellContext = createContext<ShellApi>({ openCommand: () => {}, openShortcuts: () => {} });

export const useShell = () => useContext(ShellContext);
