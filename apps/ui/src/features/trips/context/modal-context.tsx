'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type ModalType = 'addExpense' | 'addPlace' | 'addStay' | 'addItinerary' | 'addNote' | 'createPoll' | 'tripSettings' | null;

type ModalState = { type: ModalType; edit?: boolean; dayId?: string };

type ModalContextValue = {
  modal: ModalState;
  openModal: (type: Exclude<ModalType, null>, edit?: boolean, payload?: Omit<ModalState, 'type' | 'edit'>) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextValue>({
  modal: { type: null },
  openModal: () => {},
  closeModal: () => {},
});

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ type: null });

  function openModal(type: Exclude<ModalType, null>, edit?: boolean, payload?: Omit<ModalState, 'type' | 'edit'>) {
    setModal({ type, edit, ...payload });
  }

  function closeModal() {
    setModal({ type: null });
  }

  return (
    <ModalContext.Provider value={{ modal, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
