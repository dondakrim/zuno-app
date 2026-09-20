// Empêche Metro (l'outil qui prépare le code de l'appli) de scanner le
// dossier supabase/ — il contient du code serveur (fonctions Edge en
// TypeScript/Deno) qui n'a rien à voir avec l'appli mobile et qui
// provoquerait des erreurs ou des questions inutiles s'il était inclus.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/supabase\/functions\/.*/];

module.exports = config;
