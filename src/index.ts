// src/index.ts

export interface UserProfile {
  identifier: string;
  fullName: string;
  age: number;
}

/**
 * Registra um novo perfil de usuário no sistema.
 * * @param profileData - Os dados iniciais do perfil.
 * @returns O perfil atualizado e persistido.
 */
export function registerUserProfile(profileData: UserProfile): UserProfile {
  // Simula o registro no banco de dados
  const registeredProfile: UserProfile = {
    ...profileData,
    identifier: crypto.randomUUID(),
  };

  return registeredProfile;
}