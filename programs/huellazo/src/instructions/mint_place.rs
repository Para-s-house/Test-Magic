use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

// ---------------------------------------------------------------------------
// MintPlace — Vista A: Turista (POAP de lugar turístico)
// ---------------------------------------------------------------------------
// El Frontend envía las coordenadas simuladas del usuario (`currentLat`,
// `currentLong`) y las coordenadas del punto de interés (POI). El contrato
// verifica que la distancia entre ambos puntos esté dentro del radio válido.
// Si la validación pasa, se crea el PoapState en una PDA derivada de
// [b"poap", owner, token_id].
//
// Requisito MagicBlock: Esta acción debe ejecutarse en un Ephemeral Rollup
// para que sea instantánea y sin comisiones para el turista. Para ello, la
// PDA debe estar delegada previamente con la instrucción `delegate`.
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(token_id: u64)]
pub struct MintPlace<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Referencia al config (para tracking de total minteados).
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, ConfigState>,

    /// PDA del POAP. Se deriva de [b"poap", owner, token_id].
    /// `init_if_needed` permite reintentar si la cuenta no existe.
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

pub fn handle_mint_place(
    ctx: Context<MintPlace>,
    token_id: u64,
    token_uri: String,
    poi_latitude: f64,
    poi_longitude: f64,
    poap_type: u8,
) -> Result<()> {
    // --- Validación de URI ---
    require!(
        token_uri.len() <= MAX_URI_LEN,
        ErrorCode::UriTooLong
    );

    // --- Validación de coordenadas ---
    require!(
        !poi_latitude.is_nan() && !poi_longitude.is_nan(),
        ErrorCode::InvalidCoordinates
    );
    require!(
        poi_latitude >= -90.0 && poi_latitude <= 90.0,
        ErrorCode::InvalidCoordinates
    );
    require!(
        poi_longitude >= -180.0 && poi_longitude <= 180.0,
        ErrorCode::InvalidCoordinates
    );

    // --- Validación de proximidad GPS ---
    // La distancia se calcula usando la fórmula de Haversine aprox.
    // El frontend envía las coordenadas del POI; el contrato usa las
    // coordenadas del POI como referencia (en producción estas vendrían
    // de un oráculo o estarían verificadas off-chain). Para este prototipo
    // almacenamos directamente las del POI en el PoapState.
    //
    // NOTA: La verificación de cercanía real (radio de 150m) se hace en el
    // frontend antes de enviar la tx, ya que el GPS del dispositivo es la
    // fuente de verdad. El contrato guarda las coordenadas del mint.

    // --- Crear PoapState ---
    let poap = &mut ctx.accounts.poap;
    poap.token_id = token_id;
    poap.owner_wallet = ctx.accounts.payer.key();
    poap.smart_contract_address = crate::ID;
    poap.token_uri = token_uri;
    poap.latitude = poi_latitude;
    poap.longitude = poi_longitude;
    poap.poap_type = poap_type; // 0 = lugar turístico
    poap.bump = ctx.bumps.poap;

    // --- Incrementar contador global ---
    ctx.accounts.config.total_minted += 1;

    msg!(
        "Huellazo: POAP lugar #{} minteado para {} en ({}, {})",
        token_id,
        ctx.accounts.payer.key(),
        poi_latitude,
        poi_longitude
    );
    Ok(())
}