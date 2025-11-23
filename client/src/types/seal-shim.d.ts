declare module "@mysten/seal/dist/esm/encrypt.js" {
  export const encrypt: any;
  export const DemType: any;
  export const KemType: any;
}

declare module "@mysten/seal/dist/esm/dem.js" {
  export class AesGcm256 {
    constructor(msg: Uint8Array, aad: Uint8Array);
  }
}

declare module "@mysten/seal/dist/esm/key-server.js" {}
