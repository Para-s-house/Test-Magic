use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;

// ---------------------------------------------------------------------------
// Delegate — Delegar PDA a MagicBlock Ephemeral Rollup
// ---------------------------------------------------------------------------
// El macro `#[delegate]` inyecta automáticamente las cuentas necesarias
// para el CPI al programa de delegación de MagicBlock:
//   - buffer_pda
//   - delegation_record_pda
//   - delegation_metadata_pda
//   - delegation_program
//   - owner_program
//   - system_program
//
// `ctx.accounts.delegate_pda(...)` ejecuta el CPI que transfiere la propiedad
// de la PDA al Delegation Program, permitiendo que un Ephemeral Validator
// procese transacciones sobre ella.
//
// Esta instrucción se ejecuta en la CAPA BASE (Solana L1).
// ---------------------------------------------------------------------------

#[delegate]
#[derive(Accounts)]
pub struct DelegateInput<'info> {
    pub payer: Signer<'info>,

    /// CHECK: La PDA del POAP a delegar al Ephemeral Rollup.
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}

pub fn handle_delegate(ctx: Context<DelegateInput>, token_id: u64) -> Result<()> {
    // Semillas de la PDA del POAP: [b"poap", owner, token_id.to_le_bytes()]
    let owner_key = ctx.accounts.payer.key();
    let token_id_bytes = token_id.to_le_bytes();
    let seeds = &[
        POAP_SEED,
        owner_key.as_ref(),
        &token_id_bytes[..],
    ][..];

    // Delegar la PDA al programa de MagicBlock.
    // Se puede especificar un validador ER concreto desde `remaining_accounts`.
    ctx.accounts.delegate_pda(
        &ctx.accounts.payer,
        seeds,
        DelegateConfig {
            validator: ctx
                .remaining_accounts
                .first()
                .map(|acc| acc.key()),
            ..Default::default()
        },
    )?;

    msg!(
        "Huellazo: PDA {} delegada a MagicBlock ER",
        ctx.accounts.pda.key()
    );
    Ok(())
}