import React, { PropsWithChildren } from 'react';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

export type PoppinsFonts = {
  REGULAR: string;
  MEDIUM: string;
  SEMIBOLD: string;
  BOLD: string;
};

export function usePoppinsFonts(): { fontsLoaded: boolean; fonts: PoppinsFonts } {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  return {
    fontsLoaded,
    fonts: {
      REGULAR: 'Poppins_400Regular',
      MEDIUM: 'Poppins_500Medium',
      SEMIBOLD: 'Poppins_600SemiBold',
      BOLD: 'Poppins_700Bold',
    },
  };
}

export function PoppinsProvider({ children }: PropsWithChildren) {
  const { fontsLoaded } = usePoppinsFonts();
  if (!fontsLoaded) return null;
  return <>{children}</>;
}


