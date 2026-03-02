import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "activeBarbershopId";

interface BarbershopContextValue {
  activeBarbershopId: number | null;
  setActiveBarbershopId: (id: number | null) => void;
}

const BarbershopContext = createContext<BarbershopContextValue>({
  activeBarbershopId: null,
  setActiveBarbershopId: () => {},
});

export function BarbershopProvider({ children }: { children: ReactNode }) {
  const [activeBarbershopId, setActiveBarbershopIdState] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setActiveBarbershopIdState(Number(val));
    });
  }, []);

  const setActiveBarbershopId = (id: number | null) => {
    setActiveBarbershopIdState(id);
    if (id === null) AsyncStorage.removeItem(STORAGE_KEY);
    else AsyncStorage.setItem(STORAGE_KEY, String(id));
  };

  return (
    <BarbershopContext.Provider value={{ activeBarbershopId, setActiveBarbershopId }}>
      {children}
    </BarbershopContext.Provider>
  );
}

export function useBarbershop() {
  return useContext(BarbershopContext);
}
