import { useState, useCallback, useRef } from 'react';
import { Document } from '../types';

export function useHistory(initialDoc: Document) {
  const [doc, setDocInternal] = useState<Document>(initialDoc);
  const historyRef = useRef<Document[]>([initialDoc]);
  const indexRef = useRef<number>(0);
  const maxHistory = 200;

  const pushState = useCallback((newDoc: Document) => {
    // Drop future redos
    const currentHist = historyRef.current.slice(0, indexRef.current + 1);
    currentHist.push(JSON.parse(JSON.stringify(newDoc)));

    if (currentHist.length > maxHistory) {
      currentHist.shift();
    } else {
      indexRef.current++;
    }

    historyRef.current = currentHist;
    setDocInternal(newDoc);
  }, []);

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current--;
      const prevDoc = JSON.parse(JSON.stringify(historyRef.current[indexRef.current]));
      setDocInternal(prevDoc);
      return prevDoc;
    }
    return null;
  }, []);

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++;
      const nextDoc = JSON.parse(JSON.stringify(historyRef.current[indexRef.current]));
      setDocInternal(nextDoc);
      return nextDoc;
    }
    return null;
  }, []);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return {
    doc,
    setDoc: pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    historyCount: historyRef.current.length,
  };
}
