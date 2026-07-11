use anchor_lang::prelude::*;

use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

// ---------------------------------------------------------------------------
// Commit — Sincronizar estado del ER a la capa base
// ---------------------------------------------------------------------------
// Mientras la PDA está delegada, las transacciones ocurren en el
// Ephemeral Rollup (sin gas, instantáneas). El commit sincroniza el
// estado modificado de vuelta a la capa base (Solana L1).
//
// `MagicIntentBundleBuilder` construye el bundle de intent que el ER
// ejecuta para hacer commit de los cambios.
//
// Esta instrucción se ejecuta en el EPHEMERAL ROLLUP.
// ---------------------------------------------------------------------------

#[commit]
#[derive(Accounts)]
pub struct CommitInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: La PDA delegada cuyo estado se quiere sincronizar.
    #[account(mut)]
    pub poap: UncheckedAccount<'info>,
}

pub fn handle_commit(ctx: Context<CommitInput>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit(&[ctx.accounts.poap.to_account_info()])
    .build_and_invoke()?;

    msg!(
        "Huellazo: Commit de PDA {} desde ER a capa base",
        ctx.accounts.poap.key()
    );
    Ok(())
}