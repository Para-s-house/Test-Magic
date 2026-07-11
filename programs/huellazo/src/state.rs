use anchor_lang::prelude::*;

// ===========================================================================
// PoapState — Datos on-chain estrictos del NFT / POAP
// ===========================================================================
// Token ID, Owner Wallet, Smart Contract Address, Token URI, Lat, Long
// La cuenta es una PDA derivada de [b"poap", owner, token_id].
// ===========================================================================

#[account]
#[derive(InitSpace)]
pub struct PoapState {
    /// Identificador único e irrepetible del POAP.
    pub token_id: u64,

    /// Pubkey de la wallet propietaria del POAP (turista).
    pub owner_wallet: Pubkey,

    /// Pubkey del programa emisor (este smart contract).
    pub smart_contract_address: Pubkey,

    /// URL que apunta a los metadatos off-chain (JSON gestionado por el backend Python).
    #[max_len(256)]
    pub token_uri: String,

    /// Latitud donde se minteó el POAP.
    pub latitude: f64,

    /// Longitud donde se minteó el POAP.
    pub longitude: f64,

    /// Tipo de POAP: 0 = lugar turístico, 1 = negocio.
    pub poap_type: u8,

    /// Bump de la PDA.
    pub bump: u8,
}

// ===========================================================================
// ConfigState — Configuración global del programa
// ===========================================================================

#[account]
#[derive(InitSpace)]
pub struct ConfigState {
    /// Autoridad que puede inicializar el programa.
    pub authority: Pubkey,

    /// Contador global de tokens minteados.
    pub total_minted: u64,

    /// Bump de la PDA de config.
    pub bump: u8,
}