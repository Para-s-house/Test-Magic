use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{constants::*, error::ErrorCode, state::*};

// ---------------------------------------------------------------------------
// MintBusiness — Vista B: Negociante (Pago + Minteo atómico)
// ---------------------------------------------------------------------------
// El negocio muestra un QR (generado por el backend Python). El turista
// escanea y paga. En la MISMA transacción:
//   1. Se transfiere SOL (lamports) del turista al negocio.
//   2. Se crea el PoapState (insignia del negocio) para el turista.
//
// Esto garantiza atomicidad: si el pago falla, el minteo también falla.
//
// Requisito MagicBlock: El pago se procesa en el Ephemeral Rollup para
// que sea sin gas y rápido. La PDA del POAP debe estar delegada.
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(token_id: u64)]
pub struct MintBusiness<'info> {
    /// Turista que paga y recibe el POAP.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Negocio que recibe el pago.
    /// CHECK: La wallet del negocio verificada off-chain.
    #[account(mut)]
    pub business_wallet: UncheckedAccount<'info>,

    /// Referencia al config.
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, ConfigState>,

    /// PDA del POAP del negocio. Se deriva de [b"poap", owner, token_id].
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + PoapState::INIT_SPACE,
        seeds = [POAP_SEED, payer.key().as_ref(), &token_id.to_le_bytes()],
        bump
    )]
    pub poap: Account<'info, PoapState>,

    pub system_program: Program<'info, System>,
}

pub fn handle_mint_business(
    ctx: Context<MintBusiness>,
    token_id: u64,
    token_uri: String,
    business_latitude: f64,
    business_longitude: f64,
    amount_lamports: u64,
) -> Result<()> {
    // --- Validación de URI ---
    require!(
        token_uri.len() <= MAX_URI_LEN,
        ErrorCode::UriTooLong
    );

    // --- Validación de coordenadas ---
    require!(
        !business_latitude.is_nan() && !business_longitude.is_nan(),
        ErrorCode::InvalidCoordinates
    );

    // --- Validación del monto del pago ---
    require!(
        amount_lamports >= BUSINESS_PROMO_PRICE_LAMPORTS,
        ErrorCode::InvalidPaymentAmount
    );

    // --- 1. Transferencia atómica de SOL (turista -> negocio) ---
    let transfer_cpi_accounts = system_program::Transfer {
        from: ctx.accounts.payer.to_account_info(),
        to: ctx.accounts.business_wallet.to_account_info(),
    };
    let transfer_cpi_ctx = CpiContext::new(
        anchor_lang::system_program::ID,
        transfer_cpi_accounts,
    );
    system_program::transfer(transfer_cpi_ctx, amount_lamports)?;

    // --- 2. Minteo del POAP (insignia del negocio) ---
    let poap = &mut ctx.accounts.poap;
    poap.token_id = token_id;
    poap.owner_wallet = ctx.accounts.payer.key();
    poap.smart_contract_address = crate::ID;
    poap.token_uri = token_uri;
    poap.latitude = business_latitude;
    poap.longitude = business_longitude;
    poap.poap_type = 1; // 1 = negocio
    poap.bump = ctx.bumps.poap;

    // --- Incrementar contador global ---
    ctx.accounts.config.total_minted += 1;

    msg!(
        "Huellazo: Pago de {} lamports a negocio {}: POAP negocio #{} minteado para {}",
        amount_lamports,
        ctx.accounts.business_wallet.key(),
        token_id,
        ctx.accounts.payer.key()
    );
    Ok(())
}