import { useState, useEffect, useCallback, useRef } from "react";
import { useMap } from "@joebobmiles/y-react";

export function useYjsState(mapName, key, initialValue = null) {
  const ymap = useMap(mapName);
  const valueFromMap = ymap.get(key);

  const [localState, setLocalState] = useState(valueFromMap || initialValue);
  const prevMapValueRef = useRef(valueFromMap);

  useEffect(() => {
    if (!ymap.get(key) && initialValue !== null) {
      ymap.set(key, initialValue);
    }
  }, []);

  useEffect(() => {
    const newMapValue = ymap.get(key);
    if (newMapValue !== prevMapValueRef.current) {
      prevMapValueRef.current = newMapValue;
      if (newMapValue !== undefined) {
        setLocalState(newMapValue);
      }
    }
  }, [ymap, key]);

  const updateState = useCallback(
    (newValue) => {
      const valueToStore =
        typeof newValue === "function" ? newValue(localState) : newValue;
      setLocalState(valueToStore);
      ymap.set(key, valueToStore);
      prevMapValueRef.current = valueToStore;
    },
    [localState, ymap, key],
  );

  return [localState, updateState];
}
