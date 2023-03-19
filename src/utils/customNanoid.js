import { customAlphabet } from "nanoid";

// Custom alphabet and length to match graphcool ids
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const idLength = 25;
export const customNanoid = customAlphabet(alphabet, idLength);
