pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::ephemeral;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4pioWVSCp5oSbxbeRbquccusTkvT6Z9B8jTg7j2XXNVk");

// ===========================================================================
// Programa Huellazo
// ===========================================================================
// El macro `#[ephemeral]` inyecta el callback de undelegation necesario para
// que MagicBlock pueda devolver la propiedad de las PDAs delegadas al programa.
// Todas las instrucciones de delegación, commit y undelegation usan el SDK
// `ephemeral-rollups-sdk` con el feature `anchor`.
// ===========================================================================

#[ephemeral]
#[program]
pub mod huellazo {
    use super::*;

    // -----------------------------------------------------------------------
    // Inicialización
    // -----------------------------------------------------------------------

    /// Inicializa la configuración global del programa Huellazo.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        crate::instructions::initialize::handle_initialize(ctx)
    }

    // -----------------------------------------------------------------------
    // Vista A — Turista (Minteo de POAP de lugar turístico)
    // -----------------------------------------------------------------------

    /// Mintea un POAP de lugar turístico. Verifica que el turista esté dentro
    /// del radio válido del punto de interés. Esta acción se ejecuta en el
    /// Ephemeral Rollup para ser instantánea y sin gas para el turista.
    pub fn mint_place(
        ctx: Context<MintPlace>,
        token_id: u64,
        token_uri: String,
        poi_latitude: f64,
        poi_longitude: f64,
        poap_type: u8,
    ) -> Result<()> {
        crate::instructions::mint_place::handle_mint_place(
            ctx,
            token_id,
            token_uri,
            poi_latitude,
            poi_longitude,
            poap_type,
        )
    }

    // -----------------------------------------------------------------------
    // Vista B — Negociante (Pago + Minteo atómico)
    // -----------------------------------------------------------------------

    /// Procesa el pago de un producto del negocio y mintea atómicamente la
    /// insignia/POAP del negocio al turista en la misma transacción.
    /// Transfiere lamports del turista al negocio y crea el PoapState.
    pub fn mint_business(
        ctx: Context<MintBusiness>,
        token_id: u64,
        token_uri: String,
        business_latitude: f64,
        business_longitude: f64,
        amount_lamports: u64,
    ) -> Result<()> {
        crate::instructions::mint_business::handle_mint_business(
            ctx,
            token_id,
            token_uri,
            business_latitude,
            business_longitude,
            amount_lamports,
        )
    }

    // -----------------------------------------------------------------------
    // MagicBlock — Delegación / Commit / Undelegation
    // -----------------------------------------------------------------------

    /// Delega la PDA del POAP al programa de delegación de MagicBlock.
    /// Esto transfiere temporalmente la propiedad de la cuenta a un
    /// Ephemeral Rollup, permitiendo minteos rápidos y sin gas.
    /// Se ejecuta en la capa base (Solana L1).
    pub fn delegate(ctx: Context<DelegateInput>, token_id: u64) -> Result<()> {
        crate::instructions::delegate::handle_delegate(ctx, token_id)
    }

    /// Hace commit del estado de la PDA delegada desde el ER hacia la
    /// capa base. Se ejecuta en el Ephemeral Rollup.
    pub fn commit(ctx: Context<CommitInput>) -> Result<()> {
        crate::instructions::commit::handle_commit(ctx)
    }

    /// Hace commit + undelegate: sincroniza el estado final y devuelve
    /// la propiedad de la PDA al programa. Se ejecuta en el ER.
    pub fn undelegate(ctx: Context<UndelegateInput>) -> Result<()> {
        crate::instructions::undelegate::handle_undelegate(ctx)
    }
}