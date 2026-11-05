/** URL pública de una foto guardada (servida por /api/fotos/[name]). Válida en cliente y servidor. */
export const photoUrl = (name: string) => `/api/fotos/${name}`;
